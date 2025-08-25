// Package diff provides diff algorithms for comparing text files
package diff

// DiffLine represents a single line in a diff result
type DiffLine struct {
	LeftLine    string `json:"leftLine"`
	RightLine   string `json:"rightLine"`
	LeftNumber  int    `json:"leftNumber"`
	RightNumber int    `json:"rightNumber"`
	Type        string `json:"type"` // "same", "added", "removed", "modified"
}

// DiffResult contains the complete diff between two files
type DiffResult struct {
	Lines []DiffLine `json:"lines"`
}

// Algorithm defines the interface for diff algorithms
type Algorithm interface {
	// ComputeDiff compares two sets of lines and returns the diff result
	ComputeDiff(leftLines, rightLines []string) *DiffResult
}

// Config holds configuration for diff algorithms
type Config struct {
	// SimilarityThreshold is the minimum similarity ratio (0.0-1.0) for lines to be considered modifications
	SimilarityThreshold float64
	// MinLineLength is the minimum line length to apply similarity checking
	MinLineLength int
}

// DefaultConfig returns the default configuration
func DefaultConfig() Config {
	return Config{
		SimilarityThreshold: 0.7,
		MinLineLength:       10,
	}
}
