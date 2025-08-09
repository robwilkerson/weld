#!/usr/bin/env bash

# Weld CLI installation script (macOS only)
# This script creates a symlink to the Weld CLI tool

set -e

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script is only for macOS" >&2
    echo "   Detected OS: $OSTYPE" >&2
    exit 1
fi

INSTALL_DIR="/usr/local/bin"
WELD_APP="/Applications/Weld.app/Contents/MacOS/Weld"

# Check if Weld.app is installed
if [ ! -f "$WELD_APP" ]; then
    echo "❌ Error: Weld.app not found at /Applications/Weld.app" >&2
    echo "   Please install Weld.app first" >&2
    exit 1
fi

# Create /usr/local/bin if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "📁 Creating $INSTALL_DIR directory..."
    sudo mkdir -p "$INSTALL_DIR"
fi

# Install the symlink
echo "🔗 Creating symlink to Weld CLI..."
sudo ln -sf "$WELD_APP" "$INSTALL_DIR/weld"

echo "✅ Installation complete!"
echo ""
echo "You can now use 'weld' from anywhere:"
echo "  weld file1.txt file2.txt"