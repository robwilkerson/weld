package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestApp_ReadFileContent(t *testing.T) {
	app := &App{}

	// Test reading empty file path
	t.Run("empty file path", func(t *testing.T) {
		lines, err := app.ReadFileContent("")
		if err != nil {
			t.Errorf("ReadFileContent(\"\") returned error: %v", err)
		}
		if len(lines) != 0 {
			t.Errorf("ReadFileContent(\"\") returned %d lines, expected 0", len(lines))
		}
	})

	// Test reading non-existent file
	t.Run("non-existent file", func(t *testing.T) {
		_, err := app.ReadFileContent("/path/to/nonexistent/file.txt")
		if err == nil {
			t.Error("ReadFileContent should return error for non-existent file")
		}
	})

	// Test reading actual file
	t.Run("read actual file", func(t *testing.T) {
		// Create a temporary file
		tempDir := t.TempDir()
		tempFile := filepath.Join(tempDir, "test.txt")

		content := "line1\nline2\nline3"
		err := os.WriteFile(tempFile, []byte(content), 0644)
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}

		lines, err := app.ReadFileContent(tempFile)
		if err != nil {
			t.Errorf("ReadFileContent returned error: %v", err)
		}

		expected := []string{"line1", "line2", "line3"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("ReadFileContent returned %v, expected %v", lines, expected)
		}
	})
}

func TestApp_ReadFileContentWithCache(t *testing.T) {
	app := &App{}

	// Create a temporary file
	tempDir := t.TempDir()
	tempFile := filepath.Join(tempDir, "test.txt")

	content := "line1\nline2\nline3"
	err := os.WriteFile(tempFile, []byte(content), 0644)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test reading from disk first time
	t.Run("read from disk", func(t *testing.T) {
		lines, err := app.ReadFileContentWithCache(tempFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"line1", "line2", "line3"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("ReadFileContentWithCache returned %v, expected %v", lines, expected)
		}
	})

	// Test reading from cache after storing in memory
	t.Run("read from cache", func(t *testing.T) {
		// Store different content in cache
		cachedContent := []string{"cached1", "cached2"}
		err := app.storeFileInMemory(tempFile, cachedContent)
		if err != nil {
			t.Errorf("storeFileInMemory returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(tempFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		if !reflect.DeepEqual(lines, cachedContent) {
			t.Errorf("ReadFileContentWithCache returned %v, expected %v", lines, cachedContent)
		}
	})
}

func TestApp_CompareFiles(t *testing.T) {
	app := &App{}

	// Create temporary files
	tempDir := t.TempDir()
	file1 := filepath.Join(tempDir, "file1.txt")
	file2 := filepath.Join(tempDir, "file2.txt")

	// Test identical files
	t.Run("identical files", func(t *testing.T) {
		content := "line1\nline2\nline3"
		err := os.WriteFile(file1, []byte(content), 0644)
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}
		err = os.WriteFile(file2, []byte(content), 0644)
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}

		result, err := app.CompareFiles(file1, file2)
		if err != nil {
			t.Errorf("CompareFiles returned error: %v", err)
		}

		if result == nil {
			t.Error("CompareFiles returned nil result")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("CompareFiles returned %d lines, expected 3", len(result.Lines))
		}

		for i, line := range result.Lines {
			if line.Type != "same" {
				t.Errorf("Line %d type is %s, expected 'same'", i, line.Type)
			}
		}
	})

	// Test files with additions
	t.Run("files with additions", func(t *testing.T) {
		content1 := "line1\nline2"
		content2 := "line1\nline2\nline3"

		err := os.WriteFile(file1, []byte(content1), 0644)
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}
		err = os.WriteFile(file2, []byte(content2), 0644)
		if err != nil {
			t.Fatalf("Failed to create temp file: %v", err)
		}

		result, err := app.CompareFiles(file1, file2)
		if err != nil {
			t.Errorf("CompareFiles returned error: %v", err)
		}

		if result == nil {
			t.Error("CompareFiles returned nil result")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("CompareFiles returned %d lines, expected 3", len(result.Lines))
		}

		// Check that we have same lines and added line
		sameCount := 0
		addedCount := 0
		for _, line := range result.Lines {
			switch line.Type {
			case "same":
				sameCount++
			case "added":
				addedCount++
			}
		}

		if sameCount != 2 {
			t.Errorf("Expected 2 same lines, got %d", sameCount)
		}
		if addedCount != 1 {
			t.Errorf("Expected 1 added line, got %d", addedCount)
		}
	})

	// Test non-existent file
	t.Run("non-existent file", func(t *testing.T) {
		_, err := app.CompareFiles("/nonexistent/file1.txt", "/nonexistent/file2.txt")
		if err == nil {
			t.Error("CompareFiles should return error for non-existent files")
		}
	})
}

