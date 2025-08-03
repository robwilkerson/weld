#!/bin/bash

# Pre-Commit Check Script
# Run this before committing to ensure basic quality checks pass
#
# Checks are run in order, stopping at the first failure:
# 1. Check for debugging code (console.log, fmt.Printf, etc.)
# 2. Run formatters (Go fmt, Biome) on staged files
# 3. Run tests for changed packages/components
# 4. Run E2E tests if frontend changed and dev server is running
#
# Note: Commit message validation happens after these checks
# in .githooks/commit-msg (50 char subject limit)

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
    # Skip test files, e2e files, markdown docs, and this script
    if git diff --cached --name-only | xargs grep -l "$pattern" 2>/dev/null | grep -v -E "(test|spec|e2e)\.(ts|js|go)$" | grep -v "\.md$" | grep -v "pre-commit-check.sh"; then
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
        if [ -n "$(gofmt -l "$file")" ]; then
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

# 3. Run tests for changed files
echo -e "\n🧪 Running relevant tests..."

# Check if we have backend changes
if [ -n "$STAGED_GO_FILES" ]; then
    # Find packages with changes
    CHANGED_PACKAGES=$(echo "$STAGED_GO_FILES" | xargs -n1 dirname | sort -u | grep -v "^\\.$" || echo ".")
    
    print_info "Running tests for changed Go packages..."
    for pkg in $CHANGED_PACKAGES; do
        if ! go test "./$pkg" -v > /tmp/go-test-commit.log 2>&1; then
            echo "See /tmp/go-test-commit.log for details"
            exit_on_error "Tests failed in package: $pkg"
        fi
    done
    
    print_success "Backend tests passed"
fi

# Check if we have frontend changes that need testing
if [ -n "$STAGED_FRONTEND_FILES" ]; then
    print_info "Running all frontend tests to catch regressions..."
    cd frontend
    # Run all tests except integration tests (which are outdated)
    if ! bun run test src/stores/ src/components/ src/utils/ --run > /tmp/frontend-test-commit.log 2>&1; then
        echo "See /tmp/frontend-test-commit.log for details"
        cd ..
        exit_on_error "Frontend tests failed"
    fi
    print_success "Frontend tests passed"
    cd ..
fi

# Note: Commit message checking moved to .githooks/commit-msg hook

# 4. Run E2E tests if frontend files changed (run last to avoid multiple runs)
if [ -n "$STAGED_FRONTEND_FILES" ]; then
    echo -e "\n🎭 Checking if E2E tests should run..."
    
    # Check if wails dev server is running
    if curl -s http://localhost:34115 > /dev/null 2>&1; then
        print_info "Wails dev server detected. Running E2E tests..."
        cd frontend
        
        # Run E2E tests in headless mode (they have their own timeout in playwright.config.ts)
        if ! bun run test:e2e:headless > /tmp/e2e-test-commit.log 2>&1; then
            echo "See /tmp/e2e-test-commit.log for details"
            cd ..
            exit_on_error "E2E tests failed or timed out (2 min limit)\nPlease ensure E2E tests pass before pushing"
        fi
        print_success "E2E tests passed"
        cd ..
    else
        print_warning "Wails dev server not running. Skipping E2E tests."
        print_info "Start with 'wails dev' to run E2E tests during pre-commit"
    fi
fi

# Final summary - only shown if all checks pass
echo -e "\n================================"
print_success "All pre-commit checks passed! ✨"
echo -e "\nYou're ready to commit."