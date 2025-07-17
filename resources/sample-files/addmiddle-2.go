//go:build ignore

// WARNING: Do not remove the build tag above!
// This file is test data for the diff tool and should not be compiled.
// The build tag prevents Go from trying to build this file during tests,
// which would fail due to duplicate declarations with addmiddle-1.go.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// User represents a user in our system
type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	Active    bool      `json:"active"`
}

// UserService provides user-related operations
type UserService interface {
	GetUser(ctx context.Context, id int) (*User, error)
	CreateUser(ctx context.Context, user *User) error
	UpdateUser(ctx context.Context, user *User) error
	DeleteUser(ctx context.Context, id int) error
}

// userService implements UserService
type userService struct {
	mu    sync.RWMutex
	users map[int]*User
}

// NewUserService creates a new UserService instance
func NewUserService() UserService {
	return &userService{
		users: make(map[int]*User),
	}
}

// GetUser retrieves a user by ID
func (s *userService) GetUser(ctx context.Context, id int) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[id]
	if !exists {
		return nil, fmt.Errorf("user with ID %d not found", id)
	}

	return user, nil
}

// CreateUser creates a new user
func (s *userService) CreateUser(ctx context.Context, user *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[user.ID]; exists {
		return fmt.Errorf("user with ID %d already exists", user.ID)
	}

	user.CreatedAt = time.Now()
	s.users[user.ID] = user

	// Log user creation for audit trail
	log.Printf("Created user: ID=%d, Name=%s, Email=%s", user.ID, user.Name, user.Email)

	// Send welcome email notification (stub)
	go func() {
		// In a real application, this would send an actual email
		time.Sleep(100 * time.Millisecond)
		log.Printf("Welcome email sent to %s", user.Email)
	}()

	return nil
}

// UpdateUser updates an existing user
func (s *userService) UpdateUser(ctx context.Context, user *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[user.ID]; !exists {
		return fmt.Errorf("user with ID %d not found", user.ID)
	}

	s.users[user.ID] = user

	return nil
}

// DeleteUser deletes a user by ID
func (s *userService) DeleteUser(ctx context.Context, id int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.users[id]; !exists {
		return fmt.Errorf("user with ID %d not found", id)
	}

	delete(s.users, id)

	return nil
}

// HTTP Handlers

// handleGetUser handles GET /users/{id}
func handleGetUser(service UserService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract user ID from path
		// This is simplified - in real code, use a router like gorilla/mux
		var userID int
		fmt.Sscanf(r.URL.Path, "/users/%d", &userID)

		user, err := service.GetUser(r.Context(), userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
	}
}

// handleCreateUser handles POST /users
func handleCreateUser(service UserService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var user User
		if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if err := service.CreateUser(r.Context(), &user); err != nil {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(user)
	}
}

func main() {
	// Initialize service
	service := NewUserService()

	// Create sample users
	sampleUsers := []User{
		{ID: 1, Name: "Alice Smith", Email: "alice@example.com", Active: true},
		{ID: 2, Name: "Bob Johnson", Email: "bob@example.com", Active: true},
		{ID: 3, Name: "Charlie Brown", Email: "charlie@example.com", Active: false},
	}

	for _, user := range sampleUsers {
		if err := service.CreateUser(context.Background(), &user); err != nil {
			log.Printf("Failed to create user: %v", err)
		}
	}

	// Set up HTTP routes
	http.HandleFunc("/users/", handleGetUser(service))
	http.HandleFunc("/users", handleCreateUser(service))

	// Start server
	port := ":8080"
	log.Printf("Starting server on %s", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}
