package backend

import (
	"fmt"
	"sync"
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

// Global undo/redo state
var (
	operationHistory   []OperationGroup
	redoHistory        []OperationGroup
	currentTransaction *OperationGroup
	maxHistorySize     = 50
	isUndoing          = false // Prevent recording operations during undo
	isRedoing          = false // Prevent recording operations during redo
	historyMu          sync.Mutex
)

// BeginOperationGroup starts a new operation group for transaction-like undo
func (a *App) BeginOperationGroup(description string) string {
	historyMu.Lock()
	defer historyMu.Unlock()

	return a.beginOperationGroupLocked(description)
}

// beginOperationGroupLocked is the internal implementation without locking
func (a *App) beginOperationGroupLocked(description string) string {
	if currentTransaction != nil {
		// If there's an existing transaction, commit it first
		a.commitOperationGroupLocked()
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
	historyMu.Lock()
	defer historyMu.Unlock()

	a.commitOperationGroupLocked()
}

// commitOperationGroupLocked is the internal implementation without locking
func (a *App) commitOperationGroupLocked() {
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

	// Clear redo history when new operation is committed
	redoHistory = nil

	currentTransaction = nil
	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
}

// RollbackOperationGroup cancels the current operation group without adding to history
func (a *App) RollbackOperationGroup() {
	historyMu.Lock()
	defer historyMu.Unlock()

	currentTransaction = nil
}

// recordOperation adds an operation to the current group or creates a single-op group
func (a *App) recordOperation(op SingleOperation) {
	// Don't record operations during undo or redo
	// Check this BEFORE acquiring lock to avoid deadlock
	if isUndoing || isRedoing {
		return
	}

	historyMu.Lock()
	defer historyMu.Unlock()

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

		// Clear redo history when new operation is recorded
		redoHistory = nil

		a.updateUndoMenuItemLocked()
		a.updateRedoMenuItemLocked()
	}
}

// CanUndo returns whether there are operations to undo
func (a *App) CanUndo() bool {
	historyMu.Lock()
	defer historyMu.Unlock()

	return len(operationHistory) > 0
}

// GetLastOperationDescription returns the description of the last operation group
func (a *App) GetLastOperationDescription() string {
	historyMu.Lock()
	defer historyMu.Unlock()

	if len(operationHistory) == 0 {
		return ""
	}
	return operationHistory[len(operationHistory)-1].Description
}

// UndoLastOperation reverses the last operation group and moves it to redo history
func (a *App) UndoLastOperation() error {
	historyMu.Lock()
	defer historyMu.Unlock()

	if len(operationHistory) == 0 {
		return fmt.Errorf("no operations to undo")
	}

	// Set undoing flag to prevent recording undo operations
	isUndoing = true
	defer func() { isUndoing = false }()

	// Get the last operation group
	lastGroup := operationHistory[len(operationHistory)-1]

	// Remove from undo history
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

	// Add to redo history
	redoHistory = append(redoHistory, lastGroup)

	// Maintain max redo history size
	if len(redoHistory) > maxHistorySize {
		redoHistory = redoHistory[len(redoHistory)-maxHistorySize:]
	}

	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
	return nil
}

// updateUndoMenuItem updates the undo menu item text and state
func (a *App) updateUndoMenuItem() {
	historyMu.Lock()
	defer historyMu.Unlock()

	a.updateUndoMenuItemLocked()
}

// updateUndoMenuItemLocked is the internal implementation without locking
func (a *App) updateUndoMenuItemLocked() {
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

// CanRedo returns whether there are operations to redo
func (a *App) CanRedo() bool {
	historyMu.Lock()
	defer historyMu.Unlock()

	return len(redoHistory) > 0
}

// GetLastRedoOperationDescription returns the description of the last redo operation group
func (a *App) GetLastRedoOperationDescription() string {
	historyMu.Lock()
	defer historyMu.Unlock()

	if len(redoHistory) == 0 {
		return ""
	}
	return redoHistory[len(redoHistory)-1].Description
}

// RedoLastOperation reapplies the last undone operation group
func (a *App) RedoLastOperation() error {
	historyMu.Lock()
	defer historyMu.Unlock()

	if len(redoHistory) == 0 {
		return fmt.Errorf("no operations to redo")
	}

	// Set redoing flag to prevent recording redo operations
	isRedoing = true
	defer func() { isRedoing = false }()

	// Get the last redo operation group
	lastGroup := redoHistory[len(redoHistory)-1]

	// Remove from redo history
	redoHistory = redoHistory[:len(redoHistory)-1]

	// Redo operations in forward order
	for _, op := range lastGroup.Operations {
		switch op.Type {
		case OpCopy:
			// Redo a copy by re-inserting the line
			if err := a.CopyToFile(op.SourceFile, op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				return fmt.Errorf("failed to redo copy: %w", err)
			}
		case OpRemove:
			// Redo a remove by removing the line again
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				return fmt.Errorf("failed to redo remove: %w", err)
			}
		}
	}

	// Add back to undo history
	operationHistory = append(operationHistory, lastGroup)

	// Maintain max undo history size
	if len(operationHistory) > maxHistorySize {
		operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
	}

	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
	return nil
}

// updateRedoMenuItem updates the redo menu item text and state
func (a *App) updateRedoMenuItem() {
	historyMu.Lock()
	defer historyMu.Unlock()

	a.updateRedoMenuItemLocked()
}

// updateRedoMenuItemLocked is the internal implementation without locking
func (a *App) updateRedoMenuItemLocked() {
	if a.redoMenuItem == nil {
		return
	}

	if len(redoHistory) > 0 {
		a.redoMenuItem.Label = "Redo"
		a.redoMenuItem.Disabled = false
	} else {
		a.redoMenuItem.Label = "Redo"
		a.redoMenuItem.Disabled = true
	}

	runtime.MenuUpdateApplicationMenu(a.ctx)
}
