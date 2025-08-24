package backend

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"weld/backend/diff"
)

// DiffLine is now imported from the diff package
type DiffLine = diff.DiffLine

// DiffResult is now imported from the diff package
type DiffResult = diff.DiffResult

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

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Shutdown is called when the app is shutting down
func (a *App) Shutdown(ctx context.Context) {
	// Stop file watching
	a.StopFileWatching()
}

// GetContext returns the app's context
func (a *App) GetContext() context.Context {
	return a.ctx
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

	// Start watching in a goroutine with the watcher passed as parameter
	go a.watchFiles(watcher)

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
func (a *App) watchFiles(watcher *fsnotify.Watcher) {
	for {
		select {
		case event, ok := <-watcher.Events:
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

		case _, ok := <-watcher.Errors:
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