func TestApp_CopyToFile(t *testing.T) {
	app := &App{}

	// Create temporary files
	tempDir := t.TempDir()
	sourceFile := filepath.Join(tempDir, "source.txt")
	targetFile := filepath.Join(tempDir, "target.txt")

	sourceContent := "line1\nline2\nline3"
	targetContent := "lineA\nlineB"

	err := os.WriteFile(sourceFile, []byte(sourceContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}
	err = os.WriteFile(targetFile, []byte(targetContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create target file: %v", err)
	}

	// Test copying line to beginning
	t.Run("copy to beginning", func(t *testing.T) {
		err := app.CopyToFile(sourceFile, targetFile, 1, "inserted line")
		if err != nil {
			t.Errorf("CopyToFile returned error: %v", err)
		}

		// Check that the line was inserted in memory
		lines, err := app.ReadFileContentWithCache(targetFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"inserted line", "lineA", "lineB"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After copy, got %v, expected %v", lines, expected)
		}
	})

	// Test copying line to middle
	t.Run("copy to middle", func(t *testing.T) {
		// Reset the cache
		delete(fileCache, targetFile)

		err := app.CopyToFile(sourceFile, targetFile, 2, "middle line")
		if err != nil {
			t.Errorf("CopyToFile returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(targetFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"lineA", "middle line", "lineB"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After copy, got %v, expected %v", lines, expected)
		}
	})

	// Test copying line to end
	t.Run("copy to end", func(t *testing.T) {
		// Reset the cache
		delete(fileCache, targetFile)

		err := app.CopyToFile(sourceFile, targetFile, 3, "end line")
		if err != nil {
			t.Errorf("CopyToFile returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(targetFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"lineA", "lineB", "end line"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After copy, got %v, expected %v", lines, expected)
		}
	})

	// Test copying to non-existent file
	t.Run("copy to non-existent file", func(t *testing.T) {
		err := app.CopyToFile(sourceFile, "/nonexistent/target.txt", 1, "test")
		if err == nil {
			t.Error("CopyToFile should return error for non-existent target file")
		}
	})
}

func TestApp_RemoveLineFromFile(t *testing.T) {
	app := &App{}

	// Create temporary file
	tempDir := t.TempDir()
	testFile := filepath.Join(tempDir, "test.txt")

	content := "line1\nline2\nline3\nline4"
	err := os.WriteFile(testFile, []byte(content), 0644)
	if err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test removing first line
	t.Run("remove first line", func(t *testing.T) {
		err := app.RemoveLineFromFile(testFile, 1)
		if err != nil {
			t.Errorf("RemoveLineFromFile returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(testFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"line2", "line3", "line4"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After removal, got %v, expected %v", lines, expected)
		}
	})

	// Test removing middle line
	t.Run("remove middle line", func(t *testing.T) {
		// Reset the cache
		delete(fileCache, testFile)

		err := app.RemoveLineFromFile(testFile, 2)
		if err != nil {
			t.Errorf("RemoveLineFromFile returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(testFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"line1", "line3", "line4"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After removal, got %v, expected %v", lines, expected)
		}
	})

	// Test removing last line
	t.Run("remove last line", func(t *testing.T) {
		// Reset the cache
		delete(fileCache, testFile)

		err := app.RemoveLineFromFile(testFile, 4)
		if err != nil {
			t.Errorf("RemoveLineFromFile returned error: %v", err)
		}

		lines, err := app.ReadFileContentWithCache(testFile)
		if err != nil {
			t.Errorf("ReadFileContentWithCache returned error: %v", err)
		}

		expected := []string{"line1", "line2", "line3"}
		if !reflect.DeepEqual(lines, expected) {
			t.Errorf("After removal, got %v, expected %v", lines, expected)
		}
	})

	// Test removing out-of-bounds line
	t.Run("remove out-of-bounds line", func(t *testing.T) {
		// Reset the cache
		delete(fileCache, testFile)

		err := app.RemoveLineFromFile(testFile, 10)
		if err == nil {
			t.Error("RemoveLineFromFile should return error for out-of-bounds line number")
		}
	})

	// Test removing from non-existent file
	t.Run("remove from non-existent file", func(t *testing.T) {
		err := app.RemoveLineFromFile("/nonexistent/file.txt", 1)
		if err == nil {
			t.Error("RemoveLineFromFile should return error for non-existent file")
		}
	})
}

func TestApp_SaveChanges(t *testing.T) {
	app := &App{}

	// Create temporary file
	tempDir := t.TempDir()
	testFile := filepath.Join(tempDir, "test.txt")

	originalContent := "line1\nline2\nline3"
	err := os.WriteFile(testFile, []byte(originalContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test saving changes
	t.Run("save changes", func(t *testing.T) {
		// Store modified content in cache
		modifiedContent := []string{"modified1", "modified2", "modified3", "modified4"}
		err := app.storeFileInMemory(testFile, modifiedContent)
		if err != nil {
			t.Errorf("storeFileInMemory returned error: %v", err)
		}

		// Save changes
		err = app.SaveChanges(testFile)
		if err != nil {
			t.Errorf("SaveChanges returned error: %v", err)
		}

		// Read file from disk to verify changes were saved
		savedContent, err := os.ReadFile(testFile)
		if err != nil {
			t.Errorf("Failed to read saved file: %v", err)
		}

		expectedContent := "modified1\nmodified2\nmodified3\nmodified4"
		if string(savedContent) != expectedContent {
			t.Errorf("Saved content is %q, expected %q", string(savedContent), expectedContent)
		}

		// Verify cache was cleared
		if _, exists := fileCache[testFile]; exists {
			t.Error("Cache should be cleared after saving")
		}
	})

	// Test saving with no changes
	t.Run("save with no changes", func(t *testing.T) {
		err := app.SaveChanges(testFile)
		if err == nil {
			t.Error("SaveChanges should return error when no changes exist")
		}
	})

	// Test saving to non-existent directory
	t.Run("save to non-existent directory", func(t *testing.T) {
		nonExistentFile := "/nonexistent/directory/file.txt"
		err := app.storeFileInMemory(nonExistentFile, []string{"test"})
		if err != nil {
			t.Errorf("storeFileInMemory returned error: %v", err)
		}

		err = app.SaveChanges(nonExistentFile)
		if err == nil {
			t.Error("SaveChanges should return error for non-existent directory")
		}
	})
}

func TestApp_storeFileInMemory(t *testing.T) {
	app := &App{}

	testFile := "/test/file.txt"
	testContent := []string{"line1", "line2", "line3"}

	// Test storing in memory
	t.Run("store in memory", func(t *testing.T) {
		err := app.storeFileInMemory(testFile, testContent)
		if err != nil {
			t.Errorf("storeFileInMemory returned error: %v", err)
		}

		// Check that content was stored
		if cachedContent, exists := fileCache[testFile]; !exists {
			t.Error("Content was not stored in cache")
		} else if !reflect.DeepEqual(cachedContent, testContent) {
			t.Errorf("Cached content is %v, expected %v", cachedContent, testContent)
		}
	})

	// Test overwriting in memory
	t.Run("overwrite in memory", func(t *testing.T) {
		newContent := []string{"new1", "new2"}
		err := app.storeFileInMemory(testFile, newContent)
		if err != nil {
			t.Errorf("storeFileInMemory returned error: %v", err)
		}

		// Check that content was overwritten
		if cachedContent, exists := fileCache[testFile]; !exists {
			t.Error("Content was not stored in cache")
		} else if !reflect.DeepEqual(cachedContent, newContent) {
			t.Errorf("Cached content is %v, expected %v", cachedContent, newContent)
		}
	})
}

func TestApp_computeDiff(t *testing.T) {
	app := &App{}

	// Test identical content
	t.Run("identical content", func(t *testing.T) {
		left := []string{"line1", "line2", "line3"}
		right := []string{"line1", "line2", "line3"}

		result := app.computeDiff(left, right)
		if result == nil {
			t.Error("computeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("computeDiff returned %d lines, expected 3", len(result.Lines))
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

		result := app.computeDiff(left, right)
		if result == nil {
			t.Error("computeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("computeDiff returned %d lines, expected 3", len(result.Lines))
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

		result := app.computeDiff(left, right)
		if result == nil {
			t.Error("computeDiff returned nil")
			return
		}

		if len(result.Lines) != 3 {
			t.Errorf("computeDiff returned %d lines, expected 3", len(result.Lines))
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

		result := app.computeDiff(left, right)
		if result == nil {
			t.Error("computeDiff returned nil")
			return
		}

		if len(result.Lines) != 0 {
			t.Errorf("computeDiff returned %d lines, expected 0", len(result.Lines))
		}
	})
}

func TestApp_findNextMatch(t *testing.T) {
	app := &App{}

	lines := []string{"line1", "line2", "line3", "line2", "line4"}

	// Test finding existing match
	t.Run("find existing match", func(t *testing.T) {
		index := app.findNextMatch(lines, 2, "line2")
		if index != 3 {
			t.Errorf("findNextMatch returned %d, expected 3", index)
		}
	})

	// Test finding non-existent match
	t.Run("find non-existent match", func(t *testing.T) {
		index := app.findNextMatch(lines, 0, "nonexistent")
		if index != -1 {
			t.Errorf("findNextMatch returned %d, expected -1", index)
		}
	})

	// Test finding match at start index
	t.Run("find match at start", func(t *testing.T) {
		index := app.findNextMatch(lines, 1, "line2")
		if index != 1 {
			t.Errorf("findNextMatch returned %d, expected 1", index)
		}
	})

	// Test out of bounds start index
	t.Run("out of bounds start", func(t *testing.T) {
		index := app.findNextMatch(lines, 10, "line1")
		if index != -1 {
			t.Errorf("findNextMatch returned %d, expected -1", index)
		}
	})
}

func TestApp_levenshteinDistance(t *testing.T) {
	app := &App{}

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
		{"unicode", "café", "cafe", 1},
		{"numbers", "123", "124", 1},
		{"special chars", "a-b", "a_b", 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := app.levenshteinDistance(tt.s1, tt.s2)
			if result != tt.expected {
				t.Errorf("levenshteinDistance(%q, %q) = %d, want %d",
					tt.s1, tt.s2, result, tt.expected)
			}
		})
	}
}

func TestApp_areSimilarLines(t *testing.T) {
	app := &App{}

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
			result := app.areSimilarLines(tt.left, tt.right)
			if result != tt.expected {
				t.Errorf("areSimilarLines(%q, %q) = %v, want %v",
					tt.left, tt.right, result, tt.expected)
			}
		})
	}
}

func TestApp_detectModifications(t *testing.T) {
	app := &App{}

	t.Run("detect simple modification", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "same", LeftLine: "line1", RightLine: "line1", LeftNumber: 1, RightNumber: 1},
				{Type: "removed", LeftLine: "const value = 42", LeftNumber: 2},
				{Type: "added", RightLine: "const value = 43", RightNumber: 2},
				{Type: "same", LeftLine: "line3", RightLine: "line3", LeftNumber: 3, RightNumber: 3},
			},
		}

		result := app.detectModifications(input)

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

		result := app.detectModifications(input)

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
				{Type: "removed", LeftLine: "let x = 1", LeftNumber: 1},
				{Type: "added", RightLine: "let x = 2", RightNumber: 1},
				{Type: "same", LeftLine: "// comment", RightLine: "// comment", LeftNumber: 2, RightNumber: 2},
				{Type: "removed", LeftLine: "function test()", LeftNumber: 3},
				{Type: "added", RightLine: "function test(a)", RightNumber: 3},
			},
		}

		result := app.detectModifications(input)

		if len(result.Lines) != 3 {
			t.Errorf("Expected 3 lines, got %d", len(result.Lines))
		}
		if result.Lines[0].Type != "modified" {
			t.Errorf("Expected first modification, got %s", result.Lines[0].Type)
		}
		if result.Lines[2].Type != "modified" {
			t.Errorf("Expected second modification, got %s", result.Lines[2].Type)
		}
	})

	t.Run("removed at end", func(t *testing.T) {
		input := &DiffResult{
			Lines: []DiffLine{
				{Type: "same", LeftLine: "line1", RightLine: "line1", LeftNumber: 1, RightNumber: 1},
				{Type: "removed", LeftLine: "line2", LeftNumber: 2},
			},
		}

		result := app.detectModifications(input)

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

		result := app.detectModifications(input)

		if len(result.Lines) != 2 {
			t.Errorf("Expected 2 lines, got %d", len(result.Lines))
		}
		if result.Lines[1].Type != "added" {
			t.Errorf("Expected 'added', got %s", result.Lines[1].Type)
		}
	})

	t.Run("empty input", func(t *testing.T) {
		input := &DiffResult{Lines: []DiffLine{}}
		result := app.detectModifications(input)

		if len(result.Lines) != 0 {
			t.Errorf("Expected 0 lines, got %d", len(result.Lines))
		}
	})
}

