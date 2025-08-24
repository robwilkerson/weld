package diff

import (
	"strings"
)

// LCS implements the Longest Common Subsequence diff algorithm.
type LCS struct {
	config Config
}

// NewLCS creates a new LCS diff algorithm with the given configuration
func NewLCS(config Config) *LCS {
	return &LCS{config: config}
}

// NewLCSDefault creates a new LCS diff algorithm with default configuration
func NewLCSDefault() *LCS {
	return NewLCS(DefaultConfig())
}

// ComputeDiff compares two sets of lines and returns the diff result
func (l *LCS) ComputeDiff(leftLines, rightLines []string) *DiffResult {
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
	result = l.detectModifications(result)

	return result
}

// detectModifications post-processes diff results to find removed+added pairs that should be modifications
func (l *LCS) detectModifications(result *DiffResult) *DiffResult {
	newLines := []DiffLine{}
	i := 0

	for i < len(result.Lines) {
		// Look for sequences of removed lines that might be followed by added lines
		if i < len(result.Lines) && result.Lines[i].Type == "removed" {
			// Count consecutive removed lines
			var removedLines []DiffLine
			for i < len(result.Lines) && result.Lines[i].Type == "removed" {
				removedLines = append(removedLines, result.Lines[i])
				i++
			}

			// Check if we have the same number of added lines following
			if i < len(result.Lines) && result.Lines[i].Type == "added" {
				addedStart := i
				var addedLines []DiffLine
				for i < len(result.Lines) && result.Lines[i].Type == "added" && len(addedLines) < len(removedLines) {
					addedLines = append(addedLines, result.Lines[i])
					i++
				}

				// If we have matching counts and all are similar, treat as modifications
				if len(removedLines) == len(addedLines) {
					allSimilar := true
					for j := 0; j < len(removedLines); j++ {
						if !l.areSimilarLines(removedLines[j].LeftLine, addedLines[j].RightLine) {
							allSimilar = false
							break
						}
					}

					if allSimilar {
						// Create modified lines with matching line numbers
						for j := 0; j < len(removedLines); j++ {
							newLines = append(newLines, DiffLine{
								LeftLine:    removedLines[j].LeftLine,
								RightLine:   addedLines[j].RightLine,
								LeftNumber:  removedLines[j].LeftNumber,
								RightNumber: addedLines[j].RightNumber,
								Type:        "modified",
							})
						}
						continue
					}
				}

				// Not all modifications - add removed lines and rewind to handle added lines
				for _, line := range removedLines {
					newLines = append(newLines, line)
				}
				i = addedStart
				continue
			}

			// Just removed lines with no added lines following
			for _, line := range removedLines {
				newLines = append(newLines, line)
			}
			continue
		}

		// Handle all other lines
		newLines = append(newLines, result.Lines[i])
		i++
	}

	result.Lines = newLines
	return result
}

// areSimilarLines checks if two lines are similar enough to be considered a modification
func (l *LCS) areSimilarLines(left, right string) bool {
	// If either is empty (including both empty), they're not similar
	if left == "" || right == "" {
		return false
	}

	// For whitespace-only differences, trim and compare
	leftTrimmed := strings.TrimSpace(left)
	rightTrimmed := strings.TrimSpace(right)
	if leftTrimmed == rightTrimmed {
		return true
	}

	// For short lines, require exact match
	if len(left) < l.config.MinLineLength || len(right) < l.config.MinLineLength {
		return left == right
	}

	// Use Levenshtein distance for similarity
	distance := levenshteinDistance(left, right)
	maxLen := max(len(left), len(right))
	similarity := 1.0 - float64(distance)/float64(maxLen)

	return similarity >= l.config.SimilarityThreshold
}

// levenshteinDistance calculates the Levenshtein distance between two strings
func levenshteinDistance(s1, s2 string) int {
	if s1 == s2 {
		return 0
	}

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

	// Initialize base cases
	for i := 0; i <= len(s1); i++ {
		d[i][0] = i
	}
	for j := 0; j <= len(s2); j++ {
		d[0][j] = j
	}

	// Fill the table
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 0
			if s1[i-1] != s2[j-1] {
				cost = 1
			}
			d[i][j] = min3(
				d[i-1][j]+1,      // deletion
				d[i][j-1]+1,      // insertion
				d[i-1][j-1]+cost, // substitution
			)
		}
	}

	return d[len(s1)][len(s2)]
}

// Helper functions
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min3(a, b, c int) int {
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
