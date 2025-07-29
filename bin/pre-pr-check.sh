#!/bin/bash

# Pre-PR Check Script
# Run this before opening a pull request to ensure all checks pass

set -e  # Exit on error

echo "🔍 Starting Pre-PR Checks..."
echo "================================"

# Function to print colored output
print_success() { echo -e "\033[32m✓ $1\033[0m"; }
print_error() { echo -e "\033[31m✗ $1\033[0m"; }
print_info() { echo -e "\033[34mℹ $1\033[0m"; }
print_warning() { echo -e "\033[33m⚠ $1\033[0m"; }

# Track if any checks fail
CHECKS_PASSED=true

# 1. Check for uncommitted changes
echo -e "\n📝 Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    print_warning "You have uncommitted changes. Please commit or stash them first."
    git status -s
    CHECKS_PASSED=false
else
    print_success "Working directory is clean"
fi

# 2. Run formatters
echo -e "\n🎨 Running formatters..."

# Go formatter
if go fmt ./... 2>&1 | grep -q .; then
    print_error "Go files need formatting"
    CHECKS_PASSED=false
else
    print_success "Go files are properly formatted"
fi

# Frontend formatter
cd frontend
if ! npx @biomejs/biome check --write src/; then
    print_error "Frontend files have biome issues"
    CHECKS_PASSED=false
else
    print_success "Frontend files pass biome checks"
fi
cd ..

# 3. Run backend tests
echo -e "\n🧪 Running backend tests..."
if ! go test ./... -v > /tmp/go-test.log 2>&1; then
    print_error "Backend tests failed"
    echo "See /tmp/go-test.log for details"
    CHECKS_PASSED=false
else
    print_success "Backend tests passed"
fi

# 4. Run frontend tests
echo -e "\n🧪 Running frontend tests..."
cd frontend
if ! bun run test > /tmp/frontend-test.log 2>&1; then
    print_error "Frontend tests failed"
    echo "See /tmp/frontend-test.log for details"
    CHECKS_PASSED=false
else
    print_success "Frontend tests passed"
fi

# 5. Check if E2E tests should run
echo -e "\n🤔 Checking if E2E tests are needed..."
# Check if any frontend files were changed
if git diff --name-only origin/main...HEAD | grep -q "frontend/src/"; then
    print_info "Frontend changes detected. E2E tests recommended."
    
    # Check if wails dev is running
    if ! curl -s http://localhost:34115 > /dev/null; then
        print_warning "Wails dev server is not running. Start it with 'wails dev' to run E2E tests."
        print_info "Skipping E2E tests for now..."
    else
        echo -e "\n🎭 Running E2E tests..."
        START_TIME=$(date +%s)
        
        if ! bun run test:e2e > /tmp/e2e-test.log 2>&1; then
            print_error "E2E tests failed"
            echo "See /tmp/e2e-test.log for details"
            CHECKS_PASSED=false
        else
            END_TIME=$(date +%s)
            RUNTIME=$((END_TIME - START_TIME))
            
            if [ $RUNTIME -gt 60 ]; then
                print_warning "E2E tests passed but took ${RUNTIME}s (>60s threshold)"
            else
                print_success "E2E tests passed in ${RUNTIME}s"
            fi
        fi
    fi
else
    print_info "No frontend changes detected. Skipping E2E tests."
fi

cd ..

# 6. Build verification
echo -e "\n🔨 Verifying build..."
if ! wails build > /tmp/wails-build.log 2>&1; then
    print_error "Build failed"
    echo "See /tmp/wails-build.log for details"
    CHECKS_PASSED=false
else
    print_success "Build succeeded"
fi

# 7. Check commit messages
echo -e "\n📜 Checking commit messages..."
LONG_SUBJECTS=$(git log origin/main..HEAD --format="%s" | while read -r subject; do
    LENGTH=$(echo -n "$subject" | wc -c | tr -d ' ')
    if [ "$LENGTH" -gt 50 ]; then
        echo "  - \"$subject\" ($LENGTH chars)"
    fi
done)

if [ -n "$LONG_SUBJECTS" ]; then
    print_error "Some commit subjects exceed 50 characters:"
    echo "$LONG_SUBJECTS"
    CHECKS_PASSED=false
else
    print_success "All commit messages follow guidelines"
fi

# Final summary
echo -e "\n================================"
if [ "$CHECKS_PASSED" = true ]; then
    print_success "All pre-PR checks passed! 🎉"
    echo -e "\nYou're ready to open a pull request."
    echo "Remember to:"
    echo "  - Update TODO.md if you completed/added tasks"
    echo "  - Test manually on both light and dark themes"
    echo "  - Write a clear PR description"
else
    print_error "Some checks failed. Please fix the issues above before opening a PR."
    exit 1
fi