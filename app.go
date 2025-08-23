package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"weld/diff"
)

// DiffLine is now imported from the diff package
type DiffLine = diff.DiffLine

// DiffResult is now imported from the diff package
type DiffResult = diff.DiffResult

// Undo operation types
type OperationType string

const (
	OpCopy   OperationType = "copy"
	OpRemove OperationType = "remove"
)

// SingleOperation represents a single atomic operation
type SingleOperation struct {
	Type        OperationType
	SourceFile  string
	TargetFile  string
	LineNumber  int
	LineContent string
	InsertIndex int
}

// OperationGroup represents a group of operations that should be undone together
type OperationGroup struct {
	ID          string            `json:"id"`
	Description string            `json:"description"`
	Operations  []SingleOperation `json:"operations"`
	Timestamp   time.Time         `json:"timestamp"`
}

// Global undo state
var (
	operationHistory   []OperationGroup
	currentTransaction *OperationGroup
	maxHistorySize     = 50
	isUndoing          = false // Prevent recording operations during undo
)

// App struct
type App struct {
	ctx               context.Context
	InitialLeftFile   string
	InitialRightFile  string
	minimapVisible    bool
	minimapMenuItem   *menu.MenuItem
	undoMenuItem      *menu.MenuItem
	discardMenuItem   *menu.MenuItem
	saveLeftMenuItem  *menu.MenuItem
	saveRightMenuItem *menu.MenuItem
	saveAllMenuItem   *menu.MenuItem
	firstDiffMenuItem *menu.MenuItem
	lastDiffMenuItem  *menu.MenuItem
	prevDiffMenuItem  *menu.MenuItem
	nextDiffMenuItem  *menu.MenuItem
	copyLeftMenuItem  *menu.MenuItem
	copyRightMenuItem *menu.MenuItem
	lastUsedDirectory string

	// File watching
	fileWatcher     *fsnotify.Watcher
	watcherMutex    sync.Mutex
	leftWatchPath   string
	rightWatchPath  string
	changeDebouncer map[string]time.Time

	// Diff algorithm
	diffAlgorithm diff.Algorithm
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		changeDebouncer: make(map[string]time.Time),
		minimapVisible:  true, // Default to showing minimap
		diffAlgorithm:   diff.NewLCSDefault(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called when the app is shutting down
func (a *App) shutdown(ctx context.Context) {
	// Stop file watching
	a.StopFileWatching()
}

// InitialFiles represents the initial file paths for comparison
type InitialFiles struct {
	LeftFile  string `json:"leftFile"`
	RightFile string `json:"rightFile"`
}

// GetInitialFiles returns the initial file paths passed via command line
func (a *App) GetInitialFiles() InitialFiles {
	return InitialFiles{
		LeftFile:  a.InitialLeftFile,
		RightFile: a.InitialRightFile,
	}
}

// SelectFile opens a file dialog and returns the selected file path
func (a *App) SelectFile() (string, error) {

	// Use last used directory if available, otherwise default to home directory
	defaultDir := a.lastUsedDirectory
	if defaultDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			// If we can't get home directory, use empty string (system default)
			defaultDir = ""
		} else {
			defaultDir = homeDir
		}
	}

	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                      "Select File to Compare",
		DefaultDirectory:           defaultDir,
		ShowHiddenFiles:            true,
		CanCreateDirectories:       false,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: false,
	})

	// If a file was selected, validate it's not binary
	if err == nil && file != "" {
		// Remember the directory for next time
		a.lastUsedDirectory = filepath.Dir(file)
		isBinary, checkErr := IsBinaryFile(file)
		if checkErr != nil {
			return "", fmt.Errorf("error checking file type: %w", checkErr)
		}
		if isBinary {
			return "", fmt.Errorf("binary files cannot be compared: %s", filepath.Base(file))
		}
	}

	return file, err
}

