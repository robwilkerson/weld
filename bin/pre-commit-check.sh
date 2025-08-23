#!/bin/bash

# Pre-Commit Check Script
# Run this before committing to ensure quality checks NOT covered by CI
#
# Checks only items that CI doesn't validate:
# 1. Check for debugging code (console.log, fmt.Printf, etc.)
# 2. Run formatters (Go fmt, Biome) on staged files
#
# CI handles: tests, E2E tests, builds, and cross-platform testing
# Note: Commit message validation happens in .githooks/commit-msg

set -e  # Exit on error

echo "🔍 Starting Pre-Commit Checks..."
echo "================================"

# Function to print colored output
print_success() { echo -e "\033[32m✓ $1\033[0m"; }
print_error() { echo -e "\033[31m✗ $1\033[0m"; }
print_info() { echo -e "\033[34mℹ $1\033[0m"; }
print_warning() { echo -e "\033[33m⚠ $1\033[0m"; }

# Exit immediately on first failure
exit_on_error() {
    print_error "$1"
    echo -e "\nTip: Fix this issue and run the check again."
    echo "You can bypass these checks with 'git commit --no-verify' but it's not recommended."
    exit 1
}

# 1. Check for debugging code
echo -e "\n🔍 Checking for debugging code..."
PATTERNS=(
    "console\.log"
    "fmt\.Printf"
    "fmt\.Println"
    "debugger"
    "FIXME:"
    "XXX:"
    "HACK:"
)

FOUND_DEBUG=false
for pattern in "${PATTERNS[@]}"; do
    # Skip test files, e2e files, markdown docs, sample files, and this script
    if git diff --cached --name-only | xargs grep -l "$pattern" 2>/dev/null | grep -v -E "(test|spec|e2e)\.(ts|js|go)$" | grep -v "\.md$" | grep -v "pre-commit-check.sh" | grep -v "sample-files/"; then
        print_warning "Found '$pattern' in staged files"
        FOUND_DEBUG=true
    fi
done

if [ "$FOUND_DEBUG" = true ]; then
    exit_on_error "Debugging code or markers found. Please clean up before committing."
fi
print_success "No debugging code found"

# 2. Run formatters on staged files only
echo -e "\n🎨 Running formatters..."

# Get list of staged Go files
STAGED_GO_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' || true)
if [ -n "$STAGED_GO_FILES" ]; then
    # Check if any Go files need formatting
    NEEDS_FORMAT=false
    for file in $STAGED_GO_FILES; do
        if command -v gofmt >/dev/null 2>&1 && [ -n "$(gofmt -l "$file")" ]; then
            print_warning "$file needs formatting"
            NEEDS_FORMAT=true
        fi
    done
    
    if [ "$NEEDS_FORMAT" = true ]; then
        print_info "Running go fmt on staged Go files..."
        echo "$STAGED_GO_FILES" | xargs go fmt
        exit_on_error "Go files formatted. Please stage the formatting changes."
    fi
    print_success "Go files are properly formatted"
else
    print_info "No Go files to check"
fi

# Get list of staged frontend files (including E2E tests)
STAGED_FRONTEND_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "frontend/(src|tests/e2e)/.*\.(ts|js|svelte)$" || true)
if [ -n "$STAGED_FRONTEND_FILES" ]; then
    cd frontend
    # Create a temporary file list for biome
    echo "$STAGED_FRONTEND_FILES" | sed 's|frontend/||' > /tmp/staged-files.txt
    
    # Check with biome
    if ! cat /tmp/staged-files.txt | xargs npx @biomejs/biome check 2>/dev/null; then
        print_info "Running biome formatter on staged frontend files..."
        cat /tmp/staged-files.txt | xargs npx @biomejs/biome check --write
        rm /tmp/staged-files.txt
        cd ..
        exit_on_error "Frontend files formatted. Please stage the formatting changes."
    fi
    print_success "Frontend files pass biome checks"
    
    rm /tmp/staged-files.txt
    cd ..
else
    print_info "No frontend files to check"
fi

# Note: Tests are handled by CI pipeline

# Final summary - only shown if all checks pass
echo -e "\n================================"
print_success "All pre-commit checks passed! ✨"
echo -e "\nYou're ready to commit."