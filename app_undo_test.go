package main

import (
	"testing"
)

func TestApp_UndoOperations(t *testing.T) {
	app := &App{}

	// Reset global state
	operationHistory = []OperationGroup{}
	currentTransaction = nil
	isUndoing = false

	t.Run("BeginOperationGroup", func(t *testing.T) {
		id := app.BeginOperationGroup("Test operation")
		if id == "" {
			t.Error("Expected non-empty ID")
		}
		if currentTransaction == nil {
			t.Error("Expected currentTransaction to be set")
		}
		if currentTransaction.Description != "Test operation" {
			t.Errorf("Expected description 'Test operation', got %s", currentTransaction.Description)
		}
	})

	t.Run("CommitOperationGroup", func(t *testing.T) {
		// Start a new transaction
		app.BeginOperationGroup("Test commit")

		// Add some operations
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})

		// Commit
		app.CommitOperationGroup()

		if currentTransaction != nil {
			t.Error("Expected currentTransaction to be nil after commit")
		}
		if len(operationHistory) != 1 {
			t.Errorf("Expected 1 operation in history, got %d", len(operationHistory))
		}
		if operationHistory[0].Description != "Test commit" {
			t.Errorf("Expected description 'Test commit', got %s", operationHistory[0].Description)
		}
	})

	t.Run("RollbackOperationGroup", func(t *testing.T) {
		historyBefore := len(operationHistory)

		app.BeginOperationGroup("Test rollback")
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})

		app.RollbackOperationGroup()

		if currentTransaction != nil {
			t.Error("Expected currentTransaction to be nil after rollback")
		}
		if len(operationHistory) != historyBefore {
			t.Error("Expected operation history to remain unchanged after rollback")
		}
	})

	t.Run("CanUndo", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}

		if app.CanUndo() {
			t.Error("Expected CanUndo to return false with empty history")
		}

		// Add an operation
		app.BeginOperationGroup("Test undo")
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})
		app.CommitOperationGroup()

		if !app.CanUndo() {
			t.Error("Expected CanUndo to return true with operations in history")
		}
	})

	t.Run("GetLastOperationDescription", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}

		if app.GetLastOperationDescription() != "" {
			t.Error("Expected empty description with no operations")
		}

		// Add an operation
		app.BeginOperationGroup("Last operation test")
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})
		app.CommitOperationGroup()

		if app.GetLastOperationDescription() != "Last operation test" {
			t.Errorf("Expected 'Last operation test', got %s", app.GetLastOperationDescription())
		}
	})

	t.Run("recordOperation_SingleOperation", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}
		currentTransaction = nil

		// Record without transaction
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})

		if len(operationHistory) != 1 {
			t.Errorf("Expected 1 operation in history, got %d", len(operationHistory))
		}
		if operationHistory[0].Description != "copy line" {
			t.Errorf("Expected 'copy line', got %s", operationHistory[0].Description)
		}
	})

	t.Run("recordOperation_DuringUndo", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}
		isUndoing = true

		// Try to record during undo
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test line",
			InsertIndex: 1,
		})

		if len(operationHistory) != 0 {
			t.Error("Expected no operations to be recorded during undo")
		}

		isUndoing = false
	})

	t.Run("MaxHistorySize", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}

		// Add more than maxHistorySize operations
		for i := 0; i < maxHistorySize+10; i++ {
			app.recordOperation(SingleOperation{
				Type:        OpCopy,
				SourceFile:  "source.txt",
				TargetFile:  "target.txt",
				LineNumber:  i,
				LineContent: "test line",
				InsertIndex: i,
			})
		}

		if len(operationHistory) != maxHistorySize {
			t.Errorf("Expected history size to be capped at %d, got %d", maxHistorySize, len(operationHistory))
		}
	})
}

