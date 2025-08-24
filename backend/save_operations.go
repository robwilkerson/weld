package backend

import (
	"context"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