// IsBinaryFile checks if a file is binary by reading the first 512 bytes
// and looking for null bytes or other non-text indicators
func IsBinaryFile(filepath string) (bool, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return false, err
	}
	defer file.Close()

	// Read first 512 bytes (or less if file is smaller)
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return false, err
	}

	// Check for null bytes, which are a strong indicator of binary content
	for i := 0; i < n; i++ {
		if buf[i] == 0 {
			return true, nil
		}
	}

	// Additional check: count non-printable characters
	// If more than 30% of characters are non-printable, consider it binary
	nonPrintable := 0
	for i := 0; i < n; i++ {
		b := buf[i]
		// Check if character is printable ASCII or common whitespace
		if (b < 32 || b > 126) && b != '\t' && b != '\n' && b != '\r' {
			nonPrintable++
		}
	}

	// If more than 30% non-printable, consider it binary
	if float64(nonPrintable)/float64(n) > 0.3 {
		return true, nil
	}

	return false, nil
}

// ReadFileContent reads the content of a file and returns it as lines
func (a *App) ReadFileContent(filepath string) ([]string, error) {
	if filepath == "" {
		return []string{}, nil
	}

	// Check if file is binary before attempting to read as text
	isBinary, err := IsBinaryFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("error checking file type: %w", err)
	}
	if isBinary {
		return nil, fmt.Errorf("cannot read binary file: %s", filepath)
	}

	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	// Increase buffer size to handle long lines (e.g., minified files)
	// Default is 64KB, we set to 1MB to handle most practical cases
	const maxScanTokenSize = 1024 * 1024 // 1MB
	buf := make([]byte, 0, 64*1024)      // Initial buffer size 64KB
	scanner.Buffer(buf, maxScanTokenSize)
	
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	return lines, scanner.Err()
}

// CompareFiles compares two files and returns diff results
func (a *App) CompareFiles(leftPath, rightPath string) (*DiffResult, error) {
	// Validate both files exist and are not empty paths
	if leftPath == "" || rightPath == "" {
		return nil, fmt.Errorf("file paths cannot be empty")
	}

	// Check if files are binary before attempting comparison
	leftBinary, err := IsBinaryFile(leftPath)
	if err != nil {
		return nil, fmt.Errorf("error checking left file type: %w", err)
	}
	if leftBinary {
		return nil, fmt.Errorf("cannot compare binary file: %s", filepath.Base(leftPath))
	}

	rightBinary, err := IsBinaryFile(rightPath)
	if err != nil {
		return nil, fmt.Errorf("error checking right file type: %w", err)
	}
	if rightBinary {
		return nil, fmt.Errorf("cannot compare binary file: %s", filepath.Base(rightPath))
	}

	leftLines, err := a.ReadFileContentWithCache(leftPath)
	if err != nil {
		return nil, fmt.Errorf("error reading left file: %w", err)
	}

	rightLines, err := a.ReadFileContentWithCache(rightPath)
	if err != nil {
		return nil, fmt.Errorf("error reading right file: %w", err)
	}

	// Additional safety check for very large files that might cause memory issues
	const maxLines = 100000
	if len(leftLines) > maxLines || len(rightLines) > maxLines {
		return nil, fmt.Errorf("file too large for comparison (max %d lines)", maxLines)
	}

	result := a.diffAlgorithm.ComputeDiff(leftLines, rightLines)

	// Start watching these files for changes
	a.StartFileWatching(leftPath, rightPath)

	return result, nil
}

// CopyToFile copies a line from one file to another in memory
func (a *App) CopyToFile(sourceFile, targetFile string, lineNumber int, lineContent string) error {

	// Read target file from cache if available, otherwise from disk
	targetLines, err := a.ReadFileContentWithCache(targetFile)
	if err != nil {
		return fmt.Errorf("failed to read target file: %w", err)
	}

	// Insert line at specified position (1-based line numbers)
	insertIndex := lineNumber - 1
	if insertIndex < 0 {
		insertIndex = 0
	}
	if insertIndex > len(targetLines) {
		insertIndex = len(targetLines)
	}

	// Create new slice with inserted line
	newLines := make([]string, 0, len(targetLines)+1)
	newLines = append(newLines, targetLines[:insertIndex]...)
	newLines = append(newLines, lineContent)
	newLines = append(newLines, targetLines[insertIndex:]...)

	// Store in memory
	err = a.storeFileInMemory(targetFile, newLines)
	if err != nil {
		return err
	}

	// Record the operation for undo (actual insert position is insertIndex + 1 for 1-based)
	a.recordOperation(SingleOperation{
		Type:        OpCopy,
		SourceFile:  sourceFile,
		TargetFile:  targetFile,
		LineNumber:  lineNumber,
		LineContent: lineContent,
		InsertIndex: insertIndex + 1, // Store as 1-based for undo
	})

	return nil
}

