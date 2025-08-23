package diff

import (
	"testing"
)

func TestLCS_ComputeDiff(t *testing.T) {
	lcs := NewLCSDefault()

	// Test identical content
	t.Run("identical content", func(t *testing.T) {
		left := []string{"line1", "line2", "line3"}
		right := []string{"line1", "line2", "line3"}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Error("ComputeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("ComputeDiff returned %d lines, expected 3", len(result.Lines))
		}

		for i, line := range result.Lines {
			if line.Type != "same" {
				t.Errorf("Line %d type is %s, expected 'same'", i, line.Type)
			}
		}
	})

	// Test addition
	t.Run("addition", func(t *testing.T) {
		left := []string{"line1", "line2"}
		right := []string{"line1", "line2", "line3"}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Error("ComputeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("ComputeDiff returned %d lines, expected 3", len(result.Lines))
		}

		// Check types
		expectedTypes := []string{"same", "same", "added"}
		for i, line := range result.Lines {
			if line.Type != expectedTypes[i] {
				t.Errorf("Line %d type is %s, expected %s", i, line.Type, expectedTypes[i])
			}
		}
	})

	// Test removal
	t.Run("removal", func(t *testing.T) {
		left := []string{"line1", "line2", "line3"}
		right := []string{"line1", "line3"}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Error("ComputeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("ComputeDiff returned %d lines, expected 3", len(result.Lines))
		}

		// Should have same, removed, same
		expectedTypes := []string{"same", "removed", "same"}
		for i, line := range result.Lines {
			if line.Type != expectedTypes[i] {
				t.Errorf("Line %d type is %s, expected %s", i, line.Type, expectedTypes[i])
			}
		}
	})

	// Test empty files
	t.Run("empty files", func(t *testing.T) {
		left := []string{}
		right := []string{}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Error("ComputeDiff returned nil")
			return
		}

		if len(result.Lines) != 0 {
			t.Errorf("ComputeDiff returned %d lines, expected 0", len(result.Lines))
		}
	})
}

func TestLCS_detectModifications(t *testing.T) {
	lcs := NewLCSDefault()

	t.Run("detect simple modification", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "same", LeftLine: "line1", RightLine: "line1", LeftNumber: 1, RightNumber: 1},
				{Type: "removed", LeftLine: "const value = 42", LeftNumber: 2},
				{Type: "added", RightLine: "const value = 43", RightNumber: 2},
				{Type: "same", LeftLine: "line3", RightLine: "line3", LeftNumber: 3, RightNumber: 3},
			},
		}

		result := lcs.detectModifications(input)

		if len(result.Lines) != 3 {
			t.Errorf("Expected 3 lines, got %d", len(result.Lines))
		}

		// Check that removed+added became modified
		if result.Lines[1].Type != "modified" {
			t.Errorf("Expected 'modified', got %s", result.Lines[1].Type)
		}
		if result.Lines[1].LeftLine != "const value = 42" {
			t.Errorf("Expected left line 'const value = 42', got %s", result.Lines[1].LeftLine)
		}
		if result.Lines[1].RightLine != "const value = 43" {
			t.Errorf("Expected right line 'const value = 43', got %s", result.Lines[1].RightLine)
		}
	})

	t.Run("non-similar lines remain separate", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "removed", LeftLine: "completely different", LeftNumber: 1},
				{Type: "added", RightLine: "nothing alike", RightNumber: 1},
			},
		}

		result := lcs.detectModifications(input)

		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		if result.Lines[0].Type != "removed" {
			t.Errorf("Expected first line to remain 'removed', got %s", result.Lines[0].Type)
		}
		if result.Lines[1].Type != "added" {
			t.Errorf("Expected second line to remain 'added', got %s", result.Lines[1].Type)
		}
	})

	t.Run("multiple modifications", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "removed", LeftLine: "const value = 1", LeftNumber: 1},
				{Type: "removed", LeftLine: "const other = 2", LeftNumber: 2},
				{Type: "added", RightLine: "const value = 2", RightNumber: 1},
				{Type: "added", RightLine: "const other = 3", RightNumber: 2},
			},
		}

		result := lcs.detectModifications(input)

		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		if result.Lines[0].Type != "modified" {
			t.Errorf("Expected first modification, got %s", result.Lines[0].Type)
		}
		if result.Lines[1].Type != "modified" {
			t.Errorf("Expected second modification, got %s", result.Lines[1].Type)
		}
	})

	t.Run("removed at end", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "same", LeftLine: "line1", RightLine: "line1", LeftNumber: 1, RightNumber: 1},
				{Type: "removed", LeftLine: "line2", LeftNumber: 2},
			},
		}

		result := lcs.detectModifications(input)

		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		if result.Lines[1].Type != "removed" {
			t.Errorf("Expected 'removed', got %s", result.Lines[1].Type)
		}
	})

	t.Run("added at end", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "same", LeftLine: "line1", RightLine: "line1", LeftNumber: 1, RightNumber: 1},
				{Type: "added", RightLine: "line2", RightNumber: 2},
			},
		}

		result := lcs.detectModifications(input)

		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		if result.Lines[1].Type != "added" {
			t.Errorf("Expected 'added', got %s", result.Lines[1].Type)
		}
	})

	t.Run("empty input", func(t *testing.T) {
		input := &DiffResult{Lines: []DiffLine{}}
		result := lcs.detectModifications(input)

		if len(result.Lines) != 0 {
			t.Errorf("Expected 0 lines, got %d", len(result.Lines))
		}
	})
}

