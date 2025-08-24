package backend

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"weld/backend/diff"
)

func TestApp_ReadFileContent(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
		tempDir := t.TempDir()
		nonExistentFile := filepath.Join(tempDir, "nonexistent", "file.txt")
		_, err := app.ReadFileContent(nonExistentFile)
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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	// Ensure file watchers are stopped to prevent memory leaks
	t.Cleanup(func() { app.StopFileWatching() })

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
		tempDir := t.TempDir()
		nonExistentFile1 := filepath.Join(tempDir, "nonexistent", "file1.txt")
		nonExistentFile2 := filepath.Join(tempDir, "nonexistent", "file2.txt")
		_, err := app.CompareFiles(nonExistentFile1, nonExistentFile2)
		if err == nil {
			t.Error("CompareFiles should return error for non-existent files")
		}
	})
}

func TestApp_CopyToFile(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
		tempDir := t.TempDir()
		nonExistentTarget := filepath.Join(tempDir, "nonexistent", "target.txt")
		err := app.CopyToFile(sourceFile, nonExistentTarget, 1, "test")
		if err == nil {
			t.Error("CopyToFile should return error for non-existent target file")
		}
	})
}

func TestApp_RemoveLineFromFile(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
		tempDir := t.TempDir()
		nonExistentFile := filepath.Join(tempDir, "nonexistent", "file.txt")
		err := app.RemoveLineFromFile(nonExistentFile, 1)
		if err == nil {
			t.Error("RemoveLineFromFile should return error for non-existent file")
		}
	})
}

