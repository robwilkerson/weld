#!/bin/bash

# Pre-PR Check Script
# Run this before opening a pull request to ensure local-only checks pass
# CI will handle: tests, E2E tests, builds, and cross-platform validation

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

# Note: Tests and builds are handled by CI pipeline

# 3. Check commit messages
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

# Note: E2E tests are handled by CI pipeline

# Final summary - only shown if all checks pass
echo -e "\n================================"
print_success "All pre-PR checks passed! 🎉"
echo -e "\nYou're ready to open a pull request."
echo "Remember to:"
echo "  - Update TODO.md if you completed/added tasks"
echo "  - Test manually on both light and dark themes"
echo "  - Write a clear PR description"