func TestLCS_areSimilarLines(t *testing.T) {
	lcs := NewLCSDefault()

	tests := []struct {
		name     string
		left     string
		right    string
		expected bool
	}{
		// Short lines - require exact match
		{"short identical", "hi", "hi", true},
		{"short different", "hi", "bye", false},
		{"short one char diff", "abc", "abd", false},
		{"short empty vs non-empty", "", "hi", false},
		{"short non-empty vs empty", "hi", "", false},
		{"short both empty", "", "", false},

		// Longer lines - use similarity threshold
		{"identical long", "hello world test", "hello world test", true},
		{"high similarity", "const value = 42", "const value = 43", true},
		{"medium similarity", "hello world test", "hello world best", true},
		{"low similarity", "hello world", "goodbye mars", false},
		{"completely different", "function abc()", "let x = 5", false},
		{"variable rename", "let myVariable = 42", "let myVar = 42", true},
		{"function signature", "function test(a, b)", "function test(a, b, c)", true},
		{"comment vs code", "// This is a comment", "let x = 5", false},
		{"whitespace change", "    let x = 5", "let x = 5", true},
		{"case change", "Hello World", "hello world", true},

		// Edge cases
		{"one empty long vs content", "", "this is a long line with content", false},
		{"content vs empty long", "this is a long line with content", "", false},
		{"very similar", "abcdefghijklmnop", "abcdefghijklmnpq", true},
		{"barely similar", "abcdefghij", "abcdefXYZj", true},        // 70% similar
		{"just under threshold", "abcdefghij", "abcXYZWVUj", false}, // ~60% similar
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := lcs.areSimilarLines(tt.left, tt.right)
			if result != tt.expected {
				t.Errorf("areSimilarLines(%q, %q) = %v, want %v",
					tt.left, tt.right, result, tt.expected)
			}
		})
	}
}

func Test_levenshteinDistance(t *testing.T) {
	tests := []struct {
		name     string
		s1       string
		s2       string
		expected int
	}{
		{"both empty", "", "", 0},
		{"first empty", "", "abc", 3},
		{"second empty", "abc", "", 3},
		{"identical", "abc", "abc", 0},
		{"single char diff", "abc", "abd", 1},
		{"classic example", "kitten", "sitting", 3},
		{"case sensitive", "Hello", "hello", 1},
		{"completely different", "abc", "xyz", 3},
		{"one longer", "test", "testing", 3},
		{"unicode", "café", "cafe", 2}, // É is 2 bytes, so distance is 2
		{"numbers", "123", "124", 1},
		{"special chars", "a-b", "a_b", 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := levenshteinDistance(tt.s1, tt.s2)
			if result != tt.expected {
				t.Errorf("levenshteinDistance(%q, %q) = %d, want %d",
					tt.s1, tt.s2, result, tt.expected)
			}
		})
	}
}

func Test_min3(t *testing.T) {
	tests := []struct {
		name     string
		a, b, c  int
		expected int
	}{
		{"a is minimum", 1, 2, 3, 1},
		{"b is minimum", 3, 1, 2, 1},
		{"c is minimum", 3, 2, 1, 1},
		{"all equal", 2, 2, 2, 2},
		{"negative numbers", -1, -2, -3, -3},
		{"mixed signs", -1, 0, 1, -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := min3(tt.a, tt.b, tt.c)
			if result != tt.expected {
				t.Errorf("min3(%d, %d, %d) = %d, want %d",
					tt.a, tt.b, tt.c, result, tt.expected)
			}
		})
	}
}

