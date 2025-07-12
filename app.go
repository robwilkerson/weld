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
	
	leftLines, err := a.ReadFileContent(leftPath)
	if err != nil {
		fmt.Printf("Error reading left file: %v\n", err)
		return nil, fmt.Errorf("error reading left file: %w", err)
	}
	fmt.Printf("Left file has %d lines\n", len(leftLines))

	rightLines, err := a.ReadFileContent(rightPath)
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
