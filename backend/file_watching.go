package backend

import (
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// StartFileWatching starts monitoring the given files for changes
func (a *App) StartFileWatching(leftPath, rightPath string) {
	a.watcherMutex.Lock()

	// Get reference to old watcher before clearing
	oldWatcher := a.fileWatcher

	// Stop any existing watcher (just clears references)
	a.stopFileWatchingInternal()

	// Create new watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		a.watcherMutex.Unlock()
		// Close old watcher if exists (after releasing mutex)
		if oldWatcher != nil {
			oldWatcher.Close()
		}
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

	a.watcherMutex.Unlock()

	// Close old watcher after releasing mutex to avoid deadlock
	if oldWatcher != nil {
		oldWatcher.Close()
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
	watcher := a.fileWatcher
	a.fileWatcher = nil
	a.leftWatchPath = ""
	a.rightWatchPath = ""
	// Clear debouncer entries to free memory
	if a.changeDebouncer != nil {
		for k := range a.changeDebouncer {
			delete(a.changeDebouncer, k)
		}
	}
	a.watcherMutex.Unlock()

	// Close watcher after releasing the mutex to avoid deadlock
	if watcher != nil {
		watcher.Close()
	}
}

// stopFileWatchingInternal stops the watcher without locking (must be called with mutex held)
func (a *App) stopFileWatchingInternal() {
	if a.fileWatcher != nil {
		// Note: We can't safely close the watcher here while holding the mutex
		// Instead, just clear the reference and let the caller handle closing
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
	watcher := a.fileWatcher
	a.watcherMutex.Unlock()

	if watcher != nil {
		// Remove and re-add to handle atomic saves
		// Note: We do this after unlocking to avoid deadlock on Windows
		watcher.Remove(filePath)

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

	// Emit event to frontend (only if we have a valid context)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "file-changed-externally", map[string]string{
			"path":     filePath,
			"side":     side,
			"fileName": fileName,
		})
	}
}
