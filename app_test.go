package main

import (
	"os"
	"path/filepath"
	"reflect"
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