func TestApp_SaveChanges(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
		tempDir := t.TempDir()
		nonExistentFile := filepath.Join(tempDir, "nonexistent", "directory", "file.txt")
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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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

func TestApp_HasUnsavedChanges(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

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

	files := app.GetInitialFiles()

	if files.LeftFile != "/path/to/left.txt" {
		t.Errorf("Expected left file %s, got %s", "/path/to/left.txt", files.LeftFile)
	}

	if files.RightFile != "/path/to/right.txt" {
		t.Errorf("Expected right file %s, got %s", "/path/to/right.txt", files.RightFile)
	}
}

func TestApp_CompareFiles_ErrorHandling(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	// Ensure file watchers are stopped to prevent memory leaks
	t.Cleanup(func() { app.StopFileWatching() })

	t.Run("error reading right file", func(t *testing.T) {
		// Create left file but not right file
		tempDir := t.TempDir()
		leftFile := filepath.Join(tempDir, "left.txt")
		err := os.WriteFile(leftFile, []byte("content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create left file: %v", err)
		}

		nonExistentRight := filepath.Join(tempDir, "nonexistent", "right.txt")

		_, err = app.CompareFiles(leftFile, nonExistentRight)
		if err == nil {
			t.Error("CompareFiles should return error when right file doesn't exist")
		}
		// The error could be from checking file type or reading the file
		if !strings.Contains(err.Error(), "error checking right file type") && !strings.Contains(err.Error(), "error reading right file") {
			t.Errorf("Expected error about right file, got: %v", err)
		}
	})
}

func TestApp_CopyToFile_ErrorHandling(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

	t.Run("copy to non-existent directory", func(t *testing.T) {
		// Create source file
		tempDir := t.TempDir()
		sourceFile := filepath.Join(tempDir, "source.txt")
		err := os.WriteFile(sourceFile, []byte("test content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create source file: %v", err)
		}

		// Try to copy to non-existent directory
		nonExistentTarget := filepath.Join(tempDir, "nonexistent", "directory", "target.txt")

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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

	t.Run("save to non-existent directory", func(t *testing.T) {
		tempDir := t.TempDir()
		// Add content to cache for non-existent directory
		nonExistentFile := filepath.Join(tempDir, "nonexistent", "directory", "file.txt")
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
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}

	t.Run("remove from non-existent file", func(t *testing.T) {
		tempDir := t.TempDir()
		nonExistentFile := filepath.Join(tempDir, "nonexistent", "file.txt")
		err := app.RemoveLineFromFile(nonExistentFile, 1)
		if err == nil {
			t.Error("RemoveLineFromFile should return error for non-existent file")
		}
	})
}

func TestIsBinaryFile(t *testing.T) {
	// Create test directory
	testDir := t.TempDir()

	tests := []struct {
		name       string
		content    []byte
		wantBinary bool
	}{
		{
			name:       "text_file_ascii",
			content:    []byte("Hello, world!\nThis is a text file.\n"),
			wantBinary: false,
		},
		{
			name:       "text_file_utf8",
			content:    []byte("Hello, 世界!\nThis is a UTF-8 text file.\n"),
			wantBinary: false,
		},
		{
			name:       "binary_file_with_null",
			content:    []byte{0x00, 0x01, 0x02, 0x03, 0x04},
			wantBinary: true,
		},
		{
			name:       "binary_file_high_non_printable",
			content:    []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0B, 0x0C, 0x0E, 0x0F},
			wantBinary: true,
		},
		{
			name:       "text_with_some_control_chars",
			content:    []byte("Hello\tworld\nThis\ris\ta\ntest"),
			wantBinary: false,
		},
		{
			name:       "empty_file",
			content:    []byte{},
			wantBinary: false,
		},
		{
			name:       "single_null_byte",
			content:    []byte{0x00},
			wantBinary: true,
		},
		{
			name:       "mostly_binary",
			content:    []byte("Hello\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09"),
			wantBinary: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test file
			testFile := filepath.Join(testDir, tt.name)
			err := os.WriteFile(testFile, tt.content, 0644)
			if err != nil {
				t.Fatalf("Failed to create test file: %v", err)
			}

			// Test IsBinaryFile
			isBinary, err := IsBinaryFile(testFile)
			if err != nil {
				t.Fatalf("IsBinaryFile returned error: %v", err)
			}

			if isBinary != tt.wantBinary {
				t.Errorf("IsBinaryFile() = %v, want %v", isBinary, tt.wantBinary)
			}
		})
	}
}

func TestApp_ReadFileContent_BinaryRejection(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	testDir := t.TempDir()

	// Create a binary file
	binaryFile := filepath.Join(testDir, "binary.dat")
	binaryContent := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}
	err := os.WriteFile(binaryFile, binaryContent, 0644)
	if err != nil {
		t.Fatalf("Failed to create binary file: %v", err)
	}

	// Try to read the binary file
	_, err = app.ReadFileContent(binaryFile)
	if err == nil {
		t.Error("ReadFileContent should return error for binary file")
	}
	if !strings.Contains(err.Error(), "cannot read binary file") {
		t.Errorf("Expected error about binary file, got: %v", err)
	}

	// Create a text file to ensure normal files still work
	textFile := filepath.Join(testDir, "text.txt")
	textContent := []byte("This is a normal text file\nwith multiple lines")
	err = os.WriteFile(textFile, textContent, 0644)
	if err != nil {
		t.Fatalf("Failed to create text file: %v", err)
	}

	// Read the text file - should succeed
	lines, err := app.ReadFileContent(textFile)
	if err != nil {
		t.Errorf("ReadFileContent failed for text file: %v", err)
	}
	if len(lines) != 2 {
		t.Errorf("Expected 2 lines, got %d", len(lines))
	}
}

func TestApp_CompareFiles_BinaryRejection(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	// Ensure file watchers are stopped to prevent memory leaks
	t.Cleanup(func() { app.StopFileWatching() })
	testDir := t.TempDir()

	// Create a binary file
	binaryFile := filepath.Join(testDir, "binary.dat")
	binaryContent := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}
	err := os.WriteFile(binaryFile, binaryContent, 0644)
	if err != nil {
		t.Fatalf("Failed to create binary file: %v", err)
	}

	// Create a text file
	textFile := filepath.Join(testDir, "text.txt")
	textContent := []byte("This is a normal text file")
	err = os.WriteFile(textFile, textContent, 0644)
	if err != nil {
		t.Fatalf("Failed to create text file: %v", err)
	}

	// Test comparing binary file as left file
	_, err = app.CompareFiles(binaryFile, textFile)
	if err == nil {
		t.Error("CompareFiles should return error when left file is binary")
	}
	if !strings.Contains(err.Error(), "cannot compare binary file") {
		t.Errorf("Expected error about binary file, got: %v", err)
	}

	// Test comparing binary file as right file
	_, err = app.CompareFiles(textFile, binaryFile)
	if err == nil {
		t.Error("CompareFiles should return error when right file is binary")
	}
	if !strings.Contains(err.Error(), "cannot compare binary file") {
		t.Errorf("Expected error about binary file, got: %v", err)
	}

	// Test comparing two binary files
	_, err = app.CompareFiles(binaryFile, binaryFile)
	if err == nil {
		t.Error("CompareFiles should return error when both files are binary")
	}
	if !strings.Contains(err.Error(), "cannot compare binary file") {
		t.Errorf("Expected error about binary file, got: %v", err)
	}
}