func TestApp_UndoLastOperation(t *testing.T) {
	app := &App{}

	t.Run("UndoLastOperation_NoOperations", func(t *testing.T) {
		// Clear history
		operationHistory = []OperationGroup{}

		err := app.UndoLastOperation()
		if err == nil {
			t.Error("Expected error when undoing with no operations")
		}
	})

	t.Run("UndoLastOperation_CopyOperation", func(t *testing.T) {
		// Clear history and reset state
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)

		// Set up initial file state
		targetLines := []string{"line1", "line2", "line3"}
		app.storeFileInMemory("target.txt", targetLines)

		// Record a copy operation
		app.BeginOperationGroup("Copy test")
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  2,
			LineContent: "inserted line",
			InsertIndex: 2, // This is where it was inserted
		})
		app.CommitOperationGroup()

		// Undo the operation
		err := app.UndoLastOperation()
		if err != nil {
			t.Errorf("Unexpected error during undo: %v", err)
		}

		// Check that the operation was removed from history
		if len(operationHistory) != 0 {
			t.Error("Expected operation to be removed from history")
		}
	})

	t.Run("UndoLastOperation_RemoveOperation", func(t *testing.T) {
		// Clear history and reset state
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)

		// Set up initial file state (after a line was removed)
		targetLines := []string{"line1", "line3"}
		app.storeFileInMemory("target.txt", targetLines)

		// Record a remove operation
		app.BeginOperationGroup("Remove test")
		app.recordOperation(SingleOperation{
			Type:        OpRemove,
			SourceFile:  "",
			TargetFile:  "target.txt",
			LineNumber:  2, // Original line number before removal
			LineContent: "line2",
			InsertIndex: 0,
		})
		app.CommitOperationGroup()

		// Undo the operation
		err := app.UndoLastOperation()
		if err != nil {
			t.Errorf("Unexpected error during undo: %v", err)
		}

		// Check that the operation was removed from history
		if len(operationHistory) != 0 {
			t.Error("Expected operation to be removed from history")
		}
	})

	t.Run("UndoLastOperation_MultipleOperations", func(t *testing.T) {
		// Clear history and reset state
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)

		// Set up initial file states
		leftLines := []string{"left1", "left2", "left3"}
		rightLines := []string{"right1", "right2", "right3", "new line"}
		app.storeFileInMemory("left.txt", leftLines)
		app.storeFileInMemory("right.txt", rightLines)

		// Record a group of operations
		app.BeginOperationGroup("Multiple operations")
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "left.txt",
			TargetFile:  "right.txt",
			LineNumber:  4,
			LineContent: "new line",
			InsertIndex: 4,
		})
		app.recordOperation(SingleOperation{
			Type:        OpRemove,
			SourceFile:  "",
			TargetFile:  "left.txt",
			LineNumber:  2,
			LineContent: "left2",
			InsertIndex: 0,
		})
		app.CommitOperationGroup()

		// Undo the operations
		err := app.UndoLastOperation()
		if err != nil {
			t.Errorf("Unexpected error during undo: %v", err)
		}

		// Check that the operations were removed from history
		if len(operationHistory) != 0 {
			t.Error("Expected operations to be removed from history")
		}
	})

	t.Run("UndoLastOperation_SetsUndoingFlag", func(t *testing.T) {
		// Clear history and reset state
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)
		isUndoing = false

		// Add a simple operation
		app.recordOperation(SingleOperation{
			Type:        OpCopy,
			SourceFile:  "source.txt",
			TargetFile:  "target.txt",
			LineNumber:  1,
			LineContent: "test",
			InsertIndex: 1,
		})

		// Store target file to avoid errors
		app.storeFileInMemory("target.txt", []string{"test"})

		// Undo the operation
		err := app.UndoLastOperation()
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Check that isUndoing was reset
		if isUndoing {
			t.Error("Expected isUndoing to be reset to false after undo")
		}
	})
}

func TestApp_IntegrationWithFileOperations(t *testing.T) {
	app := &App{}

	t.Run("CopyToFile_RecordsOperation", func(t *testing.T) {
		// Clear history and cache
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)
		isUndoing = false

		// Set up initial file
		app.storeFileInMemory("target.txt", []string{"line1", "line2"})

		// Perform copy
		err := app.CopyToFile("source.txt", "target.txt", 2, "new line")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Check that operation was recorded
		if len(operationHistory) != 1 {
			t.Errorf("Expected 1 operation in history, got %d", len(operationHistory))
		}
		if operationHistory[0].Operations[0].Type != OpCopy {
			t.Error("Expected copy operation to be recorded")
		}
	})

	t.Run("RemoveLineFromFile_RecordsOperation", func(t *testing.T) {
		// Clear history and cache
		operationHistory = []OperationGroup{}
		fileCache = make(map[string][]string)
		isUndoing = false

		// Set up initial file
		app.storeFileInMemory("target.txt", []string{"line1", "line2", "line3"})

		// Perform remove
		err := app.RemoveLineFromFile("target.txt", 2)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Check that operation was recorded
		if len(operationHistory) != 1 {
			t.Errorf("Expected 1 operation in history, got %d", len(operationHistory))
		}
		if operationHistory[0].Operations[0].Type != OpRemove {
			t.Error("Expected remove operation to be recorded")
		}
		if operationHistory[0].Operations[0].LineContent != "line2" {
			t.Errorf("Expected removed line content to be 'line2', got %s",
				operationHistory[0].Operations[0].LineContent)
		}
	})
}