func TestApp_HasUnsavedChanges(t *testing.T) {
	app := &App{}

	// Clear cache first to ensure clean state
	fileCache = make(map[string][]string)

	t.Run("no changes for non-cached file", func(t *testing.T) {
		result := app.HasUnsavedChanges("/test/file.txt")
		if result {
			t.Error("HasUnsavedChanges should return false for file not in cache")
		}
	})

	t.Run("has changes for cached file", func(t *testing.T) {
		// Add to cache
		fileCache["/test/file.txt"] = []string{"content"}

		result := app.HasUnsavedChanges("/test/file.txt")
		if !result {
			t.Error("HasUnsavedChanges should return true for file in cache")
		}
	})

	t.Run("empty path", func(t *testing.T) {
		result := app.HasUnsavedChanges("")
		if result {
			t.Error("HasUnsavedChanges should return false for empty path")
		}
	})
}

func TestApp_GetUnsavedFilesList(t *testing.T) {
	app := &App{}

	t.Run("empty list when no cache", func(t *testing.T) {
		// Clear cache
		fileCache = make(map[string][]string)

		files := app.GetUnsavedFilesList()
		if len(files) != 0 {
			t.Errorf("Expected empty list, got %d files", len(files))
		}
	})

	t.Run("returns cached files", func(t *testing.T) {
		// Clear and add files
		fileCache = make(map[string][]string)
		fileCache["/file1.txt"] = []string{"content1"}
		fileCache["/file2.txt"] = []string{"content2"}

		files := app.GetUnsavedFilesList()
		if len(files) != 2 {
			t.Errorf("Expected 2 files, got %d", len(files))
		}

		// Check that files are present (order may vary)
		foundFile1 := false
		foundFile2 := false
		for _, file := range files {
			if file == "/file1.txt" {
				foundFile1 = true
			}
			if file == "/file2.txt" {
				foundFile2 = true
			}
		}

		if !foundFile1 {
			t.Error("Expected to find /file1.txt in unsaved files list")
		}
		if !foundFile2 {
			t.Error("Expected to find /file2.txt in unsaved files list")
		}
	})
}

