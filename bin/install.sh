#!/usr/bin/env bash

# Weld CLI installation script
# This script installs the weld command-line tool

set -e

INSTALL_DIR="/usr/local/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WELD_SCRIPT="$SCRIPT_DIR/weld"

# Check if weld script exists
if [ ! -f "$WELD_SCRIPT" ]; then
    echo "Error: weld script not found at $WELD_SCRIPT" >&2
    exit 1
fi

# Check if we have write permission to install directory
if [ ! -w "$INSTALL_DIR" ]; then
    echo "Error: No write permission to $INSTALL_DIR" >&2
    echo "You may need to run this script with sudo:" >&2
    echo "  sudo $0" >&2
    exit 1
fi

# Copy the script
echo "Installing weld to $INSTALL_DIR/weld..."
cp "$WELD_SCRIPT" "$INSTALL_DIR/weld"
chmod +x "$INSTALL_DIR/weld"

echo "✅ Installation complete!"
echo ""
echo "You can now use 'weld' from anywhere:"
echo "  weld file1.txt file2.txt"
echo ""
echo "Make sure Weld.app is installed in /Applications/"