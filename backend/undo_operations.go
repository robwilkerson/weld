package backend

import (
	"fmt"
	"sync"
	"sync/atomic"
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
	isUndoing          atomic.Bool // Prevent recording operations during undo
	isRedoing          atomic.Bool // Prevent recording operations during redo
	historyMu          sync.Mutex
)

// BeginOperationGroup starts a new operation group for transaction-like undo
func (a *App) BeginOperationGroup(description string) string {
	historyMu.Lock()
	hadTransaction := currentTransaction != nil
	id := a.beginOperationGroupLocked(description)
	historyMu.Unlock()

	// Update menu after releasing lock if we auto-committed a transaction
	if hadTransaction && a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}

	return id
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
	a.commitOperationGroupLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
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
// It reverts all operations in the transaction to ensure files are not left in a modified state
func (a *App) RollbackOperationGroup() {
	historyMu.Lock()

	if currentTransaction == nil || len(currentTransaction.Operations) == 0 {
		currentTransaction = nil
		historyMu.Unlock()
		return
	}

	// Set undoing flag to prevent recording rollback operations
	isUndoing.Store(true)
	defer isUndoing.Store(false)

	// Revert operations in reverse order
	for i := len(currentTransaction.Operations) - 1; i >= 0; i-- {
		op := currentTransaction.Operations[i]

		switch op.Type {
		case OpCopy:
			// Undo a copy by removing the line
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				// Log error but continue with rollback
				fmt.Printf("Warning: failed to rollback copy operation: %v\n", err)
			}
		case OpRemove:
			// Undo a remove by re-inserting the line
			if err := a.CopyToFile("", op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				// Log error but continue with rollback
				fmt.Printf("Warning: failed to rollback remove operation: %v\n", err)
			}
		}
	}

	currentTransaction = nil
	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
}

// recordOperation adds an operation to the current group or creates a single-op group
func (a *App) recordOperation(op SingleOperation) {
	// Don't record operations during undo or redo
	// Check this BEFORE acquiring lock to avoid deadlock
	if isUndoing.Load() || isRedoing.Load() {
		return
	}

	historyMu.Lock()
	needsMenuUpdate := false

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
		needsMenuUpdate = true
	}
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if needsMenuUpdate && a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
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

	if len(operationHistory) == 0 {
		historyMu.Unlock()
		return fmt.Errorf("no operations to undo")
	}

	// Set undoing flag to prevent recording undo operations
	isUndoing.Store(true)
	defer isUndoing.Store(false)

	// Get the last operation group
	lastGroup := operationHistory[len(operationHistory)-1]

	// Undo operations in reverse order BEFORE modifying history stacks
	// This ensures atomicity - if any operation fails, history remains unchanged
	for i := len(lastGroup.Operations) - 1; i >= 0; i-- {
		op := lastGroup.Operations[i]

		switch op.Type {
		case OpCopy:
			// Undo a copy by removing the line
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				historyMu.Unlock()
				return fmt.Errorf("failed to undo copy: %w", err)
			}
		case OpRemove:
			// Undo a remove by re-inserting the line
			if err := a.CopyToFile("", op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				historyMu.Unlock()
				return fmt.Errorf("failed to undo remove: %w", err)
			}
		}
	}

	// Only after successful undo, move between stacks
	// Remove from undo history
	operationHistory = operationHistory[:len(operationHistory)-1]

	// Add to redo history
	redoHistory = append(redoHistory, lastGroup)

	// Maintain max redo history size
	if len(redoHistory) > maxHistorySize {
		redoHistory = redoHistory[len(redoHistory)-maxHistorySize:]
	}

	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
	return nil
}

// updateUndoMenuItem updates the undo menu item text and state
func (a *App) updateUndoMenuItem() {
	historyMu.Lock()
	a.updateUndoMenuItemLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
}

// updateUndoMenuItemLocked is the internal implementation without locking
// Does NOT call MenuUpdateApplicationMenu - caller must do that after unlocking
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

	if len(redoHistory) == 0 {
		historyMu.Unlock()
		return fmt.Errorf("no operations to redo")
	}

	// Set redoing flag to prevent recording redo operations
	isRedoing.Store(true)
	defer isRedoing.Store(false)

	// Get the last redo operation group
	lastGroup := redoHistory[len(redoHistory)-1]

	// Redo operations in forward order BEFORE modifying history stacks
	// This ensures atomicity - if any operation fails, history remains unchanged
	for _, op := range lastGroup.Operations {
		switch op.Type {
		case OpCopy:
			// Redo a copy by re-inserting the line
			if err := a.CopyToFile(op.SourceFile, op.TargetFile, op.LineNumber, op.LineContent); err != nil {
				historyMu.Unlock()
				return fmt.Errorf("failed to redo copy: %w", err)
			}
		case OpRemove:
			// Redo a remove by removing the line again
			if err := a.RemoveLineFromFile(op.TargetFile, op.InsertIndex); err != nil {
				historyMu.Unlock()
				return fmt.Errorf("failed to redo remove: %w", err)
			}
		}
	}

	// Only after successful redo, move between stacks
	// Remove from redo history
	redoHistory = redoHistory[:len(redoHistory)-1]

	// Add back to undo history
	operationHistory = append(operationHistory, lastGroup)

	// Maintain max undo history size
	if len(operationHistory) > maxHistorySize {
		operationHistory = operationHistory[len(operationHistory)-maxHistorySize:]
	}

	a.updateUndoMenuItemLocked()
	a.updateRedoMenuItemLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
	return nil
}

// updateRedoMenuItem updates the redo menu item text and state
func (a *App) updateRedoMenuItem() {
	historyMu.Lock()
	a.updateRedoMenuItemLocked()
	historyMu.Unlock()

	// Update menu after releasing lock to avoid blocking while holding mutex
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
}

// updateRedoMenuItemLocked is the internal implementation without locking
// Does NOT call MenuUpdateApplicationMenu - caller must do that after unlocking
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
}
