.PHONY: build dev clean install-cli

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
	@if [ -f "build/bin/Weld.app/Contents/MacOS/weld" ]; then \
		echo "Installing weld CLI to /usr/local/bin..."; \
		sudo ln -sf /Applications/Weld.app/Contents/MacOS/weld /usr/local/bin/weld; \
		echo "✅ CLI installed!"; \
	else \
		echo "Error: Build the app first with 'make build'"; \
		exit 1; \
	fi