# 🧑‍🏭 Weld

[![CI](https://github.com/robwilkerson/weld/actions/workflows/ci.yml/badge.svg)](https://github.com/robwilkerson/weld/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/robwilkerson/weld?label=latest%20release&sort=date)](https://github.com/robwilkerson/weld/releases/latest)

Weld is a visual diff and merge tool targeted at developers.

It is inspired by and modeled after [Meld](https://github.com/yousseb/meld) which seems to have been deprecated (at best) in favor of [this fork](https://gitlab.com/dehesselle/meld_macos) - at least in terms of the [Homebrew](https://brew.sh/) package. Recent(-ish) churn due to bugs and slow development inspired me to start this project as an alternative, but Meld itself seems to have stabilized recently. Nonetheless, the idea lingered and I decided to explore it as an experiment in some new technologies and as a use case for heavy AI usage.

## Features

- **Side-by-side file comparison** with syntax highlighting
- **Interactive diff navigation** with keyboard shortcuts
- **Selective merging** - copy individual changes or entire chunks between files
- **Smart diff chunking** - intelligently groups related changes
- **Undo support** for all copy operations
- **Dark/Light themes** with automatic OS detection
- **Minimap** for quick navigation in large files
- **Cross-platform** - works on macOS, Windows, and Linux
- **CLI support** for quick comparisons from the terminal

Weld, while inspired by Meld, offers a slightly streamlined set of functionality. The following features of Meld are not part of Weld:

* 3-way comparison
* Version control integration

Weld is licensed under the terms of the MIT license.

# For Users

## Installation

### macOS

1. Download the latest release from the [Releases](https://github.com/robwilkerson/weld/releases) page
2. Open the downloaded `.zip` file
3. Drag `Weld.app` to your Applications folder
4. On first launch, you may need to right-click and select "Open" to bypass Gatekeeper

**Note:** If you see "Weld.app is damaged and can't be opened", this is because the app isn't code signed yet. To fix this:
- Open Terminal and run: `xattr -cr /Applications/Weld.app`
- Then try opening the app again

### Windows

1. Download the latest Windows release from the [Releases](https://github.com/robwilkerson/weld/releases) page
2. Extract the `.zip` file
3. Run `Weld.exe`

### Linux

1. Download the latest Linux release from the [Releases](https://github.com/robwilkerson/weld/releases) page
2. Extract the `.tar.gz` file: `tar -xzf weld-linux-amd64.tar.gz`
3. Make it executable: `chmod +x Weld`
4. Run: `./Weld`

## Usage

### GUI Mode

1. **Launch Weld** from your Applications folder (macOS), Start Menu (Windows), or by running the executable (Linux)

2. **Select files to compare:**
   - Click the left "Browse" button to select the original/source file
   - Click the right "Browse" button to select the modified/target file
   - Click "Compare" to see the differences

3. **Navigate differences:**
   - Scroll through the files to review all changes
   - Click on any diff chunk to jump to it
   - Use the minimap on the right for quick navigation in large files
   - All differences are highlighted with a light blue background
   - Within modified lines, the specific changed parts are highlighted with a darker blue
   - The current diff is highlighted with a stronger blue when navigating with j/k keys

4. **Copy changes between files:**
   - Click arrows to copy changes in either direction
   - Use keyboard shortcuts for faster operation (see below)
   - All operations can be undone via the Edit menu or keyboard shortcuts (see below)

5. **Save your changes:**
   - The save button (📥) appears when files have unsaved changes
   - Save individual files or use keyboard shortcuts (see below)
   - Weld will prompt you to save unsaved changes when quitting

### Tips

- **Supported Files:** Weld works with any text-based file format. Binary files are not supported.
- **Large Files:** The minimap is especially useful for navigating large files with many differences.
- **Vim Users:** Navigation keys `j` and `k` work just like in Vim for moving between diffs.
- **Safe Operations:** All copy operations can be undone, and Weld always prompts before discarding unsaved changes.

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| **Navigation** | | |
| First difference | `g` | `g` |
| Last difference | `G` (Shift+G) | `G` (Shift+G) |
| Next difference | `j` or `↓` | `j` or `↓` |
| Previous difference | `k` or `↑` | `k` or `↑` |
| **Copy Operations** | | |
| Copy current diff left → right | `Shift+L` | `Shift+L` |
| Copy current diff right → left | `Shift+H` | `Shift+H` |
| **File Operations** | | |
| Save left file | `Cmd+S` (when left file focused) | `Ctrl+S` (when left file focused) |
| Save right file | `Cmd+S` (when right file focused) | `Ctrl+S` (when right file focused) |
| **General** | | |
| Compare files | `Enter` (when both files selected) | `Enter` (when both files selected) |
| Undo last operation | `Cmd+Z` or `u` | `Ctrl+Z` or `u` |
| Toggle minimap | Via menu (☰) | Via menu (☰) |
| Toggle dark/light mode | Via menu (☰) | Via menu (☰) |

### From the CLI

Weld includes a command-line interface for quick file comparisons:

```bash
# Compare two files
weld file1.txt file2.txt

# Compare with relative paths
weld ./src/old.js ./src/new.js

# Compare with absolute paths
weld /path/to/file1 /path/to/file2
```

#### Installing the CLI Tool

**macOS:**
```bash
# Create a symlink to the CLI tool
ln -s /Applications/Weld.app/Contents/Resources/weld /usr/local/bin/weld

# Or add to your PATH
export PATH="/Applications/Weld.app/Contents/Resources:$PATH"
```

**Linux/Windows:**
The `weld` executable can be used directly or added to your PATH.

# For Developers

## Prerequisites

- **Go** 1.21 or later
- **Node.js** 20 or later (see platform-specific instructions below)
- **Bun** (latest version)
- **Wails** 2.10+
- **Just** (command runner) - Install with `brew install just` or see [installation options](https://github.com/casey/just#installation)

### Platform-specific Requirements

**macOS:**
- Xcode Command Line Tools

**Linux (Ubuntu/Debian):**

1. **Install Node.js 20+** (Ubuntu's apt provides Node 18, which is too old):
   ```bash
   # Option 1: Using NodeSource (recommended)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Option 2: Using mise (version manager)
   # Install mise via curl:
   curl https://mise.run | sh
   # OR via apt (if you prefer):
   sudo apt update && sudo apt install -y gpg wget curl
   wget -qO - https://mise.jdx.dev/gpg-key.pub | gpg --dearmor | sudo tee /etc/apt/keyrings/mise-archive-keyring.gpg 1> /dev/null
   echo "deb [signed-by=/etc/apt/keyrings/mise-archive-keyring.gpg arch=amd64] https://mise.jdx.dev/deb stable main" | sudo tee /etc/apt/sources.list.d/mise.list
   sudo apt update && sudo apt install -y mise
   
   # Add to your shell (for bash):
   echo 'eval "$(mise activate bash)"' >> ~/.bashrc
   source ~/.bashrc
   
   # Install and use Node.js 20:
   mise use node@20
   ```

2. **Install GTK3 and WebKit2GTK development libraries:**
   ```bash
   # For Ubuntu 20.04 and earlier:
   sudo apt-get update
   sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev
   
   # For Ubuntu 22.04 and later:
   sudo apt-get update
   sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev
   ```

**Windows:**
- Windows 10/11
- WebView2 (usually pre-installed)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/robwilkerson/weld.git
   cd weld
   ```

2. Install Go dependencies:
   ```bash
   go mod download
   ```

3. Install Wails CLI:
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```

4. Verify your environment:
   ```bash
   wails doctor
   ```
   **Note**: On some systems (particularly Ubuntu ARM), `wails doctor` may incorrectly report missing webkit dependencies even when they're properly installed. If you see webkit warnings but have installed the required packages, try running `wails dev` to verify your setup actually works.

5. Install frontend dependencies:
   ```bash
   cd frontend
   bun install
   cd ..
   ```

## Development Workflow

### Running in Development Mode

```bash
# Start the development server with hot reload
wails dev

# Frontend will be available at http://localhost:34115 for browser development
```

### Code Formatting

Always format your code before committing:

```bash
# Format Go code
go fmt ./...

# Format frontend code
npx @biomejs/biome check --write frontend/src/
```

### Testing

Run tests before committing changes:

```bash
# Backend tests with coverage
go test ./... -v --cover

# Frontend tests with coverage
cd frontend && bun run test:coverage

# Watch mode for frontend tests during development
cd frontend && bun run test:watch
```

### Building

```bash
# Build for your current platform
wails build

# Build with just (includes CLI tool installation)
just build

# Build for specific platforms (Linux example, requires Docker)
wails build -platform linux/amd64
```

## Project Structure

```
weld/
├── bin/                 # CLI wrapper script
│   └── weld
├── build/               # Build outputs (git-ignored)
├── frontend/            # Svelte frontend application
│   ├── src/
│   │   ├── App.svelte  # Main UI component
│   │   └── ...
│   └── package.json
├── wailsjs/             # Auto-generated bindings (git-ignored)
└── resources/           # Sample files, icons, and other resources
├── app.go               # Main application logic
├── main.go              # Entry point and CLI argument handling
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and ensure they pass
5. Format your code
6. Commit with clear messages: `git commit -m 'feat: add amazing feature'`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Commit Message Format

We follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or modifications
- `chore:` Maintenance tasks

## Troubleshooting

### Common Issues

**Build fails with "wails: command not found"**
- Ensure Go bin directory is in your PATH: `export PATH=$PATH:$(go env GOPATH)/bin`

**Frontend build errors**
- Clear node modules and reinstall: `cd frontend && rm -rf node_modules && bun install`

**Linux build missing dependencies**
- Install required packages: `sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev`

**macOS app won't open ("damaged" error)**
- Remove quarantine: `xattr -cr /Applications/Weld.app`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# Acknowledgements

As mentioned above, this project is deeply inspired by the DX/UX/UI and capability of Meld for MacOS:

* [The Original](https://github.com/yousseb/meld)
* [The Current](https://gitlab.com/dehesselle/meld_macos)
