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
	ctx context.Context
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

// SelectFile opens a file dialog and returns the selected file path
func (a *App) SelectFile() (string, error) {
	fmt.Println("SelectFile called")
	
	// Use the full path to the sample files directory
	defaultDir := "/Users/54695/Development/lookout-software/weld/tests/sample-files"
	fmt.Printf("Opening file dialog in directory: %s\n", defaultDir)
	
	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                      "Select File to Compare",
		DefaultDirectory:           defaultDir,
		ShowHiddenFiles:           true,
		CanCreateDirectories:      false,
		ResolvesAliases:           true,
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
	result := &DiffResult{Lines: []DiffLine{}}
	
	// Use a simplified diff approach that handles insertions/deletions properly
	leftIdx, rightIdx := 0, 0
	
	for leftIdx < len(leftLines) || rightIdx < len(rightLines) {
		if leftIdx >= len(leftLines) {
			// Only right lines remain - all are added
			result.Lines = append(result.Lines, DiffLine{
				LeftLine:    "",
				RightLine:   rightLines[rightIdx],
				LeftNumber:  0,
				RightNumber: rightIdx + 1,
				Type:        "added",
			})
			rightIdx++
		} else if rightIdx >= len(rightLines) {
			// Only left lines remain - all are removed
			result.Lines = append(result.Lines, DiffLine{
				LeftLine:    leftLines[leftIdx],
				RightLine:   "",
				LeftNumber:  leftIdx + 1,
				RightNumber: 0,
				Type:        "removed",
			})
			leftIdx++
		} else if leftLines[leftIdx] == rightLines[rightIdx] {
			// Lines match
			result.Lines = append(result.Lines, DiffLine{
				LeftLine:    leftLines[leftIdx],
				RightLine:   rightLines[rightIdx],
				LeftNumber:  leftIdx + 1,
				RightNumber: rightIdx + 1,
				Type:        "same",
			})
			leftIdx++
			rightIdx++
		} else {
			// Lines don't match - look ahead to see if it's an insertion or deletion
			rightMatchIdx := a.findNextMatch(rightLines, rightIdx+1, leftLines[leftIdx])
			leftMatchIdx := a.findNextMatch(leftLines, leftIdx+1, rightLines[rightIdx])
			
			if rightMatchIdx != -1 && (leftMatchIdx == -1 || rightMatchIdx-rightIdx <= leftMatchIdx-leftIdx) {
				// Found the left line later in right - treat current right line as added
				result.Lines = append(result.Lines, DiffLine{
					LeftLine:    "",
					RightLine:   rightLines[rightIdx],
					LeftNumber:  0,
					RightNumber: rightIdx + 1,
					Type:        "added",
				})
				rightIdx++
			} else if leftMatchIdx != -1 {
				// Found the right line later in left - treat current left line as removed
				result.Lines = append(result.Lines, DiffLine{
					LeftLine:    leftLines[leftIdx],
					RightLine:   "",
					LeftNumber:  leftIdx + 1,
					RightNumber: 0,
					Type:        "removed",
				})
				leftIdx++
			} else {
				// No matches found - treat as modified
				result.Lines = append(result.Lines, DiffLine{
					LeftLine:    leftLines[leftIdx],
					RightLine:   rightLines[rightIdx],
					LeftNumber:  leftIdx + 1,
					RightNumber: rightIdx + 1,
					Type:        "modified",
				})
				leftIdx++
				rightIdx++
			}
		}
	}

	fmt.Printf("Diff computation completed: %d result lines\n", len(result.Lines))
	return result
}

func (a *App) findNextMatch(lines []string, startIdx int, target string) int {
	// Look ahead up to 10 lines to find a match
	for i := startIdx; i < len(lines) && i < startIdx+10; i++ {
		if strings.TrimSpace(lines[i]) == strings.TrimSpace(target) {
			return i
		}
	}
	return -1
}

// CopyLineToFile copies a line from one file to another in memory
func (a *App) CopyLineToFile(sourceFile, targetFile string, lineNumber int, lineContent string) error {
	fmt.Printf("CopyLineToFile: from %s to %s, line %d: %s\n", sourceFile, targetFile, lineNumber, lineContent)
	
	// Read target file
	targetLines, err := a.ReadFileContent(targetFile)
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
	
	// Read target file
	targetLines, err := a.ReadFileContent(targetFile)
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

// SaveFile saves the in-memory changes to disk
func (a *App) SaveFile(filepath string) error {
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