func TestApp_DiscardAllChanges(t *testing.T) {
	app := &App{}

	t.Run("discard with cached files", func(t *testing.T) {
		// Add files to cache
		fileCache = make(map[string][]string)
		fileCache["/file1.txt"] = []string{"content1"}
		fileCache["/file2.txt"] = []string{"content2"}

		err := app.DiscardAllChanges()
		if err != nil {
			t.Errorf("DiscardAllChanges returned error: %v", err)
		}

		if len(fileCache) != 0 {
			t.Error("fileCache should be empty after DiscardAllChanges")
		}
	})

	t.Run("discard with empty cache", func(t *testing.T) {
		// Start with empty cache
		fileCache = make(map[string][]string)

		err := app.DiscardAllChanges()
		if err != nil {
			t.Errorf("DiscardAllChanges returned error: %v", err)
		}

		if len(fileCache) != 0 {
			t.Error("fileCache should remain empty after DiscardAllChanges")
		}
	})
}

func TestApp_NewApp(t *testing.T) {
	app := NewApp()

	if app == nil {
		t.Error("NewApp should return non-nil App instance")
	}

	if app.InitialLeftFile != "" {
		t.Errorf("NewApp should initialize with empty InitialLeftFile, got %s", app.InitialLeftFile)
	}

	if app.InitialRightFile != "" {
		t.Errorf("NewApp should initialize with empty InitialRightFile, got %s", app.InitialRightFile)
	}
}