// RemoveLineFromFile removes a line from a file in memory
func (a *App) RemoveLineFromFile(targetFile string, lineNumber int) error {

	// Read target file from cache if available, otherwise from disk
	targetLines, err := a.ReadFileContentWithCache(targetFile)
	if err != nil {
		return fmt.Errorf("failed to read target file: %w", err)
	}

	// Remove line at specified position (1-based line numbers)
	removeIndex := lineNumber - 1
	if removeIndex < 0 || removeIndex >= len(targetLines) {
		return fmt.Errorf("line number %d is out of range", lineNumber)
	}

	// Store the line content before removing (for undo)
	removedContent := targetLines[removeIndex]

	// Create new slice without the line
	newLines := make([]string, 0, len(targetLines)-1)
	newLines = append(newLines, targetLines[:removeIndex]...)
	newLines = append(newLines, targetLines[removeIndex+1:]...)

	// Store in memory
	err = a.storeFileInMemory(targetFile, newLines)
	if err != nil {
		return err
	}

	// Record the operation for undo
	a.recordOperation(SingleOperation{
		Type:        OpRemove,
		SourceFile:  "",
		TargetFile:  targetFile,
		LineNumber:  lineNumber,
		LineContent: removedContent,
		InsertIndex: 0,
	})

	return nil
}

// In-memory storage for unsaved file changes
var fileCache = make(map[string][]string)

func (a *App) storeFileInMemory(filepath string, lines []string) error {
	fileCache[filepath] = lines
	return nil
}

// ReadFileContent now checks memory cache first
func (a *App) ReadFileContentWithCache(filepath string) ([]string, error) {
	// Check memory cache first
	if cachedLines, exists := fileCache[filepath]; exists {
		return cachedLines, nil
	}

	// Fall back to reading from disk
	return a.ReadFileContent(filepath)
}

// DiscardAllChanges clears all cached file changes
func (a *App) DiscardAllChanges() error {
	// Clear the entire cache
	fileCache = make(map[string][]string)
	return nil
}

// SaveChanges saves the in-memory changes to disk
func (a *App) SaveChanges(filepath string) error {
	cachedLines, exists := fileCache[filepath]
	if !exists {
		return fmt.Errorf("no unsaved changes for file: %s", filepath)
	}

	// Write to file
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	for i, line := range cachedLines {
		if i > 0 {
			if _, err := file.WriteString("\n"); err != nil {
				return fmt.Errorf("failed to write newline: %w", err)
			}
		}
		if _, err := file.WriteString(line); err != nil {
			return fmt.Errorf("failed to write line: %w", err)
		}
	}

	// Remove from cache after successful save
	delete(fileCache, filepath)

	return nil
}

// OnBeforeClose is called when the application is about to quit
// Returns true to prevent closing, false to allow normal shutdown
func (a *App) OnBeforeClose(ctx context.Context) (prevent bool) {
	// Check if there are unsaved changes in memory cache
	if len(fileCache) > 0 {
		// Emit event to frontend to show custom dialog
		runtime.EventsEmit(ctx, "show-quit-dialog", a.GetUnsavedFilesList())
		// Always prevent closing initially - frontend will handle quit after user decision
		return true
	}
	// No unsaved changes, allow normal quit
	return false
}

// HasUnsavedChanges checks if a file has unsaved changes in the cache
func (a *App) HasUnsavedChanges(filepath string) bool {
	_, exists := fileCache[filepath]
	return exists
}

// GetUnsavedFilesList returns a list of files with unsaved changes
func (a *App) GetUnsavedFilesList() []string {
	files := make([]string, 0, len(fileCache))
	for filepath := range fileCache {
		files = append(files, filepath)
	}
	return files
}

// SaveSelectedFilesAndQuit saves the specified files and then quits the application
func (a *App) SaveSelectedFilesAndQuit(filesToSave []string) error {
	// Save each selected file
	for _, filepath := range filesToSave {
		if err := a.SaveChanges(filepath); err != nil {
			return fmt.Errorf("failed to save %s: %w", filepath, err)
		}
	}

	// Clear any remaining unsaved files from cache if user chose not to save them
	for filepath := range fileCache {
		delete(fileCache, filepath)
	}

	// Quit the application
	runtime.Quit(a.ctx)
	return nil
}

