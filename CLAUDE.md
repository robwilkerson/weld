# Application Overview

This is a visual diff tool. It's built using AI (Claude Code, specifically) and modeled to look and work very much like [Meld](https://meldmerge.org/).

# Quick Start for Development

## Pre-Requesites

* Go 1.24+
* Wails 2.10+
* [Bun](https://bun.sh/)
* [Biome](https://biomejs.dev/)
* [Just](https://github.com/casey/just) (command runner)

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

**IMPORTANT FOR CLAUDE**: Never run `wails dev` directly - it will timeout due to execution time limits. Ask the user to start it in their terminal if needed.

1. `wails dev` - Start the application with live reload (User should run this in terminal)
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

### Testing Strategy

We follow a clear testing hierarchy:

**E2E Tests (Playwright)**
- User workflows & interactions
- Visual feedback & UI state changes  
- Cross-component integration
- Real browser behavior

**Integration Tests (Vitest + Testing Library)**
- Complex component interactions
- State management flows
- Error handling scenarios

**Unit Tests (Vitest)**
- Pure functions & utilities
- Component props/events
- Isolated business logic
- Edge cases

### When to Write Each Type

**Write E2E tests for:**
- User-facing features (navigation, copy operations, save)
- Visual feedback (highlighting, indicators, animations)
- Multi-step workflows
- Cross-component coordination

**Write Integration tests for:**
- Complex component interactions that don't need visual verification
- Error states that are hard to trigger in E2E
- Performance-critical paths

**Write Unit tests for:**
- Pure functions (diff algorithms, utilities)
- Component API contracts
- Edge cases and error handling
- Business logic

### Test Commands

Backend: `go test ./... -v --cover` for Go unit tests with coverage

Frontend Unit/Integration: `cd frontend && bun run test:coverage` for tests with coverage
* `bun run test` - Run tests once
* `bun run test:coverage` - Run tests with coverage report
* `bun run test:watch` - Run tests in watch mode
* `bun run test:ui` - Run tests with interactive UI

Frontend E2E: `cd frontend && bun run test:e2e` (requires `wails dev` running)
* `bun run test:e2e` - Run all E2E tests
* `bun run test:e2e:ui` - Run E2E tests with UI mode for debugging
* `bun run test:e2e -- --grep "test name"` - Run specific E2E test

**Note**: E2E tests run automatically in CI on all pull requests and main branch pushes. The CI:
- Starts `wails dev` in the background
- Runs tests in headless mode
- Records videos of all test runs
- Uploads test results as artifacts on failure

### E2E Test Organization

E2E tests are organized by feature in `frontend/tests/e2e/`:
```
tests/e2e/
├── keyboard-navigation.e2e.ts    # Navigation with j/k, arrows
├── copy-operations.e2e.ts        # Copy left/right operations
├── save-operations.e2e.ts        # Save and unsaved changes
├── minimap-interaction.e2e.ts    # Minimap clicks and dragging
└── file-selection.e2e.ts         # File selection workflow
```

### Testing Best Practices

1. **No redundancy** - If E2E tests cover the user experience, remove integration tests that only verify "no errors"
2. **Focus on user value** - E2E tests should verify what users actually see and do
3. **Keep tests focused** - Each test file should cover one feature area
4. **Mock appropriately** - E2E tests mock the Wails backend but test real UI behavior

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
* Do not add new features directly to App.svelte - create components instead
* Do not let any single file grow beyond 500 lines - refactor into smaller components

## Common Workflow

### Code Style and Formatting

* **Go**: Use `go fmt` to format all Go files after backend changes
* **Frontend**: Use `npx @biomejs/biome check --write frontend/src/` after frontend changes
* **TypeScript**: All frontend code uses TypeScript with proper type annotations
* **CSS**: Avoid using `!important` - properly structure selectors and specificity instead

### Biome Linting Patterns

**IMPORTANT**: When suppressing Biome warnings for Svelte-specific patterns:

* **Single-line imports**: Use `// biome-ignore lint/rule/name: reason` on the line before
* **Multi-line imports with start/end pattern**:
  ```typescript
  // biome-ignore-start lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
  import {
    someStore,
    anotherStore,
  } from "./stores/store.js";
  // biome-ignore-end lint/correctness/noUnusedImports: Used in Svelte reactive statements with $ prefix
  ```
  **Critical**: The `biome-ignore-end` line MUST include the exact same lint rule and comment as the `biome-ignore-start` line

* **Common Svelte patterns that need suppression**:
  * Stores accessed via `$storeName` syntax (marked as unused imports)
  * Components imported but only used in templates (marked as unused imports)
  * Type imports that Biome suggests converting to `import type` but are actually used as components

### Manual Testing Notification

When manual testing or user approval is needed, notify the user with:
```bash
terminal-notifier -title "ClaudeAI | Weld" -group WELD -message "[Brief description of what needs testing/approval]" -sound default
```

Examples:
- `terminal-notifier -title "ClaudeAI | Weld" -group WELD -message "Ready to test: Menu component extraction" -sound default`
- `terminal-notifier -title "ClaudeAI | Weld" -group WELD -message "Please review: CSS moved to DiffViewer" -sound default`
- `terminal-notifier -title "ClaudeAI | Weld" -group WELD -message "Manual test needed: File comparison banners" -sound default`

### Component Architecture

**IMPORTANT**: Always prefer creating Svelte components over adding to existing files:

* **Component Size**: Keep components focused and under 300 lines when possible
* **Single Responsibility**: Each component should have one clear purpose
* **Extract Early**: When adding new features, create new components rather than expanding existing ones
* **Component Structure**:
  * Create components in `frontend/src/components/`
  * Use PascalCase for component filenames (e.g., `FileSelector.svelte`)
  * Include component-specific styles within the component's `<style>` block
  * Export props using `export let` for reactivity
* **Utilities**: Extract reusable logic into `frontend/src/utils/` as TypeScript modules
* **Types**: Define shared types in `frontend/src/types.ts`

**Examples of when to create a new component**:
* Adding a new UI element (dialog, panel, button group)
* Implementing a feature that adds >50 lines to an existing component
* Creating reusable UI patterns
* Extracting complex logic that makes a component hard to read

### Git Workflow

* Create feature branches from `main`
* Make changes and test locally with `wails dev`
* Run formatting commands before committing
* Run unit and integration tests before committing
* **Commit messages**: 
  * Keep subject line ≤ 50 characters for readability
  * Do NOT include "Generated with" or "Co-Authored-By" lines
* **Pull requests**:
  * Do NOT include "Generated with" or emoji robot lines in PR descriptions
* Use pull requests for all merges to `main`
* Run `wails build` and ensure no errors before merging

### Task Management

* **TODO.md is the canonical todo list** - keep it updated as tasks are completed or added
* When completing a task, move it to the appropriate "Completed" section
* When finding new bugs or needed improvements, add them to the appropriate priority section
* Use checkbox format: `- [ ]` for pending, `- [x]` for completed
* **Always update TODO.md** when:
  - Starting work on a new task
  - Completing a task
  - Discovering new work that needs to be done
  - Moving tasks between priority levels

### Post-Merge Cleanup

After a PR is merged:
1. Switch to main: `git checkout main`
2. Pull latest changes: `git pull`
3. Delete local feature branch: `git branch -d feat/branch-name`
4. Prune stale remote branches: `git remote prune origin`

### Pre-Commit Checklist

**Complete these checks before commits that touch code:**

- [ ] Verify all changes are necessary - remove any failed attempts or debugging code
- [ ] Run formatters: `go fmt` and `npx @biomejs/biome check --write frontend/src/`
- [ ] Run relevant unit tests for changed files
- [ ] Check commit subject line length: `echo -n "subject line" | wc -c` (MUST be ≤50 characters)

**Automated Check**: Run `./bin/pre-commit-check.sh` or enable the Git hook:
```bash
# Enable automatic pre-commit checks
git config core.hooksPath .githooks

# Or run manually before each commit
./bin/pre-commit-check.sh
```

The pre-commit script will:
- Check for debugging code (console.log, fmt.Printf, TODO, etc.)
- Run formatters on staged files only
- Run tests for changed packages/files
- Validate commit message length

### Pre-PR Checklist

**CRITICAL: Complete ALL checks before opening a Pull Request:**

1. **Code Quality**
   - [ ] All commits follow commit message guidelines (≤50 char subject)
   - [ ] No debugging code, console.logs, or failed attempts
   - [ ] Code follows existing patterns and conventions

2. **Formatting & Linting**
   - [ ] Backend: `go fmt ./...`
   - [ ] Frontend: `npx @biomejs/biome check --write frontend/src/`
   - [ ] No biome warnings or errors

3. **Testing**
   - [ ] Backend tests pass: `go test ./... -v`
   - [ ] Frontend tests pass: `cd frontend && bun run test`
   - [ ] Coverage is maintained or improved: `cd frontend && bun run test:coverage`

4. **E2E Tests** (if UI/interaction changes)
   - [ ] Start dev server: `wails dev` (in separate terminal)
   - [ ] Run E2E tests: `cd frontend && bun run test:e2e`
   - [ ] All E2E tests pass
   - [ ] Note runtime: _______ seconds (flag if >60s)

5. **Build Verification**
   - [ ] Application builds: `wails build`
   - [ ] No build warnings or errors

6. **Manual Testing** (if applicable)
   - [ ] Test the specific feature/fix manually
   - [ ] Verify no regressions in related features
   - [ ] Test on both light and dark themes

7. **Documentation**
   - [ ] Update TODO.md if completing/adding tasks
   - [ ] Update CLAUDE.md if changing workflows
   - [ ] Add code comments for complex logic

**Note**: Skip E2E tests only if changes are purely backend, documentation, or non-UI refactoring. When in doubt, run them.

**Automated Check**: Run `./bin/pre-pr-check.sh` to automatically execute most of these checks. The script will:
- Check for uncommitted changes
- Run all formatters
- Execute backend and frontend tests
- Run E2E tests if frontend files changed (and wails dev is running)
- Verify the build works
- Check commit message lengths
- Report total E2E runtime if >60 seconds

### End-of-Day Checklist

**Complete these tasks at the end of each development session:**

1. **Run formatters and fix any issues**
   - Frontend: `npx @biomejs/biome check --write frontend/src/`
   - Backend: `go fmt ./...`

2. **Run tests and review quality**
   - Frontend: `bash -c "cd frontend && bun run test"`
   - Backend: `go test ./... -v`
   - Review test results qualitatively:
     - Are we testing the right behaviors?
     - Do the tests cover critical user paths?
     - Are there edge cases we're missing?

3. **Report test coverage metrics**
   - Frontend coverage: `bash -c "cd frontend && bun run test:coverage"`
   - Backend coverage: `go test ./... -v --cover`
   - Note: Focus on test quality over coverage numbers

4. **Code review and improvement suggestions**
   - Review the day's changes for:
     - Components that are growing too large (>300 lines)
     - Repeated code patterns that could be extracted
     - Complex logic that could be simplified
     - Missing tests for new functionality
     - Performance concerns or potential optimizations
   - Add any identified improvements to the todo list

### Testing and Validation

* Run `go test ./... -v --cover` for backend unit tests with coverage
* Run `cd frontend && bun run test:coverage` for frontend tests with coverage using the Vitest test runner
* **Component Testing**: Create test files for all new components (e.g., `ComponentName.test.ts`)
* **Manual Testing**: Before committing any UI changes, ask the user to run `wails dev` and manually test the affected functionality
* Test manually using sample files in `resources/sample-files/`
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

* Use [mise](https://mise.jdx.dev/getting-started.html) to manage Go and Node.js versions:
  * Install the latest version of Go and make it the default version for the project directory only by running `mise use go@latest`
  * Install the latest version of Node.js and make it the default version for the project directory only by running `mise use node@latest`
* Install other tools using their recommended methods:
  * **Wails CLI**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
  * **Bun**: See [installation instructions](https://bun.sh/docs/installation) (e.g., `brew install oven-sh/bun/bun` on macOS)
  * **Just**: See [installation options](https://github.com/casey/just#installation) (e.g., `brew install just` on macOS)
* Run `wails doctor` after setup to verify environment
