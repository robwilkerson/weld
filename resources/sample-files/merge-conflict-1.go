//go:build ignore

// WARNING: Do not remove the build tag above!
// This file is test data for the diff tool and should not be compiled.
// The build tag prevents Go from trying to build this file during tests,
// which would fail due to duplicate declarations with merge-conflict-2.go.

// Test: Conflicting modifications scenario
// File 1: One version of the modifications

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
	// Version 1: Flat rate shipping
	if o.Total < 50 {
		return 9.99
	}
	return 0 // Free shipping over $50
}

func (o *Order) ApplyTax(rate float64) {
	// Version 1: Simple tax calculation
	tax := o.Total * rate
	o.Total = o.Total + tax
}

func (o *Order) UpdateStatus(newStatus string) error {
	// Version 1: Direct status update
	o.Status = newStatus
	fmt.Printf("Order %s status updated to: %s\n", o.ID, newStatus)
	return nil
}

func ProcessOrder(order *Order) {
	shipping := order.CalculateShipping()
	order.Total += shipping

	// Apply standard tax rate
	order.ApplyTax(0.08)

	order.UpdateStatus("Processing")

	fmt.Printf("Order total with shipping and tax: $%.2f\n", order.Total)
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