// QuitWithoutSaving clears the cache and quits without saving
func (a *App) QuitWithoutSaving() {
	// Clear all unsaved changes
	for filepath := range fileCache {
		delete(fileCache, filepath)
	}

	// Quit the application
	runtime.Quit(a.ctx)
}

// GetMinimapVisible returns the current minimap visibility state
func (a *App) GetMinimapVisible() bool {
	return a.minimapVisible
}

// SetMinimapVisible sets the minimap visibility state
func (a *App) SetMinimapVisible(visible bool) {
	a.minimapVisible = visible
	// Update the menu checkmark
	if a.minimapMenuItem != nil {
		a.minimapMenuItem.Checked = visible
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
}

// SetMinimapMenuItem stores a reference to the minimap menu item
func (a *App) SetMinimapMenuItem(item *menu.MenuItem) {
	a.minimapMenuItem = item
}

// SetUndoMenuItem stores a reference to the undo menu item
func (a *App) SetUndoMenuItem(item *menu.MenuItem) {
	a.undoMenuItem = item
}

// SetDiscardMenuItem stores a reference to the discard menu item
func (a *App) SetDiscardMenuItem(item *menu.MenuItem) {
	a.discardMenuItem = item
}

// SetSaveLeftMenuItem stores a reference to the save left menu item
func (a *App) SetSaveLeftMenuItem(item *menu.MenuItem) {
	a.saveLeftMenuItem = item
}

// SetSaveRightMenuItem stores a reference to the save right menu item
func (a *App) SetSaveRightMenuItem(item *menu.MenuItem) {
	a.saveRightMenuItem = item
}

// SetSaveAllMenuItem stores a reference to the save all menu item
func (a *App) SetSaveAllMenuItem(item *menu.MenuItem) {
	a.saveAllMenuItem = item
}

// SetFirstDiffMenuItem stores a reference to the first diff menu item
func (a *App) SetFirstDiffMenuItem(item *menu.MenuItem) {
	a.firstDiffMenuItem = item
}

// SetLastDiffMenuItem stores a reference to the last diff menu item
func (a *App) SetLastDiffMenuItem(item *menu.MenuItem) {
	a.lastDiffMenuItem = item
}

// SetPrevDiffMenuItem stores a reference to the previous diff menu item
func (a *App) SetPrevDiffMenuItem(item *menu.MenuItem) {
	a.prevDiffMenuItem = item
}

// SetNextDiffMenuItem stores a reference to the next diff menu item
func (a *App) SetNextDiffMenuItem(item *menu.MenuItem) {
	a.nextDiffMenuItem = item
}

// SetCopyLeftMenuItem stores a reference to the copy left menu item
func (a *App) SetCopyLeftMenuItem(item *menu.MenuItem) {
	a.copyLeftMenuItem = item
}

// SetCopyRightMenuItem stores a reference to the copy right menu item
func (a *App) SetCopyRightMenuItem(item *menu.MenuItem) {
	a.copyRightMenuItem = item
}

// UpdateSaveMenuItems updates the state of all save-related menu items
func (a *App) UpdateSaveMenuItems(hasUnsavedLeft, hasUnsavedRight bool) {
	// Update individual save items
	if a.saveLeftMenuItem != nil {
		a.saveLeftMenuItem.Disabled = !hasUnsavedLeft
	}
	if a.saveRightMenuItem != nil {
		a.saveRightMenuItem.Disabled = !hasUnsavedRight
	}

	// Update save all - enabled if either side has unsaved changes
	if a.saveAllMenuItem != nil {
		a.saveAllMenuItem.Disabled = !hasUnsavedLeft && !hasUnsavedRight
	}

	// Update discard all - same logic as save all
	if a.discardMenuItem != nil {
		a.discardMenuItem.Disabled = !hasUnsavedLeft && !hasUnsavedRight
	}

	runtime.MenuUpdateApplicationMenu(a.ctx)
}

// UpdateDiffNavigationMenuItems updates the state of the diff navigation menu items
func (a *App) UpdateDiffNavigationMenuItems(hasPrevDiff, hasNextDiff, hasFirstDiff, hasLastDiff bool) {
	if a.firstDiffMenuItem != nil {
		a.firstDiffMenuItem.Disabled = !hasFirstDiff
	}
	if a.lastDiffMenuItem != nil {
		a.lastDiffMenuItem.Disabled = !hasLastDiff
	}
	if a.prevDiffMenuItem != nil {
		a.prevDiffMenuItem.Disabled = !hasPrevDiff
	}
	if a.nextDiffMenuItem != nil {
		a.nextDiffMenuItem.Disabled = !hasNextDiff
	}
	runtime.MenuUpdateApplicationMenu(a.ctx)
}

// UpdateCopyMenuItems updates the state of the copy menu items based on whether a diff is selected
func (a *App) UpdateCopyMenuItems(currentDiffType string) {
	// Both menu items are enabled whenever any diff is selected (not empty)
	// Both panes are equal - users can copy in either direction for any diff
	hasDiff := currentDiffType != ""

	if a.copyLeftMenuItem != nil {
		a.copyLeftMenuItem.Disabled = !hasDiff
	}

	if a.copyRightMenuItem != nil {
		a.copyRightMenuItem.Disabled = !hasDiff
	}

	runtime.MenuUpdateApplicationMenu(a.ctx)
}

// BeginOperationGroup starts a new operation group for transaction-like undo
func (a *App) BeginOperationGroup(description string) string {
	if currentTransaction != nil {
		// If there's an existing transaction, commit it first
		a.CommitOperationGroup()
	}

	currentTransaction = &OperationGroup{
		ID:          uuid.New().String(),
		Description: description,
		Operations:  []SingleOperation{},
		Timestamp:   time.Now(),
	}

	return currentTransaction.ID
}

// CommitOperationGroup finalizes the current operation group and adds it to history
func (a *App) CommitOperationGroup() {
	if currentTransaction == nil || len(currentTransaction.Operations) == 0 {
		currentTransaction = nil
		return
	}

	// Add to history
	operationHistory = append(operationHistory, *currentTransaction)

	// Maintain max history size
	if len(operationHistory) > maxHistorySize {
		operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
	}

	currentTransaction = nil
	a.updateUndoMenuItem()
}

// RollbackOperationGroup cancels the current operation group without adding to history
func (a *App) RollbackOperationGroup() {
	currentTransaction = nil
}

// recordOperation adds an operation to the current group or creates a single-op group
func (a *App) recordOperation(op SingleOperation) {
	// Don't record operations during undo
	if isUndoing {
		return
	}

	if currentTransaction != nil {
		currentTransaction.Operations = append(currentTransaction.Operations, op)
	} else {
		// Create a single-operation group
		group := OperationGroup{
			ID:          uuid.New().String(),
			Description: fmt.Sprintf("%s line", op.Type),
			Operations:  []SingleOperation{op},
			Timestamp:   time.Now(),
		}
		operationHistory = append(operationHistory, group)

		// Maintain max history size
		if len(operationHistory) > maxHistorySize {
			operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
		}

		a.updateUndoMenuItem()
	}
}

// CanUndo returns whether there are operations to undo
func (a *App) CanUndo() bool {
	return len(operationHistory) > 0
}

// GetLastOperationDescription returns the description of the last operation group
func (a *App) GetLastOperationDescription() string {
	if len(operationHistory) == 0 {
		return ""
	}
	return operationHistory[len(operationHistory)-1].Description
}

// UndoLastOperation reverses the last operation group
func (a *App) UndoLastOperation() error {
	if len(operationHistory) == 0 {
		return fmt.Errorf("no operations to undo")
	}

	// Set undoing flag to prevent recording undo operations
	isUndoing = true
	defer func() { isUndoing = false }()

	// Get the last operation group
	lastGroup := operationHistory[len(operationHistory)-1]

	// Remove from history
	operationHistory = operationHistory[:len(operationHistory)-1]

	// Undo operations in reverse order
	for i := len(lastGroup.Operations) - 1; i >= 0; i-- {
		op := lastGroup.Operations[i]

		switch op.Type {
		case OpCopy:
			// Undo a copy by removing the line
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				return fmt.Errorf("failed to undo copy: %w", err)
			}
		case OpRemove:
			// Undo a remove by re-inserting the line
			if err := a.CopyToFile("", op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				return fmt.Errorf("failed to undo remove: %w", err)
			}
		}
	}

	a.updateUndoMenuItem()
	return nil
}