func TestNewLCS(t *testing.T) {
	t.Run("with custom config", func(t *testing.T) {
		config := Config{
			SimilarityThreshold: 0.8,
			MinLineLength:       5,
		}
		lcs := NewLCS(config)
		if lcs.config.SimilarityThreshold != 0.8 {
			t.Errorf("Expected similarity threshold 0.8, got %f", lcs.config.SimilarityThreshold)
		}
		if lcs.config.MinLineLength != 5 {
			t.Errorf("Expected min line length 5, got %d", lcs.config.MinLineLength)
		}
	})

	t.Run("with default config", func(t *testing.T) {
		lcs := NewLCSDefault()
		if lcs.config.SimilarityThreshold != 0.7 {
			t.Errorf("Expected default similarity threshold 0.7, got %f", lcs.config.SimilarityThreshold)
		}
		if lcs.config.MinLineLength != 10 {
			t.Errorf("Expected default min line length 10, got %d", lcs.config.MinLineLength)
		}
	})
}

func TestLCS_ComplexScenarios(t *testing.T) {
	lcs := NewLCSDefault()

	t.Run("interleaved changes", func(t *testing.T) {
		left := []string{
			"unchanged1",
			"will be removed",
			"unchanged2",
			"will change A",
			"unchanged3",
		}
		right := []string{
			"unchanged1",
			"unchanged2",
			"will change B",
			"added line",
			"unchanged3",
		}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Fatal("ComputeDiff returned nil")
		}

		// Verify we have the right number of lines
		if len(result.Lines) != 6 {
			t.Errorf("Expected 6 lines, got %d", len(result.Lines))
		}

		// Check specific line types
		typeCount := make(map[string]int)
		for _, line := range result.Lines {
			typeCount[line.Type]++
		}

		if typeCount["same"] != 3 {
			t.Errorf("Expected 3 same lines, got %d", typeCount["same"])
		}
		if typeCount["removed"] != 1 {
			t.Errorf("Expected 1 removed line, got %d", typeCount["removed"])
		}
		if typeCount["modified"] != 1 {
			t.Errorf("Expected 1 modified line, got %d", typeCount["modified"])
		}
		if typeCount["added"] != 1 {
			t.Errorf("Expected 1 added line, got %d", typeCount["added"])
		}
	})

	t.Run("all lines modified", func(t *testing.T) {
		left := []string{
			"let x = 1",
			"let y = 2",
			"let z = 3",
		}
		right := []string{
			"let x = 10",
			"let y = 20",
			"let z = 30",
		}

		result := lcs.ComputeDiff(left, right)
		if result == nil {
			t.Fatal("ComputeDiff returned nil")
		}

		// With the current LCS algorithm, these are detected as removed+added
		// because no lines match exactly
		removedCount := 0
		addedCount := 0
		for _, line := range result.Lines {
			if line.Type == "removed" {
				removedCount++
			}
			if line.Type == "added" {
				addedCount++
			}
		}

		if removedCount != 3 {
			t.Errorf("Expected 3 removed lines, got %d", removedCount)
		}
		if addedCount != 3 {
			t.Errorf("Expected 3 added lines, got %d", addedCount)
		}
	})
}

func TestLCS_LineNumbers(t *testing.T) {
	lcs := NewLCSDefault()

	left := []string{"a", "b", "c"}
	right := []string{"a", "x", "b", "c"}

	result := lcs.ComputeDiff(left, right)
	if result == nil {
		t.Fatal("ComputeDiff returned nil")
	}

	expected := []struct {
		leftNum  int
		rightNum int
		typ      string
	}{
		{1, 1, "same"},  // "a"
		{0, 2, "added"}, // "x"
		{2, 3, "same"},  // "b"
		{3, 4, "same"},  // "c"
	}

	if len(result.Lines) != len(expected) {
		t.Fatalf("Expected %d lines, got %d", len(expected), len(result.Lines))
	}

	for i, exp := range expected {
		line := result.Lines[i]
		if line.LeftNumber != exp.leftNum {
			t.Errorf("Line %d: expected left number %d, got %d", i, exp.leftNum, line.LeftNumber)
		}
		if line.RightNumber != exp.rightNum {
			t.Errorf("Line %d: expected right number %d, got %d", i, exp.rightNum, line.RightNumber)
		}
		if line.Type != exp.typ {
			t.Errorf("Line %d: expected type %s, got %s", i, exp.typ, line.Type)
		}
	}
}

