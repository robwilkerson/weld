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

# Exit immediately on first failure
exit_on_error() {
    print_error "$1"
    echo -e "\nTip: Fix this issue and run the check again."
    exit 1
}

# 1. Check for uncommitted changes
echo -e "\n📝 Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    print_warning "You have uncommitted changes:"
    git status -s
    exit_on_error "Please commit or stash changes before running PR checks."
fi
print_success "Working directory is clean"

# 2. Run formatters
echo -e "\n🎨 Running formatters..."

# Go formatter
if go fmt ./... 2>&1 | grep -q .; then
    exit_on_error "Go files need formatting. Run 'go fmt ./...' to fix."
fi
print_success "Go files are properly formatted"

# Frontend formatter
cd frontend
if ! npx @biomejs/biome check --write src/; then
    cd ..
    exit_on_error "Frontend files have biome issues. Check the output above."
fi
print_success "Frontend files pass biome checks"
cd ..

# 3. Run backend tests
echo -e "\n🧪 Running backend tests..."
if ! go test ./... -v > /tmp/go-test.log 2>&1; then
    echo "See /tmp/go-test.log for details"
    exit_on_error "Backend tests failed"
fi
print_success "Backend tests passed"

# 4. Run frontend tests
echo -e "\n🧪 Running frontend tests..."
cd frontend
# Run all tests except integration tests (which are outdated)
if ! bun run test src/stores/ src/components/ src/utils/ > /tmp/frontend-test.log 2>&1; then
    echo "See /tmp/frontend-test.log for details"
    cd ..
    exit_on_error "Frontend tests failed"
fi
print_success "Frontend tests passed"

cd ..

# 5. Build verification
echo -e "\n🔨 Verifying build..."
if ! wails build > /tmp/wails-build.log 2>&1; then
    echo "See /tmp/wails-build.log for details"
    exit_on_error "Build failed"
fi
print_success "Build succeeded"

# 6. Check commit messages
echo -e "\n📜 Checking commit messages..."
LONG_SUBJECTS=$(git log origin/main..HEAD --format="%s" | while read -r subject; do
    LENGTH=$(echo -n "$subject" | wc -c | tr -d ' ')
    if [ "$LENGTH" -gt 50 ]; then
        echo "  - \"$subject\" ($LENGTH chars)"
    fi
done)

if [ -n "$LONG_SUBJECTS" ]; then
    echo "$LONG_SUBJECTS"
    exit_on_error "Some commit subjects exceed 50 characters. Please fix with 'git rebase -i'."
fi
print_success "All commit messages follow guidelines"

# 7. Run E2E tests (run last to avoid multiple runs if other checks fail)
echo -e "\n🎭 Running E2E tests..."

# Check if wails dev is running
if ! curl -s http://localhost:34115 > /dev/null; then
    print_info "Please start the dev server with 'wails dev' in another terminal"
    exit_on_error "Wails dev server is not running!"
fi
    cd frontend
    START_TIME=$(date +%s)
    
    if ! bun run test:e2e:headless > /tmp/e2e-test.log 2>&1; then
        echo "See /tmp/e2e-test.log for details"
        # Show last few lines of the log for quick debugging
        echo -e "\nLast 20 lines of E2E test output:"
        tail -20 /tmp/e2e-test.log
        cd ..
        exit_on_error "E2E tests failed"
    fi
        END_TIME=$(date +%s)
        RUNTIME=$((END_TIME - START_TIME))
        
        # Count how many tests ran
        TEST_COUNT=$(grep -E "✓|✘" /tmp/e2e-test.log | wc -l | tr -d ' ')
        
        if [ $RUNTIME -gt 60 ]; then
            print_warning "E2E tests passed ($TEST_COUNT tests) but took ${RUNTIME}s (>60s threshold)"
        else
            print_success "E2E tests passed ($TEST_COUNT tests) in ${RUNTIME}s"
        fi
    cd ..

# Final summary - only shown if all checks pass
echo -e "\n================================"
print_success "All pre-PR checks passed! 🎉"
echo -e "\nYou're ready to open a pull request."
echo "Remember to:"
echo "  - Update TODO.md if you completed/added tasks"
echo "  - Test manually on both light and dark themes"
echo "  - Write a clear PR description"