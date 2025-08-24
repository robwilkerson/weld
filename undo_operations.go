package main

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Undo operation types
type OperationType string

const (
	OpCopy   OperationType = "copy"
	OpRemove OperationType = "remove"
)

// SingleOperation represents a single atomic operation
type SingleOperation struct {
	Type        OperationType
	SourceFile  string
	TargetFile  string
	LineNumber  int
	LineContent string
	InsertIndex int
}

// OperationGroup represents a group of operations that should be undone together
type OperationGroup struct {
	ID          string            `json:"id"`
	Description string            `json:"description"`
	Operations  []SingleOperation `json:"operations"`
	Timestamp   time.Time         `json:"timestamp"`
}

// Global undo state
var (
	operationHistory   []OperationGroup
	currentTransaction *OperationGroup
	maxHistorySize     = 50
	isUndoing          = false // Prevent recording operations during undo
)

// BeginOperationGroup starts a new operation group for transaction-like undo
func (a *App) BeginOperationGroup(description string) string {
	if currentTransaction != nil {
		// If there's an existing transaction, commit it first
		a.CommitOperationGroup()
	}

	currentTransaction = &OperationGroup{
		ID:          uuid.New().String(),
		Description: description,
		Operations:  []SingleOperation{},
		Timestamp:   time.Now(),
	}

	return currentTransaction.ID
}

// CommitOperationGroup finalizes the current operation group and adds it to history
func (a *App) CommitOperationGroup() {
	if currentTransaction == nil || len(currentTransaction.Operations) == 0 {
		currentTransaction = nil
		return
	}

	// Add to history
	operationHistory = append(operationHistory, *currentTransaction)

	// Maintain max history size
	if len(operationHistory) > maxHistorySize {
		operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
	}

	currentTransaction = nil
	a.updateUndoMenuItem()
}

// RollbackOperationGroup cancels the current operation group without adding to history
func (a *App) RollbackOperationGroup() {
	currentTransaction = nil
}

// recordOperation adds an operation to the current group or creates a single-op group
func (a *App) recordOperation(op SingleOperation) {
	// Don't record operations during undo
	if isUndoing {
		return
	}

	if currentTransaction != nil {
		currentTransaction.Operations = append(currentTransaction.Operations, op)
	} else {
		// Create a single-operation group
		group := OperationGroup{
			ID:          uuid.New().String(),
			Description: fmt.Sprintf("%s line", op.Type),
			Operations:  []SingleOperation{op},
			Timestamp:   time.Now(),
		}
		operationHistory = append(operationHistory, group)

		// Maintain max history size
		if len(operationHistory) > maxHistorySize {
			operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
		}

		a.updateUndoMenuItem()
	}
}

// CanUndo returns whether there are operations to undo
func (a *App) CanUndo() bool {
	return len(operationHistory) > 0
}

// GetLastOperationDescription returns the description of the last operation group
func (a *App) GetLastOperationDescription() string {
	if len(operationHistory) == 0 {
		return ""
	}
	return operationHistory[len(operationHistory)-1].Description
}

// UndoLastOperation reverses the last operation group
func (a *App) UndoLastOperation() error {
	if len(operationHistory) == 0 {
		return fmt.Errorf("no operations to undo")
	}

	// Set undoing flag to prevent recording undo operations
	isUndoing = true
	defer func() { isUndoing = false }()

	// Get the last operation group
	lastGroup := operationHistory[len(operationHistory)-1]

	// Remove from history
	operationHistory = operationHistory[:len(operationHistory)-1]

	// Undo operations in reverse order
	for i := len(lastGroup.Operations) - 1; i >= 0; i-- {
		op := lastGroup.Operations[i]

		switch op.Type {
		case OpCopy:
			// Undo a copy by removing the line
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				return fmt.Errorf("failed to undo copy: %w", err)
			}
		case OpRemove:
			// Undo a remove by re-inserting the line
			if err := a.CopyToFile("", op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				return fmt.Errorf("failed to undo remove: %w", err)
			}
		}
	}

	a.updateUndoMenuItem()
	return nil
}

// updateUndoMenuItem updates the undo menu item text and state
func (a *App) updateUndoMenuItem() {
	if a.undoMenuItem == nil {
		return
	}

	if len(operationHistory) > 0 {
		a.undoMenuItem.Label = "Undo"
		a.undoMenuItem.Disabled = false
	} else {
		a.undoMenuItem.Label = "Undo"
		a.undoMenuItem.Disabled = true
	}

	runtime.MenuUpdateApplicationMenu(a.ctx)
}
