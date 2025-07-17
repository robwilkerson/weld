package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

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

// App struct
type App struct {
	ctx              context.Context
	InitialLeftFile  string
	InitialRightFile string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetInitialFiles returns the initial file paths passed via command line
func (a *App) GetInitialFiles() (string, string) {
	fmt.Printf("GetInitialFiles called: left='%s', right='%s'\n", a.InitialLeftFile, a.InitialRightFile)
	return a.InitialLeftFile, a.InitialRightFile
}

// SelectFile opens a file dialog and returns the selected file path
func (a *App) SelectFile() (string, error) {
	fmt.Println("SelectFile called")

	// Use the sample files directory for testing
	// TODO: Change back to user's home directory for next release
	defaultDir := "/Users/54695/Development/lookout-software/weld/resources/sample-files"
	fmt.Printf("Opening file dialog in directory: %s\n", defaultDir)

	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                      "Select File to Compare",
		DefaultDirectory:           defaultDir,
		ShowHiddenFiles:            true,
		CanCreateDirectories:       false,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: false,
	})
	fmt.Printf("File dialog result: file='%s', err=%v\n", file, err)
	return file, err
}

// ReadFileContent reads the content of a file and returns it as lines
func (a *App) ReadFileContent(filepath string) ([]string, error) {
	if filepath == "" {
		return []string{}, nil
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
	fmt.Printf("Comparing files: %s vs %s\n", leftPath, rightPath)

	leftLines, err := a.ReadFileContentWithCache(leftPath)
	if err != nil {
		fmt.Printf("Error reading left file: %v\n", err)
		return nil, fmt.Errorf("error reading left file: %w", err)
	}
	fmt.Printf("Left file has %d lines\n", len(leftLines))

	rightLines, err := a.ReadFileContentWithCache(rightPath)
	if err != nil {
		fmt.Printf("Error reading right file: %v\n", err)
		return nil, fmt.Errorf("error reading right file: %w", err)
	}
	fmt.Printf("Right file has %d lines\n", len(rightLines))

	result := a.computeDiff(leftLines, rightLines)
	fmt.Printf("Diff result has %d lines\n", len(result.Lines))

	return result, nil
}

func (a *App) computeDiff(leftLines, rightLines []string) *DiffResult {
	fmt.Printf("Starting LCS-based diff computation: %d vs %d lines\n", len(leftLines), len(rightLines))

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

	fmt.Printf("Diff computation completed: %d result lines\n", len(result.Lines))
	return result
}

// detectModifications post-processes diff results to find removed+added pairs that should be modifications
func (a *App) detectModifications(result *DiffResult) *DiffResult {
	newLines := []DiffLine{}
	i := 0

	for i < len(result.Lines) {
		// Look for a removed line followed by an added line on the same logical line position
		if i < len(result.Lines)-1 &&
			result.Lines[i].Type == "removed" &&
			result.Lines[i+1].Type == "added" {

			removed := result.Lines[i]
			added := result.Lines[i+1]

			// Check if they're similar enough to be considered a modification
			if a.areSimilarLines(removed.LeftLine, added.RightLine) {
				// Create a modified line
				newLines = append(newLines, DiffLine{
					LeftLine:    removed.LeftLine,
					RightLine:   added.RightLine,
					LeftNumber:  removed.LeftNumber,
					RightNumber: added.RightNumber,
					Type:        "modified",
				})
				i += 2 // Skip both the removed and added lines
				continue
			}
		}

		// Not a modification, keep the original line
		newLines = append(newLines, result.Lines[i])
		i++
	}

	result.Lines = newLines
	return result
}

// areSimilarLines checks if two lines are similar enough to be considered a modification
func (a *App) areSimilarLines(left, right string) bool {
	// If one is empty and the other isn't, they're not similar
	if (left == "" && right != "") || (left != "" && right == "") {
		return false
	}

	// Calculate similarity using Levenshtein distance ratio
	distance := a.levenshteinDistance(left, right)
	maxLen := len(left)
	if len(right) > maxLen {
		maxLen = len(right)
	}

	// If lines are very short, require exact match
	if maxLen < 10 {
		return left == right
	}

	// Calculate similarity ratio (1.0 = identical, 0.0 = completely different)
	similarity := 1.0 - float64(distance)/float64(maxLen)

	// Consider lines similar if they're at least 60% similar
	return similarity >= 0.6
}

// levenshteinDistance calculates the edit distance between two strings
func (a *App) levenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}

	// Create a 2D slice for dynamic programming
	d := make([][]int, len(s1)+1)
	for i := range d {
		d[i] = make([]int, len(s2)+1)
	}

	// Initialize first column and row
	for i := 0; i <= len(s1); i++ {
		d[i][0] = i
	}
	for j := 0; j <= len(s2); j++ {
		d[0][j] = j
	}

	// Fill the matrix
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 0
			if s1[i-1] != s2[j-1] {
				cost = 1
			}

			d[i][j] = min(
				d[i-1][j]+1,      // deletion
				d[i][j-1]+1,      // insertion
				d[i-1][j-1]+cost, // substitution
			)
		}
	}

	return d[len(s1)][len(s2)]
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
	fmt.Printf("CopyLineToFile: from %s to %s, line %d: %s\n", sourceFile, targetFile, lineNumber, lineContent)

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

	// Store in memory (we'll implement a cache for unsaved changes)
	return a.storeFileInMemory(targetFile, newLines)
}

// RemoveLineFromFile removes a line from a file in memory
func (a *App) RemoveLineFromFile(targetFile string, lineNumber int) error {
	fmt.Printf("RemoveLineFromFile: from %s, line %d\n", targetFile, lineNumber)

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

	// Create new slice without the line
	newLines := make([]string, 0, len(targetLines)-1)
	newLines = append(newLines, targetLines[:removeIndex]...)
	newLines = append(newLines, targetLines[removeIndex+1:]...)

	// Store in memory
	return a.storeFileInMemory(targetFile, newLines)
}

// In-memory storage for unsaved file changes
var fileCache = make(map[string][]string)

func (a *App) storeFileInMemory(filepath string, lines []string) error {
	fileCache[filepath] = lines
	fmt.Printf("Stored %d lines in memory for %s\n", len(lines), filepath)
	return nil
}

// ReadFileContent now checks memory cache first
func (a *App) ReadFileContentWithCache(filepath string) ([]string, error) {
	// Check memory cache first
	if cachedLines, exists := fileCache[filepath]; exists {
		fmt.Printf("Reading %d lines from cache for %s\n", len(cachedLines), filepath)
		return cachedLines, nil
	}

	// Fall back to reading from disk
	return a.ReadFileContent(filepath)
}

// DiscardAllChanges clears all cached file changes
func (a *App) DiscardAllChanges() error {
	// Clear the entire cache
	fileCache = make(map[string][]string)
	fmt.Println("Discarded all cached changes")
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
	fmt.Printf("Saved file %s and removed from cache\n", filepath)

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
