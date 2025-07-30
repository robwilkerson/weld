# Weld Scripts and CLI

This directory contains command-line tools and scripts for the Weld project:
- `weld` - CLI wrapper for launching the Weld application
- `pre-commit-check.sh` - Lightweight validation before each commit
- `pre-pr-check.sh` - Comprehensive validation before pull requests
- `install.sh` - Installation script for the Weld CLI

## Installation

1. Copy the `weld` script to a directory in your PATH:
   ```bash
   cp bin/weld /usr/local/bin/
   ```
   
   Or add this directory to your PATH:
   ```bash
   export PATH="$PATH:/path/to/weld/bin"
   ```

2. Ensure Weld.app is installed in one of these locations:
   - `/Applications/Weld.app`
   - `~/Applications/Weld.app`
   - Or set the `WELD_APP` environment variable to point to the Weld executable:
     ```bash
     export WELD_APP="/custom/path/to/Weld.app/Contents/MacOS/Weld"
     ```

## Usage

Compare two files:
```bash
weld file1.txt file2.txt
```

Launch Weld without files:
```bash
weld
```

## Features

- Automatically finds the Weld application
- Supports relative and absolute paths
- Validates that files exist before launching
- Lightweight bash script with no dependencies

## Pre-PR Check Script

The `pre-pr-check.sh` script automates validation before opening a pull request:

```bash
./bin/pre-pr-check.sh
```

This script will:
- Check for uncommitted changes
- Run formatters (go fmt, biome)
- Execute all backend and frontend tests
- Run E2E tests if frontend files changed (requires `wails dev` running)
- Verify the application builds successfully
- Check commit message lengths
- Report E2E test runtime and warn if >60 seconds

The script provides colored output and clear pass/fail status for each check.

## Pre-Commit Check Script

The `pre-commit-check.sh` script provides fast validation before each commit:

```bash
./bin/pre-commit-check.sh
```

Or enable automatic Git hook:
```bash
git config core.hooksPath .githooks
```

This lightweight script will:
- Check for debugging code (console.log, TODO, etc.) in staged files
- Run formatters on staged files only
- Execute tests for changed packages/files
- Validate commit message length (if available)

The pre-commit script is designed to be fast, focusing only on staged changes.