package backend

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// In-memory storage for unsaved file changes
var fileCache = make(map[string][]string)

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

	// Empty files are considered text
	if n == 0 {
		return false, nil
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

// ReadFileContentWithCache checks memory cache first before reading from disk
func (a *App) ReadFileContentWithCache(filepath string) ([]string, error) {
	// Check memory cache first
	if cachedLines, exists := fileCache[filepath]; exists {
		return cachedLines, nil
	}

	// Fall back to reading from disk
	return a.ReadFileContent(filepath)
}

// storeFileInMemory stores file lines in the memory cache
func (a *App) storeFileInMemory(filepath string, lines []string) error {
	fileCache[filepath] = lines
	return nil
}

// CopyToFile copies a line from source to target file in memory
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

// DiscardAllChanges clears all cached file changes
func (a *App) DiscardAllChanges() error {
	// Clear the entire cache
	fileCache = make(map[string][]string)
	return nil
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
