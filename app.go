package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type DiffLine struct {
	LeftLine    string `json:"leftLine"`
	RightLine   string `json:"rightLine"`
	LeftNumber  int    `json:"leftNumber"`
	RightNumber int    `json:"rightNumber"`
	Type        string `json:"type"` // "same", "added", "removed", "modified"
}

type DiffResult struct {
	Lines []DiffLine `json:"lines"`
}

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
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		minimapVisible: true, // Default to showing minimap
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetInitialFiles returns the initial file paths passed via command line
func (a *App) GetInitialFiles() (string, string) {
	return a.InitialLeftFile, a.InitialRightFile
}

// SelectFile opens a file dialog and returns the selected file path
func (a *App) SelectFile() (string, error) {

	// Use the sample files directory for testing, relative to current working directory
	// This works regardless of the user's home directory path
	var defaultDir string
	cwd, err := os.Getwd()
	if err != nil {
		// Fallback to user's home directory
		homeDir, homeErr := os.UserHomeDir()
		if homeErr != nil {
			defaultDir = ""
		} else {
			defaultDir = homeDir
		}
	} else {
		defaultDir = filepath.Join(cwd, "resources", "sample-files", "supported-types")
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
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	return lines, scanner.Err()
}

// CompareFiles compares two files and returns diff results
func (a *App) CompareFiles(leftPath, rightPath string) (*DiffResult, error) {

	leftLines, err := a.ReadFileContentWithCache(leftPath)
	if err != nil {
		return nil, fmt.Errorf("error reading left file: %w", err)
	}

	rightLines, err := a.ReadFileContentWithCache(rightPath)
	if err != nil {
		return nil, fmt.Errorf("error reading right file: %w", err)
	}

	result := a.computeDiff(leftLines, rightLines)

	return result, nil
}

func (a *App) computeDiff(leftLines, rightLines []string) *DiffResult {

	// Compute the LCS table
	m, n := len(leftLines), len(rightLines)
	lcs := make([][]int, m+1)
	for i := range lcs {
		lcs[i] = make([]int, n+1)
	}

	// Fill the LCS table
	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			if leftLines[i-1] == rightLines[j-1] {
				lcs[i][j] = lcs[i-1][j-1] + 1
			} else {
				if lcs[i-1][j] > lcs[i][j-1] {
					lcs[i][j] = lcs[i-1][j]
				} else {
					lcs[i][j] = lcs[i][j-1]
				}
			}
		}
	}

	// Backtrack to build the diff
	result := &DiffResult{Lines: []DiffLine{}}
	i, j := m, n
	var diffLines []DiffLine

	for i > 0 || j > 0 {
		if i > 0 && j > 0 && leftLines[i-1] == rightLines[j-1] {
			// Lines match
			diffLines = append(diffLines, DiffLine{
				LeftLine:    leftLines[i-1],
				RightLine:   rightLines[j-1],
				LeftNumber:  i,
				RightNumber: j,
				Type:        "same",
			})
			i--
			j--
		} else if j > 0 && (i == 0 || lcs[i][j-1] >= lcs[i-1][j]) {
			// Line added in right
			diffLines = append(diffLines, DiffLine{
				LeftLine:    "",
				RightLine:   rightLines[j-1],
				LeftNumber:  0,
				RightNumber: j,
				Type:        "added",
			})
			j--
		} else if i > 0 {
			// Line removed from left
			diffLines = append(diffLines, DiffLine{
				LeftLine:    leftLines[i-1],
				RightLine:   "",
				LeftNumber:  i,
				RightNumber: 0,
				Type:        "removed",
			})
			i--
		}
	}

	// Reverse the diff lines (we built them backwards)
	for i := len(diffLines) - 1; i >= 0; i-- {
		result.Lines = append(result.Lines, diffLines[i])
	}

	// Post-process to detect modifications (removed followed by added)
	result = a.detectModifications(result)

	return result
}

