#!/bin/bash

# Pre-Commit Check Script
# Run this before committing to ensure basic quality checks pass

set -e  # Exit on error

echo "🔍 Starting Pre-Commit Checks..."
echo "================================"

# Function to print colored output
print_success() { echo -e "\033[32m✓ $1\033[0m"; }
print_error() { echo -e "\033[31m✗ $1\033[0m"; }
print_info() { echo -e "\033[34mℹ $1\033[0m"; }
print_warning() { echo -e "\033[33m⚠ $1\033[0m"; }

# Track if any checks fail
CHECKS_PASSED=true

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
    print_error "Debugging code or markers found. Please clean up before committing."
    CHECKS_PASSED=false
else
    print_success "No debugging code found"
fi

# 2. Run formatters on staged files only
echo -e "\n🎨 Running formatters..."

# Get list of staged Go files
STAGED_GO_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.go$' || true)
if [ -n "$STAGED_GO_FILES" ]; then
    # Check if any Go files need formatting
    NEEDS_FORMAT=false
    for file in $STAGED_GO_FILES; do
        if ! gofmt -l "$file" | grep -q "^$"; then
            print_warning "$file needs formatting"
            NEEDS_FORMAT=true
        fi
    done
    
    if [ "$NEEDS_FORMAT" = true ]; then
        print_info "Running go fmt on staged Go files..."
        echo "$STAGED_GO_FILES" | xargs go fmt
        print_warning "Go files formatted. Please stage the formatting changes."
        CHECKS_PASSED=false
    else
        print_success "Go files are properly formatted"
    fi
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
        print_warning "Frontend files formatted. Please stage the formatting changes."
        CHECKS_PASSED=false
    else
        print_success "Frontend files pass biome checks"
    fi
    
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
            print_error "Tests failed in package: $pkg"
            echo "See /tmp/go-test-commit.log for details"
            CHECKS_PASSED=false
        fi
    done
    
    if [ "$CHECKS_PASSED" = true ]; then
        print_success "Backend tests passed"
    fi
fi

# Check if we have frontend changes that need testing
if [ -n "$STAGED_FRONTEND_FILES" ]; then
    print_info "Running all frontend tests to catch regressions..."
    cd frontend
    # Run all tests except integration tests (which are outdated)
    if ! bun run test src/stores/ src/components/ src/utils/ --run > /tmp/frontend-test-commit.log 2>&1; then
        print_error "Frontend tests failed"
        echo "See /tmp/frontend-test-commit.log for details"
        CHECKS_PASSED=false
    else
        print_success "Frontend tests passed"
    fi
    cd ..
fi

# 4. Check commit message (this is critical - always check)
echo -e "\n📝 Checking commit message..."

# Get the commit message from either the file or stdin
if [ -f .git/COMMIT_EDITMSG ]; then
    # Normal commit flow
    FIRST_LINE=$(head -n1 .git/COMMIT_EDITMSG | grep -v "^#" | head -n1)
elif [ -p /dev/stdin ]; then
    # Git hook flow (message comes via stdin)
    FIRST_LINE=$(cat | head -n1)
else
    # Try to get from git log if we're amending
    FIRST_LINE=$(git log -1 --pretty=%s 2>/dev/null || echo "")
fi

if [ -n "$FIRST_LINE" ]; then
    LENGTH=$(echo -n "$FIRST_LINE" | wc -c | tr -d ' ')
    
    if [ "$LENGTH" -gt 50 ]; then
        print_error "Commit subject line is $LENGTH characters (max 50)"
        print_info "Subject: \"$FIRST_LINE\""
        echo -e "\nPlease shorten your commit message subject line."
        CHECKS_PASSED=false
    else
        print_success "Commit message length OK ($LENGTH/50 chars)"
    fi
else
    print_warning "Could not check commit message length"
fi

# 5. Run E2E tests if frontend files changed (run last to avoid multiple runs)
if [ -n "$STAGED_FRONTEND_FILES" ]; then
    echo -e "\n🎭 Checking if E2E tests should run..."
    
    # Check if wails dev server is running
    if curl -s http://localhost:34115 > /dev/null 2>&1; then
        print_info "Wails dev server detected. Running E2E tests..."
        cd frontend
        
        # Run E2E tests in headless mode (they have their own timeout in playwright.config.ts)
        if ! bun run test:e2e:headless > /tmp/e2e-test-commit.log 2>&1; then
            print_error "E2E tests failed or timed out (2 min limit)"
            echo "See /tmp/e2e-test-commit.log for details"
            print_info "You can skip with --no-verify, but please ensure E2E tests pass before pushing"
            CHECKS_PASSED=false
        else
            print_success "E2E tests passed"
        fi
        cd ..
    else
        print_warning "Wails dev server not running. Skipping E2E tests."
        print_info "Start with 'wails dev' to run E2E tests during pre-commit"
    fi
fi

# Final summary
echo -e "\n================================"
if [ "$CHECKS_PASSED" = true ]; then
    print_success "All pre-commit checks passed! ✨"
    echo -e "\nYou're ready to commit."
else
    print_error "Some checks failed. Please fix the issues above before committing."
    echo -e "\nTip: You can bypass these checks with 'git commit --no-verify' but it's not recommended."
    exit 1
fi