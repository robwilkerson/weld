package backend

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SaveChanges saves the in-memory changes to disk
func (a *App) SaveChanges(filepath string) error {
	fileCacheMutex.RLock()
	cachedLines, exists := fileCache[filepath]
	fileCacheMutex.RUnlock()

	if !exists {
		return fmt.Errorf("no unsaved changes for file: %s", filepath)
	}

	// Write to file using buffered I/O for better performance
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	w := bufio.NewWriter(file)
	if _, err := w.WriteString(strings.Join(cachedLines, "\n")); err != nil {
		return fmt.Errorf("failed to write content: %w", err)
	}
	if err := w.Flush(); err != nil {
		return fmt.Errorf("failed to flush content: %w", err)
	}

	// Remove from cache after successful save
	fileCacheMutex.Lock()
	delete(fileCache, filepath)
	fileCacheMutex.Unlock()

	return nil
}

// OnBeforeClose is called when the application is about to quit
// Returns true to prevent closing, false to allow normal shutdown
func (a *App) OnBeforeClose(ctx context.Context) (prevent bool) {
	// Check if there are unsaved changes in memory cache
	fileCacheMutex.RLock()
	hasUnsaved := len(fileCache) > 0
	fileCacheMutex.RUnlock()

	if hasUnsaved {
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
	// Aggregate errors instead of failing on first error
	var errs []string
	for _, filepath := range filesToSave {
		if err := a.SaveChanges(filepath); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", filepath, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("one or more saves failed:\n%s", strings.Join(errs, "\n"))
	}

	// Clear any remaining unsaved files from cache if user chose not to save them
	fileCacheMutex.Lock()
	for filepath := range fileCache {
		delete(fileCache, filepath)
	}
	fileCacheMutex.Unlock()

	// Quit the application
	runtime.Quit(a.ctx)
	return nil
}

// QuitWithoutSaving clears the cache and quits without saving
func (a *App) QuitWithoutSaving() {
	// Clear all unsaved changes
	fileCacheMutex.Lock()
	for filepath := range fileCache {
		delete(fileCache, filepath)
	}
	fileCacheMutex.Unlock()

	// Quit the application
	runtime.Quit(a.ctx)
}