// updateUndoMenuItem updates the undo menu item text and state
func (a *App) updateUndoMenuItem() {
	if a.undoMenuItem == nil {
		return
	}

	if len(operationHistory) > 0 {
		a.undoMenuItem.Label = "Undo"
		a.undoMenuItem.Disabled = false
	} else {
		a.undoMenuItem.Label = "Undo"
		a.undoMenuItem.Disabled = true
	}

	runtime.MenuUpdateApplicationMenu(a.ctx)
}

// StartFileWatching starts monitoring the given files for changes
func (a *App) StartFileWatching(leftPath, rightPath string) {
	a.watcherMutex.Lock()
	defer a.watcherMutex.Unlock()

	// Stop any existing watcher
	a.stopFileWatchingInternal()

	// Create new watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		// Log error but don't fail the comparison
		return
	}

	a.fileWatcher = watcher
	a.leftWatchPath = leftPath
	a.rightWatchPath = rightPath

	// Initialize debouncer if not already done
	if a.changeDebouncer == nil {
		a.changeDebouncer = make(map[string]time.Time)
	}

	// Start watching in a goroutine
	go a.watchFiles()

	// Add paths to watcher
	if err := watcher.Add(leftPath); err != nil {
		// Failed to watch left file
	}

	if err := watcher.Add(rightPath); err != nil {
		// Failed to watch right file
	}
}

