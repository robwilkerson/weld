//go:build ignore

// WARNING: Do not remove the build tag above!
// This file is test data for the diff tool and should not be compiled.
// The build tag prevents Go from trying to build this file during tests,
// which would fail due to duplicate declarations with merge-conflict-1.go.

// Test: Conflicting modifications scenario
// File 2: Different version of the same modifications

package main

import (
	"fmt"
	"time"
)

type Order struct {
	ID        string
	Customer  string
	Total     float64
	Status    string
	CreatedAt time.Time
}

func (o *Order) CalculateShipping() float64 {
	// Version 2: Tiered shipping rates
	if o.Total < 25 {
		return 12.99
	} else if o.Total < 75 {
		return 5.99
	}
	return 0 // Free shipping over $75
}

func (o *Order) ApplyTax(rate float64) {
	// Version 2: Tax with rounding
	tax := o.Total * rate
	tax = float64(int(tax*100+0.5)) / 100 // Round to 2 decimal places
	o.Total = o.Total + tax
}

func (o *Order) UpdateStatus(newStatus string) error {
	// Version 2: Status update with validation
	validStatuses := []string{"Pending", "Processing", "Shipped", "Delivered"}
	isValid := false
	for _, status := range validStatuses {
		if status == newStatus {
			isValid = true
			break
		}
	}

	if !isValid {
		return fmt.Errorf("invalid status: %s", newStatus)
	}

	o.Status = newStatus
	fmt.Printf("[%s] Order %s status: %s\n", time.Now().Format("15:04:05"), o.ID, newStatus)
	return nil
}

func ProcessOrder(order *Order) {
	shipping := order.CalculateShipping()
	order.Total += shipping

	// Apply regional tax rate
	order.ApplyTax(0.0875)

	err := order.UpdateStatus("Processing")
	if err != nil {
		fmt.Printf("Error updating status: %v\n", err)
	}

	fmt.Printf("Order total (incl. shipping + tax): $%.2f\n", order.Total)
}

func main() {
	order := &Order{
		ID:        "ORD-001",
		Customer:  "John Doe",
		Total:     45.00,
		Status:    "Pending",
		CreatedAt: time.Now(),
	}

	ProcessOrder(order)
}
