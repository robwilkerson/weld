# 🧑‍🏭 Weld

[![CI](https://github.com/robwilkerson/weld/actions/workflows/ci.yml/badge.svg)](https://github.com/robwilkerson/weld/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/robwilkerson/weld?label=latest%20release)](https://github.com/robwilkerson/weld/releases/latest)

Weld is a visual diff and merge tool targeted at developers.

It is inspired by and modeled after [Meld](https://github.com/yousseb/meld) which seems to have been deprecated (at best) in favor of [this fork](https://gitlab.com/dehesselle/meld_macos) - at least in terms of the [Homebrew](https://brew.sh/) package. Recent(-ish) churn due to bugs and slow development inspired me to start this project as an alternative, but seem to have stabilized in recent weeks. Nonetheless, the idea lingered and I decided to explore it as an experiment in some new technologies and as a use case for heavy AI usage.

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

1. Launch Weld from your Applications folder (macOS), Start Menu (Windows), or by running the executable (Linux)
2. Click "Browse" to select files for comparison:
   - Left pane: Select the original/source file
   - Right pane: Select the modified/target file
3. View differences with syntax highlighting
4. Navigate changes using:
   - Scroll to review all changes
   - Click on specific diff regions to jump to them
5. Copy changes between files using the arrow buttons

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
- **Node.js** 20 or later  
- **Bun** (latest version)
- **Wails** 2.10+

### Platform-specific Requirements

**macOS:**
- Xcode Command Line Tools

**Linux:**
- `libgtk-3-dev`
- `libwebkit2gtk-4.0-dev`

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

# Build with the Makefile (includes CLI tool installation)
make build

# Build for specific platforms (Linux example, requires Docker)
wails build -platform linux/amd64
```

## Project Structure

```
weld/
├── app.go              # Main application logic
├── main.go             # Entry point and CLI argument handling
├── frontend/           # Svelte frontend application
│   ├── src/           
│   │   ├── App.svelte  # Main UI component
│   │   └── ...
│   └── package.json
├── bin/               # CLI wrapper script
│   └── weld
├── build/             # Build outputs (git-ignored)
├── wailsjs/           # Auto-generated bindings (git-ignored)
└── tests/             # Test files and sample data
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

As mentioned above, this project is deeply inspired by the DX/UX/UI of Meld for MacOS:

* [The Original](https://github.com/yousseb/meld)
* [The Current](https://gitlab.com/dehesselle/meld_macos)
