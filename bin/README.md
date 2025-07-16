# Weld CLI

This directory contains the command-line interface wrapper for Weld.

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