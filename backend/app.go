package backend

import (
	"context"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/menu"
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