func TestApp_GetInitialFiles(t *testing.T) {
	app := &App{
		InitialLeftFile:  "/path/to/left.txt",
		InitialRightFile: "/path/to/right.txt",
	}

	left, right := app.GetInitialFiles()

	if left != "/path/to/left.txt" {
		t.Errorf("Expected left file %s, got %s", "/path/to/left.txt", left)
	}

	if right != "/path/to/right.txt" {
		t.Errorf("Expected right file %s, got %s", "/path/to/right.txt", right)
	}
}

func TestApp_min(t *testing.T) {
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
			result := min(tt.a, tt.b, tt.c)
			if result != tt.expected {
				t.Errorf("min(%d, %d, %d) = %d, want %d",
					tt.a, tt.b, tt.c, result, tt.expected)
			}
		})
	}
}

func TestApp_CompareFiles_ErrorHandling(t *testing.T) {
	app := &App{}

	t.Run("error reading right file", func(t *testing.T) {
		// Create left file but not right file
		tempDir := t.TempDir()
		leftFile := filepath.Join(tempDir, "left.txt")
		err := os.WriteFile(leftFile, []byte("content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create left file: %v", err)
		}

		nonExistentRight := "/nonexistent/right.txt"

		_, err = app.CompareFiles(leftFile, nonExistentRight)
		if err == nil {
			t.Error("CompareFiles should return error when right file doesn't exist")
		}
		if !strings.Contains(err.Error(), "error reading right file") {
			t.Errorf("Expected error about right file, got: %v", err)
		}
	})
}