// detectModifications post-processes diff results to find removed+added pairs that should be modifications
func (a *App) detectModifications(result *DiffResult) *DiffResult {
	newLines := []DiffLine{}
	i := 0

	for i < len(result.Lines) {
		// Look for sequences of removed lines that might be followed by added lines
		if i < len(result.Lines) && result.Lines[i].Type == "removed" {
			// Count consecutive removed lines
			var removedLines []DiffLine
			for i < len(result.Lines) && result.Lines[i].Type == "removed" {
				removedLines = append(removedLines, result.Lines[i])
				i++
			}

			// Check if we have the same number of added lines following
			if i < len(result.Lines) && result.Lines[i].Type == "added" {
				addedStart := i
				var addedLines []DiffLine
				for i < len(result.Lines) && result.Lines[i].Type == "added" && len(addedLines) < len(removedLines) {
					addedLines = append(addedLines, result.Lines[i])
					i++
				}

				// If we have matching counts and all are similar, treat as modifications
				if len(removedLines) == len(addedLines) {
					allSimilar := true
					for j := 0; j < len(removedLines); j++ {
						if !a.areSimilarLines(removedLines[j].LeftLine, addedLines[j].RightLine) {
							allSimilar = false
							break
						}
					}

					if allSimilar {
						// Create modified lines with matching line numbers
						for j := 0; j < len(removedLines); j++ {
							newLines = append(newLines, DiffLine{
								LeftLine:    removedLines[j].LeftLine,
								RightLine:   addedLines[j].RightLine,
								LeftNumber:  removedLines[j].LeftNumber,
								RightNumber: addedLines[j].RightNumber, // Use the actual right line number
								Type:        "modified",
							})
						}
						continue
					}
				}

				// Not all modifications - add removed lines and rewind to handle added lines
				for _, line := range removedLines {
					newLines = append(newLines, line)
				}
				i = addedStart
				continue
			}

			// Just removed lines with no added lines following
			for _, line := range removedLines {
				newLines = append(newLines, line)
			}
			continue
		}

		// Handle all other lines
		newLines = append(newLines, result.Lines[i])
		i++
	}

	result.Lines = newLines
	return result
}

// areSimilarLines checks if two lines are similar enough to be considered a modification
func (a *App) areSimilarLines(left, right string) bool {
	// If either is empty (including both empty), they're not similar
	if left == "" || right == "" {
		return false
	}

	// For whitespace-only differences, trim and compare
	leftTrimmed := strings.TrimSpace(left)
	rightTrimmed := strings.TrimSpace(right)
	if leftTrimmed == rightTrimmed {
		return true
	}

	// Calculate similarity using Levenshtein distance ratio
	distance := a.levenshteinDistance(left, right)

	// Use rune length for proper Unicode handling
	leftLen := len([]rune(left))
	rightLen := len([]rune(right))
	maxLen := leftLen
	if rightLen > maxLen {
		maxLen = rightLen
	}

	// If lines are very short, require exact match
	if maxLen < 4 {
		return left == right
	}

	// Calculate similarity ratio (1.0 = identical, 0.0 = completely different)
	similarity := 1.0 - float64(distance)/float64(maxLen)

	// Consider lines similar if they're at least 50% similar
	return similarity >= 0.50
}

// levenshteinDistance calculates the edit distance between two strings
func (a *App) levenshteinDistance(s1, s2 string) int {
	// Convert strings to rune slices for proper Unicode handling
	r1 := []rune(s1)
	r2 := []rune(s2)

	if len(r1) == 0 {
		return len(r2)
	}
	if len(r2) == 0 {
		return len(r1)
	}

	// Create a 2D slice for dynamic programming
	d := make([][]int, len(r1)+1)
	for i := range d {
		d[i] = make([]int, len(r2)+1)
	}

	// Initialize first column and row
	for i := 0; i <= len(r1); i++ {
		d[i][0] = i
	}
	for j := 0; j <= len(r2); j++ {
		d[0][j] = j
	}

	// Fill the matrix
	for i := 1; i <= len(r1); i++ {
		for j := 1; j <= len(r2); j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}

			d[i][j] = min(
				d[i-1][j]+1,      // deletion
				d[i][j-1]+1,      // insertion
				d[i-1][j-1]+cost, // substitution
			)
		}
	}

	return d[len(r1)][len(r2)]
}

// min returns the minimum of three integers
func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

func (a *App) findNextMatch(lines []string, startIdx int, target string) int {
	// Look ahead up to 50 lines to find a match (increased from 10 to handle larger insertions)
	for i := startIdx; i < len(lines) && i < startIdx+50; i++ {
		if strings.TrimSpace(lines[i]) == strings.TrimSpace(target) {
			return i
		}
	}
	return -1
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