// StopFileWatching stops monitoring files for changes
func (a *App) StopFileWatching() {
	a.watcherMutex.Lock()
	defer a.watcherMutex.Unlock()

	a.stopFileWatchingInternal()
}

// stopFileWatchingInternal stops the watcher without locking (must be called with mutex held)
func (a *App) stopFileWatchingInternal() {
	if a.fileWatcher != nil {
		a.fileWatcher.Close()
		a.fileWatcher = nil
	}
	a.leftWatchPath = ""
	a.rightWatchPath = ""
	// Clear debouncer entries to free memory
	if a.changeDebouncer != nil {
		for k := range a.changeDebouncer {
			delete(a.changeDebouncer, k)
		}
	}
}

// watchFiles monitors file changes and emits events
func (a *App) watchFiles() {
	if a.fileWatcher == nil {
		return
	}

	for {
		select {
		case event, ok := <-a.fileWatcher.Events:
			if !ok {
				return
			}

			// Handle write, create, rename, and remove events (atomic saves)
			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create ||
				event.Op&fsnotify.Rename == fsnotify.Rename ||
				event.Op&fsnotify.Remove == fsnotify.Remove {
				a.handleFileChange(event.Name)
			}

		case _, ok := <-a.fileWatcher.Errors:
			if !ok {
				return
			}
			// File watcher error received
		}
	}
}

// handleFileChange processes a file change event
func (a *App) handleFileChange(filePath string) {

	// Debounce rapid changes
	a.watcherMutex.Lock()
	lastChange, exists := a.changeDebouncer[filePath]
	now := time.Now()

	if exists && now.Sub(lastChange) < 500*time.Millisecond {
		a.watcherMutex.Unlock()
		return
	}

	a.changeDebouncer[filePath] = now

	// Determine which side changed
	var side string
	fileName := filepath.Base(filePath)

	if filePath == a.leftWatchPath {
		side = "left"
	} else if filePath == a.rightWatchPath {
		side = "right"
	} else {
		a.watcherMutex.Unlock()
		return
	}

	// Re-add the file to watcher in case it was recreated
	if a.fileWatcher != nil {
		// Remove and re-add to handle atomic saves
		a.fileWatcher.Remove(filePath)

		// For atomic saves, the file might not exist immediately after rename
		// Try to re-add with a small delay
		go func(path string) {
			time.Sleep(100 * time.Millisecond)
			a.watcherMutex.Lock()
			defer a.watcherMutex.Unlock()

			if a.fileWatcher != nil {
				if err := a.fileWatcher.Add(path); err != nil {
					// Log re-watch error for visibility
					if a.ctx != nil {
						runtime.LogErrorf(a.ctx, "Failed to re-watch file %q: %v", path, err)
					}
				}
			}
		}(filePath)
	}

	a.watcherMutex.Unlock()

	// Emit event to frontend (only if we have a valid context)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "file-changed-externally", map[string]string{
			"path":     filePath,
			"side":     side,
			"fileName": fileName,
		})
	}
}