func TestApp_CopyToFile_ErrorHandling(t *testing.T) {
	app := &App{}

	t.Run("copy to non-existent directory", func(t *testing.T) {
		// Create source file
		tempDir := t.TempDir()
		sourceFile := filepath.Join(tempDir, "source.txt")
		err := os.WriteFile(sourceFile, []byte("test content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create source file: %v", err)
		}

		// Try to copy to non-existent directory
		nonExistentTarget := "/nonexistent/directory/target.txt"

		err = app.CopyToFile(sourceFile, nonExistentTarget, 1, "test content")
		if err == nil {
			t.Error("CopyToFile should return error when target directory doesn't exist")
		}
	})

	t.Run("copy non-existent source line", func(t *testing.T) {
		tempDir := t.TempDir()
		sourceFile := filepath.Join(tempDir, "source.txt")
		targetFile := filepath.Join(tempDir, "target.txt")

		// Create files
		err := os.WriteFile(sourceFile, []byte("line1\nline2"), 0644)
		if err != nil {
			t.Fatalf("Failed to create source file: %v", err)
		}
		err = os.WriteFile(targetFile, []byte("target content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create target file: %v", err)
		}

		// This test checks that we can copy arbitrary content, not source validation
		// The current implementation doesn't validate source line existence
		err = app.CopyToFile(sourceFile, targetFile, 1, "line999")
		if err != nil {
			t.Errorf("CopyToFile failed: %v", err)
		}
	})
}