func TestLCS_Performance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	lcs := NewLCSDefault()

	// Create large test data
	left := make([]string, 1000)
	right := make([]string, 1000)
	for i := 0; i < 1000; i++ {
		left[i] = "line"
		right[i] = "line"
		if i%10 == 0 {
			left[i] = "modified left"
			right[i] = "modified right"
		}
	}

	// This should complete quickly even with 1000 lines
	result := lcs.ComputeDiff(left, right)
	if result == nil {
		t.Fatal("ComputeDiff returned nil")
	}

	// Should have detected modifications
	modCount := 0
	for _, line := range result.Lines {
		if line.Type == "modified" {
			modCount++
		}
	}

	if modCount != 100 { // 10% of 1000
		t.Errorf("Expected 100 modified lines, got %d", modCount)
	}
}

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()
	if config.SimilarityThreshold != 0.7 {
		t.Errorf("Expected default similarity threshold 0.7, got %f", config.SimilarityThreshold)
	}
	if config.MinLineLength != 10 {
		t.Errorf("Expected default min line length 10, got %d", config.MinLineLength)
	}
}

// TestIssue54_AdjacentChanges tests the scenario from issue #54 where
// adjacent modified/new/deleted lines should be grouped together
func TestIssue54_AdjacentChanges(t *testing.T) {
	lcs := NewLCSDefault()

	t.Run("modified line adjacent to deleted line", func(t *testing.T) {
		// Simulating the scenario where we have:
		// - A line that's removed
		// - A line that's modified (removed+added that are similar)
		// These should ideally be grouped as one chunk
		left := []string{
			"function test() {",
			"  const a = 1;",
			"  const b = 2;",
			"  return a + b;",
			"}",
		}
		right := []string{
			"function test() {",
			"  const a = 10;", // modified
			// const b = 2 is deleted
			"  return a;", // modified
			"}",
		}

		result := lcs.ComputeDiff(left, right)
		
		// Count the different types of changes
		var changeGroups [][]DiffLine
		var currentGroup []DiffLine
		
		for _, line := range result.Lines {
			if line.Type != "same" {
				currentGroup = append(currentGroup, line)
			} else if len(currentGroup) > 0 {
				changeGroups = append(changeGroups, currentGroup)
				currentGroup = nil
			}
		}
		if len(currentGroup) > 0 {
			changeGroups = append(changeGroups, currentGroup)
		}

		// Currently this creates multiple groups, but ideally should be one
		// This test documents the current behavior
		if len(changeGroups) < 1 {
			t.Error("Expected at least one change group")
		}

		// Log the actual behavior for visibility
		t.Logf("Found %d change groups (issue #54 suggests these should be grouped as 1)", len(changeGroups))
		for i, group := range changeGroups {
			t.Logf("Group %d:", i+1)
			for _, line := range group {
				t.Logf("  Type: %s, Left: %q, Right: %q", line.Type, line.LeftLine, line.RightLine)
			}
		}
	})

	t.Run("modified line adjacent to added line", func(t *testing.T) {
		left := []string{
			"const config = {",
			"  name: 'test',",
			"  version: '1.0.0'",
			"};",
		}
		right := []string{
			"const config = {",
			"  name: 'test-modified',", // modified
			"  description: 'A test',",  // added
			"  version: '2.0.0'",        // modified
			"};",
		}

		result := lcs.ComputeDiff(left, right)

		// Find sequences of non-same lines
		inChangeBlock := false
		changeBlockCount := 0
		
		for _, line := range result.Lines {
			if line.Type != "same" {
				if !inChangeBlock {
					changeBlockCount++
					inChangeBlock = true
				}
			} else {
				inChangeBlock = false
			}
		}

		// This documents that adjacent changes are currently split
		t.Logf("Adjacent modified/added lines create %d change block(s)", changeBlockCount)
		
		// Once issue #54 is fixed, this should be:
		// if changeBlockCount != 1 {
		//     t.Errorf("Expected 1 change block for adjacent changes, got %d", changeBlockCount)
		// }
	})

	t.Run("multiple adjacent modifications", func(t *testing.T) {
		// This is the exact scenario mentioned in issue #54
		left := []string{
			"line 24",
			"line 25",
			"line 26", // will be modified
			"line 27", // will be deleted
			"line 28",
		}
		right := []string{
			"line 24",
			"line 25",
			"line 26 modified", // modified
			// line 27 deleted
			"line 27.5 new", // added
			"line 28",
		}

		result := lcs.ComputeDiff(left, right)

		// Check how the diff algorithm handles this
		var diffSequence []string
		for _, line := range result.Lines {
			if line.Type != "same" {
				diffSequence = append(diffSequence, line.Type)
			}
		}

		t.Logf("Diff sequence for adjacent changes: %v", diffSequence)
		// Currently might produce: [removed, removed, added, added]
		// After fix should produce a single chunk with proper modification detection
		
		// TODO: When we fix issue #54, uncomment this assertion:
		// expectedSequence := []string{"modified", "removed", "added"}
		// if !reflect.DeepEqual(diffSequence, expectedSequence) {
		//     t.Errorf("Expected sequence %v, got %v", expectedSequence, diffSequence)
		// }
	})
}

