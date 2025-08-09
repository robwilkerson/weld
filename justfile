# Weld development commands
# Run `just` to see available commands

# Default command - show available recipes
default:
    @just --list

# Build the application and install CLI script
# Builds a universal binary for macOS (supports both Intel and Apple Silicon)
build:
    @echo "Building Weld..."
    @wails build -platform darwin/universal
    @echo "Installing CLI script into app bundle..."
    @cp bin/weld build/bin/Weld.app/Contents/Resources/weld
    @chmod +x build/bin/Weld.app/Contents/Resources/weld
    @echo "✅ Build complete!"
    @echo ""
    @echo "To install the CLI tool, users can run:"
    @echo "  ln -s /Applications/Weld.app/Contents/Resources/weld /usr/local/bin/weld"

# Run in development mode
dev:
    wails dev

# Clean build artifacts
clean:
    rm -rf build/bin

# Install CLI to /usr/local/bin (requires built app)
install-cli:
    #!/usr/bin/env bash
    if [ -f "build/bin/Weld.app/Contents/MacOS/weld" ]; then
        echo "Installing weld CLI to /usr/local/bin..."
        sudo ln -sf /Applications/Weld.app/Contents/MacOS/weld /usr/local/bin/weld
        echo "✅ CLI installed!"
    else
        echo "Error: Build the app first with 'just build'"
        exit 1
    fi

# Run backend tests
test-backend:
    go test ./... -v --cover

# Run frontend tests
test-frontend:
    cd frontend && bun run test:coverage

# Run all tests
test: test-backend test-frontend

# Run E2E tests (requires dev server running)
test-e2e:
    cd frontend && bun run test:e2e

# Format all code
fmt:
    go fmt ./...
    cd frontend && npx @biomejs/biome check --write src/

# Check formatting without modifying files
fmt-check:
    @echo "Checking Go formatting..."
    @test -z "$(shell gofmt -l .)" || (echo "Go files need formatting" && exit 1)
    @echo "Checking frontend formatting..."
    @cd frontend && npx @biomejs/biome check src/

# Build for all platforms
build-all:
    @echo "Building for all platforms..."
    @echo "Building Windows..."
    @wails build -platform windows/amd64
    @echo "Building Linux..."
    @wails build -platform linux/amd64
    @echo "Building macOS..."
    @wails build -platform darwin/universal
    @echo "✅ All builds complete!"

# Build Windows executable for testing
build-windows:
    @echo "Building Windows executable..."
    @GOOS=windows GOARCH=amd64 wails build -platform windows/amd64
    @echo "✅ Windows build complete at build/bin/*.exe"

# Create a new release build (for CI)
release version:
    @echo "Creating release {{version}}..."
    @git tag -a v{{version}} -m "Release version {{version}}"
    @git push origin v{{version}}
    @echo "✅ Release tag pushed. CI will build and create release."

# Run pre-commit checks
pre-commit:
    ./bin/pre-commit-check.sh

# Run pre-PR checks
pre-pr:
    ./bin/pre-pr-check.sh

# Update dependencies
update-deps:
    @echo "Updating Go dependencies..."
    @go get -u ./...
    @go mod tidy
    @echo "Updating frontend dependencies..."
    @cd frontend && bun update

# Check for outdated dependencies
check-deps:
    @echo "Checking Go dependencies..."
    @go list -u -m all | grep '\['
    @echo "Checking frontend dependencies..."
    @cd frontend && bun outdated

# Run the built application (macOS)
run:
    @if [ -f "build/bin/Weld.app/Contents/MacOS/Weld" ]; then \
        open build/bin/Weld.app; \
    else \
        echo "Error: Build the app first with 'just build'"; \
        exit 1; \
    fi

# Open the project in your editor (customize as needed)
edit:
    code .

# Show git status in a nice format
status:
    @git status -sb

# Create a new feature branch
feature name:
    git checkout -b feat/{{name}}

# Create a new bugfix branch
bugfix name:
    git checkout -b fix/{{name}}