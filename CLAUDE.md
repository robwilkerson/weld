# Application Overview

This is a visual diff tool. It's built using AI (Claude Code, specifically) and modeled to look and work very much like [Meld](https://meldmerge.org/).

# Quick Start for Development

## Pre-Requesites

* Go 1.24+
* Wails 2.10+
* [Bun](https://bun.sh/)
* [Biome](https://biomejs.dev/)

## First time setup:

1. `wails doctor` - Verify environment
2. `wails build` - Initial build to generate bindings
3. `wails dev` - Start development server
4. `bun add -D @vitest/coverage-istanbul` - To get test coverage when running frontend tests
5. `bun i` - To install all frontend dependencies

# Development Guidelines

## Architecture

* **Backend (`**/*.go`)**: Go 1.24+ application with [Wails](https://wails.io/)
bindings for file operations
* **Frontend (`frontend/src/`)**: Svelte/TypeScript UI
* **Communication**: Wails generates TypeScript bindings
  in `wailsjs/` for frontend to call Go functions
* **Key Backend Functions**:
  * `SelectFile()`
  * `CompareFiles()`
  * `CopyToFile()`
  * `SaveChanges()`

## Project Structure

* assets/: Any app-level static files (e.g., app icons, etc.)
* bin/: Any executable scripts
* build/: Production build artifact(s)
* conf/: Any configuration files
* frontend/: Svelte frontend source code
* tests/: Any tests files are assets specifically used for automated or manual testing
* .gitignore: A Git ignore file consistent with a Wails project
* wails.json: Wails project configuration

## Daily development:

1. `wails dev` - Start the application with live reload
2. Make changes to `frontend/src/**` or `**/*.go`
3. Create or update unit and integration test appropriately when code is added or modified
3. Run `go fmt` after backend changes
4. Run `npx @biomejs/biome check --write frontend/src/`
after frontend changes

## Common Commands

* wails init - Initialize a Wails project
* wails dev — Start development server with hot reload
* wails build — Build the application for production
* wails generate module — Generate a new Go module
* wails doctor — Diagnose project setup issues after verifying or installing the tech stack

## Testing

Backend: Use `go test ./... -v --cover` for Go unit tests with coverage
Frontend: Use `cd frontend && bun run test:coverage` for frontend tests with coverage using the Vitest test runner

### Frontend Test Commands

* `bun run test` - Run tests once
* `bun run test:coverage` - Run tests with coverage report
* `bun run test:watch` - Run tests in watch mode (automatically re-runs on file changes)
* `bun run test:ui` - Run tests with interactive UI

In the resources/ directory, there's a sample_files/ subdirectory that contains physical files that can be used to manually test very specific scenarios.

### Sample Files

Test files - primarily used for manual testing - are located in `resources/sample-files/`. They are used to test syntax highlighting and very specific, discrete diff scenarios:

* `same-1.js` | `same-2.js` - Identical Javascript files used to verify that no diffs are shown and that we see a banner indicating that the files are the same
* `addfirst-1.js` | `addfirst-2.js` - Javascript files where the second file has one line added at the very top of the file
* `addend-1.py` | `addend-2.py` - Python files where the second file has one line added at the very end of the file
* `addmiddle-1.go` | `addmiddle-2.go` - Go files where the second file has one line added somewhere in the middle of the file

## Do Not

* Do not edit files in build/ or wailsjs/
* Do not add or modify files in resources/sample-files unless specifically asked to do so
* Do not use npm for package management, use Bun instead

## Common Workflow

### Code Style and Formatting

* **Go**: Use `go fmt` to format all Go files after backend changes
* **Frontend**: Use `npx @biomejs/biome check --write frontend/src/` after frontend changes
* **TypeScript**: All frontend code uses TypeScript with proper type annotations

### Git Workflow

* Create feature branches from `main`
* Make changes and test locally with `wails dev`
* Run formatting commands before committing
* Run unit and integration tests before committing
* **Commit messages**: Keep subject line ≤ 50 characters for readability
* Use pull requests for all merges to `main`
* Run `wails build` and ensure no errors before merging

### Testing and Validation

* Test manually using sample files in `resources/sample-files/`
* Run `go test ./... -v --cover` for backend unit tests with coverage
* Run `cd frontend && bun run test:coverage` for frontend tests with coverage using the Vitest test runner
* Verify app builds successfully with `wails build`

## Common Issues

* **Build fails**: Run `wails doctor` to check environment
* **Frontend changes not reflected**: Restart `wails dev`
* **TypeScript errors**: Check `wailsjs/` bindings are generated with `wails build`
* **Missing dependencies**: Run `bun i` in `frontend/`
* **`__zoxide_z` command not found error**: When running commands that change directories (like `cd frontend && bun run test`), wrap the entire command in `bash -c "..."` or `zsh -c "..."`. For example:
  * ❌ `cd frontend && bun run test:coverage`
  * ✅ `bash -c "cd frontend && bun run test:coverage"`

# Developer Environment Setup

* Use [mise](https://mise.jdx.dev/getting-started.html) to install Go, Node.js, Wails, and Bun only if they are not installed, not in `$PATH`, or if the installed version is lower than that specified in the Tech Stack instructions above
  * Install the latest version of Go and make it the default version for the project directory only by running `mise use go@latest`
  * Install the latest version of Node.js and make it the default version for the project directory only by running `mise use node@latest`
  * Install the latest version of Bun and make it the default version for the project directory only by running `mise use bun@latest`
  * If the Wails CLI isn't already installed, run `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
* Run `wails doctor` after setup to verify environment