func TestLCS_EdgeCases(t *testing.T) {
	lcs := NewLCSDefault()

	t.Run("left empty right has content", func(t *testing.T) {
		left := []string{}
		right := []string{"line1", "line2"}

		result := lcs.ComputeDiff(left, right)
		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		for _, line := range result.Lines {
			if line.Type != "added" {
				t.Errorf("Expected all lines to be 'added', got %s", line.Type)
			}
		}
	})

	t.Run("right empty left has content", func(t *testing.T) {
		left := []string{"line1", "line2"}
		right := []string{}

		result := lcs.ComputeDiff(left, right)
		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		for _, line := range result.Lines {
			if line.Type != "removed" {
				t.Errorf("Expected all lines to be 'removed', got %s", line.Type)
			}
		}
	})

	t.Run("single line files", func(t *testing.T) {
		left := []string{"single"}
		right := []string{"single"}

		result := lcs.ComputeDiff(left, right)
		if len(result.Lines) != 1 {
			t.Errorf("Expected 1 line, got %d", len(result.Lines))
		}
		if result.Lines[0].Type != "same" {
			t.Errorf("Expected 'same', got %s", result.Lines[0].Type)
		}
	})
}

func TestLCS_ConfigEffects(t *testing.T) {
	t.Run("high similarity threshold", func(t *testing.T) {
		config := Config{
			SimilarityThreshold: 0.95, // Very high threshold
			MinLineLength:       10,
		}
		lcs := NewLCS(config)

		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "removed", LeftLine: "hello world test", LeftNumber: 1},
				{Type: "added", RightLine: "hello world best", RightNumber: 1}, // Only 1 char diff but not 95% similar
			},
		}

		result := lcs.detectModifications(input)
		// Should NOT be merged as modification due to high threshold
		if result.Lines[0].Type != "removed" || result.Lines[1].Type != "added" {
			t.Error("Expected lines to remain separate due to high similarity threshold")
		}
	})

	t.Run("low similarity threshold", func(t *testing.T) {
		config := Config{
			SimilarityThreshold: 0.3, // Very low threshold
			MinLineLength:       10,
		}
		lcs := NewLCS(config)

		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "removed", LeftLine: "hello world", LeftNumber: 1},
				{Type: "added", RightLine: "goodbye mars", RightNumber: 1},
			},
		}

		result := lcs.detectModifications(input)
		// These strings are only ~16% similar (2/12 chars match)
		// so even with 0.3 threshold they won't be merged
		if result.Lines[0].Type != "removed" || result.Lines[1].Type != "added" {
			t.Error("Expected lines to remain separate - similarity too low even for 0.3 threshold")
		}
	})
}

func TestLCS_WhitespaceHandling(t *testing.T) {
	lcs := NewLCSDefault()

	t.Run("leading and trailing whitespace", func(t *testing.T) {
		left := []string{"  hello  ", "world"}
		right := []string{"hello", "  world  "}

		result := lcs.ComputeDiff(left, right)
		// These should be different lines since we do exact string comparison
		if result.Lines[0].Type == "same" || result.Lines[1].Type == "same" {
			t.Error("Lines with different whitespace should not match exactly")
		}
	})

	t.Run("tabs vs spaces", func(t *testing.T) {
		left := []string{"\tindented"}
		right := []string{"    indented"}

		result := lcs.ComputeDiff(left, right)
		// Should be treated as a modification (similar but not identical)
		if len(result.Lines) != 1 || result.Lines[0].Type != "modified" {
			t.Errorf("Tab vs space difference should be detected as modification")
		}
	})
}

func BenchmarkLCS_ComputeDiff(b *testing.B) {
	lcs := NewLCSDefault()
	left := []string{"line1", "line2", "line3", "line4", "line5"}
	right := []string{"line1", "modified", "line3", "added", "line5"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = lcs.ComputeDiff(left, right)
	}
}

func BenchmarkLevenshteinDistance(b *testing.B) {
	s1 := "hello world this is a test"
	s2 := "hello world this was a test"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = levenshteinDistance(s1, s2)
	}
}
