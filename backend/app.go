package backend

import (
	"context"
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