func TestApp_EndToEndDiffWorkflow(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	// Ensure file watchers are stopped to prevent memory leaks
	t.Cleanup(func() { app.StopFileWatching() })
	tempDir := t.TempDir()

	// Create test files with realistic diff scenario
	file1 := filepath.Join(tempDir, "file1.txt")
	file2 := filepath.Join(tempDir, "file2.txt")

	content1 := `package backend

import "fmt"

func main() {
	x := 42
	fmt.Println("Hello World")
	fmt.Println(x)
}`

	content2 := `package backend

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

func TestApp_CompareFiles_TextAndHTML(t *testing.T) {
	app := &App{
		diffAlgorithm: diff.NewLCSDefault(),
	}
	// Ensure file watchers are stopped to prevent memory leaks
	t.Cleanup(func() { app.StopFileWatching() })
	tempDir := t.TempDir()

	// Create a plain text file
	textFile := filepath.Join(tempDir, "document.txt")
	textContent := `This is a plain text document.
It has multiple lines.
Some content here.`

	// Create an HTML file
	htmlFile := filepath.Join(tempDir, "document.html")
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>Test Document</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>This is a test</h1>
    <p>Some content here.</p>
</body>
</html>`

	err := os.WriteFile(textFile, []byte(textContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create text file: %v", err)
	}
	err = os.WriteFile(htmlFile, []byte(htmlContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create HTML file: %v", err)
	}

	// Compare text and HTML files - should succeed as both are text-based
	result, err := app.CompareFiles(textFile, htmlFile)
	if err != nil {
		t.Fatalf("CompareFiles failed: %v", err)
	}

	if result == nil || len(result.Lines) == 0 {
		t.Fatal("Expected diff results, got empty")
	}

	// Test with HTML file containing potential Windows-problematic content
	htmlWithSpecialChars := filepath.Join(tempDir, "special.html")
	specialContent := `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <style>
        /* Some CSS with special chars */
        .class::before { content: "→"; }
    </style>
</head>
<body>
    <p>Text with special chars: © ® ™ • … ""</p>
</body>
</html>`

	err = os.WriteFile(htmlWithSpecialChars, []byte(specialContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create HTML file with special chars: %v", err)
	}

	// Compare with HTML containing special characters
	result, err = app.CompareFiles(textFile, htmlWithSpecialChars)
	if err != nil {
		t.Fatalf("CompareFiles failed with special chars HTML: %v", err)
	}

	if result == nil || len(result.Lines) == 0 {
		t.Fatal("Expected diff results for special chars comparison, got empty")
	}
}

func TestApp_RemembersLastUsedDirectory(t *testing.T) {
	app := NewApp()

	// Initially, lastUsedDirectory should be empty
	if app.lastUsedDirectory != "" {
		t.Errorf("Expected empty lastUsedDirectory, got: %s", app.lastUsedDirectory)
	}

	// Simulate selecting a file using filepath.Join for cross-platform compatibility
	testPath := filepath.Join("home", "user", "documents", "test.txt")
	app.lastUsedDirectory = filepath.Dir(testPath)

	// Verify the directory was saved
	expectedDir := filepath.Join("home", "user", "documents")
	if app.lastUsedDirectory != expectedDir {
		t.Errorf("Expected lastUsedDirectory to be %s, got: %s", expectedDir, app.lastUsedDirectory)
	}

	// Test with another path to ensure it updates
	testPath2 := filepath.Join("tmp", "another", "test.txt")
	app.lastUsedDirectory = filepath.Dir(testPath2)

	expectedDir2 := filepath.Join("tmp", "another")
	if app.lastUsedDirectory != expectedDir2 {
		t.Errorf("Expected lastUsedDirectory to be %s, got: %s", expectedDir2, app.lastUsedDirectory)
	}
}