func TestApp_SaveChanges_ErrorHandling(t *testing.T) {
	app := &App{}

	t.Run("save to non-existent directory", func(t *testing.T) {
		// Add content to cache for non-existent directory
		nonExistentFile := "/nonexistent/directory/file.txt"
		fileCache = make(map[string][]string)
		fileCache[nonExistentFile] = []string{"content"}

		err := app.SaveChanges(nonExistentFile)
		if err == nil {
			t.Error("SaveChanges should return error when directory doesn't exist")
		}
	})

	t.Run("save file not in cache", func(t *testing.T) {
		// Clear cache
		fileCache = make(map[string][]string)

		tempDir := t.TempDir()
		testFile := filepath.Join(tempDir, "test.txt")

		err := app.SaveChanges(testFile)
		if err == nil {
			t.Error("SaveChanges should return error when file is not in cache")
		}
	})
}

func TestApp_RemoveLineFromFile_ErrorHandling(t *testing.T) {
	app := &App{}

	t.Run("remove from non-existent file", func(t *testing.T) {
		err := app.RemoveLineFromFile("/nonexistent/file.txt", 1)
		if err == nil {
			t.Error("RemoveLineFromFile should return error for non-existent file")
		}
	})
}

func TestApp_EndToEndDiffWorkflow(t *testing.T) {
	app := &App{}
	tempDir := t.TempDir()

	// Create test files with realistic diff scenario
	file1 := filepath.Join(tempDir, "file1.txt")
	file2 := filepath.Join(tempDir, "file2.txt")

	content1 := `package main

import "fmt"

func main() {
	x := 42
	fmt.Println("Hello World")
	fmt.Println(x)
}`

	content2 := `package main

import "fmt"

func main() {
	x := 43
	fmt.Println("Hello Universe")
	fmt.Println(x)
	fmt.Println("Done")
}`

	err := os.WriteFile(file1, []byte(content1), 0644)
	if err != nil {
		t.Fatalf("Failed to create file1: %v", err)
	}
	err = os.WriteFile(file2, []byte(content2), 0644)
	if err != nil {
		t.Fatalf("Failed to create file2: %v", err)
	}

	// Compare files
	result, err := app.CompareFiles(file1, file2)
	if err != nil {
		t.Fatalf("CompareFiles failed: %v", err)
	}

	if result == nil || len(result.Lines) == 0 {
		t.Fatal("Expected diff results, got empty")
	}

	// Should detect changes (modifications or separate added/removed)
	hasChanges := false
	for _, line := range result.Lines {
		if line.Type == "modified" || line.Type == "added" || line.Type == "removed" {
			hasChanges = true
			break
		}
	}

	if !hasChanges {
		t.Error("Expected to find changes in diff result")
	}

	// Test that we can copy a line and save changes
	err = app.CopyToFile(file1, file2, 6, "\tx := 42") // Copy "x := 42" to replace "x := 43"
	if err != nil {
		t.Errorf("CopyToFile failed: %v", err)
	}

	// Verify cache has unsaved changes
	if !app.HasUnsavedChanges(file2) {
		t.Error("Expected unsaved changes after CopyToFile")
	}

	// Save changes
	err = app.SaveChanges(file2)
	if err != nil {
		t.Errorf("SaveChanges failed: %v", err)
	}

	// Verify no more unsaved changes
	if app.HasUnsavedChanges(file2) {
		t.Error("Expected no unsaved changes after SaveChanges")
	}
}
