# Weld Development TODO List

**Note: This file has been deprecated in favor of [GitHub Issues](https://github.com/robwilkerson/weld/issues). All pending tasks have been migrated to the issue tracker.**

## High Priority

### Completed
- [x] Cut v0.5.2-v0.5.5 releases with ARM64 builds and CI improvements
- [x] Add keyboard shortcuts documentation (Shift+H/L) to README
- [x] Add integration tests for copy menu functionality
- [x] Add comprehensive tests for utils/diff.ts (coverage improved from 71.55% to 98.27%)
- [x] Fix menu item text wrapping on Linux
- [x] Add Ubuntu development instructions to README
- [x] Fix copy menu items disabled on initial diff load
- [x] Add feature to remember last used directory in file selectors
- [x] Remove redundant File > Quit menu item on macOS
- [x] Create Homebrew cask formula (unpublished, on feat/homebrew-package branch)
- [x] Fix Wails/Go version mismatch issue
  - [x] Install Wails via `go install` instead of Nix to avoid version conflicts
  - [x] Document the installation method in README and CLAUDE.md
  - [x] Updated mise documentation to only manage Go and Node.js versions
- [x] Improve type safety - Replace `any` types and non-null assertions
  - [x] Replace 3 instances of `any` type in DiffViewer component refs
  - [x] Create proper TypeScript interfaces for Svelte component refs
  - [x] Fix webkitAudioContext browser compatibility typing
  - [x] Review and confirm no problematic non-null assertions
- [x] Add Edit > Discard All Changes menu item
- [x] Add File > Save submenu with Save Left/Right/All options
- [x] Test new menu items and add to manual test script if needed
- [x] Add Go > Previous Diff and Go > Next Diff menu items
- [x] Fix broken frontend tests by adding UpdateDiffNavigationMenuItems to mocks
- [x] Fix app to reject binary files with error instead of displaying garbled content
- [x] Fix navigation scrolling - diffs weren't centering properly due to Svelte prop timing
- [x] Fix multiple activity indicators showing for multi-line diff chunks
- [x] Fix minimap not highlighting current diff on keyboard navigation
- [x] Fix minimap not showing all diff chunks correctly
- [x] Set up Playwright E2E testing infrastructure
- [x] Create keyboard navigation E2E tests with UI verification
- [x] Remove redundant keyboard-navigation.test.ts integration tests
- [x] Standardize E2E test patterns between test files
- [x] Create copy operations E2E tests with full UI verification
- [x] Fix copy operations E2E test failures
- [x] Remove redundant copy-operations.test.ts integration tests
- [x] Create minimap interaction E2E tests (click to navigate, viewport dragging, visibility toggle)
- [x] Integrate E2E tests into pre-commit and pre-PR workflows
- [x] Fix CI compatibility issues with Playwright browser paths
- [x] Fix Linux CI webkit dependencies for Wails dev server
- [x] Create save operations E2E tests (7 passing tests, 3 skipped for menu event features)
- [x] Create file selection E2E tests (workflow and error handling)
- [x] Remove redundant integration tests replaced by E2E
  - [x] minimap-interaction.test.ts
  - [x] save-operations.test.ts
  - [x] copy-operations.test.ts
- [x] Extract fileStore from App.svelte - centralized file path/name management
- [x] Extract diffStore from App.svelte - manage diff state and navigation
- [x] Extract unsavedChangesStore from App.svelte - track save state
- [x] Extract navigationStore from App.svelte - handle diff navigation
- [x] Update pre-commit hooks to run all tests (catch regressions)
- [x] Fix commit message validation (move to proper commit-msg hook)
- [x] Extract uiStore from App.svelte
  - [x] Manage showMinimap, isComparing, error state
  - [x] Handle theme/dark mode state
  - [x] Consolidate UI-related state management
- [x] Fix copy operation bug for modified lines - CopyToFile was INSERT not REPLACE
- [x] Fix Intel Mac support - build universal binaries with -platform darwin/universal
- [x] Quick fixes from code review
  - [x] Remove unused 'set' variable in uiStore.ts (line 38)
  - [x] Replace 'any' type in uiStore.test.ts with proper DocumentMock interface
- [x] Be more deliberate about handling errors - implemented flash message system
- [x] Address accessibility warnings - Add proper ARIA labels and keyboard focus management for screen readers
  - [x] Fixed ARIA roles and labels in QuitDialog (overlay, dialog elements)
  - [x] Added keyboard navigation support to Minimap viewport slider
  - [x] FlashMessage already had proper role="alert" and aria-label
  - [x] Removed duplicate CSS selectors in QuitDialog
- [x] Add Copy to Left/Right menu items with Shift+H/L keyboard shortcuts
  - [x] Both menu items work bidirectionally for all diff types
  - [x] Menu items are enabled whenever any diff is selected
  - [x] Fixed E2E test failures by adding UpdateCopyMenuItems mock
  - [x] Documentation already exists in README keyboard shortcuts table

## Medium Priority

## Low Priority

### Completed
- [x] Move error styles to ErrorMessage component (reduced App.svelte by 31 lines)
  - Note: empty-state styles already existed in DiffViewer, removed duplicates from App
- [x] Extract CSS from App.svelte into components (COMPLETE - reduced by 396 lines total)
  - [x] Move file comparison banners to DiffViewer (reduced by 95 lines)
  - [x] Extract quit dialog styles to QuitDialog component (reduced by 138 lines)
  - [x] Remove duplicate save button styles (reduced by 17 lines)
  - [x] Move file header/info dark mode styles to DiffHeader (reduced by 14 lines)
- [x] Extract copy operation UI from DiffGutter into CopyOperations component
- [x] Fix current diff indicator not showing on initial load - auto-navigate to first diff
- [x] Extract keyboard handling from App.svelte to utils/keyboard.ts (reduced by 40 lines)
  - [x] Implement Enter key to compare files when Compare button is enabled
- [x] Implement: Jump to first diff with g key and menu item
- [x] Implement: Jump to last diff with G key and menu item
- [x] Add comprehensive keyboard handling test suite (keyboard.test.ts with 20 tests)
- [x] Add dynamic navigation tests for g/G after chunk removal scenarios
- [x] Fix E2E test regression - Flash message component and UpdateDiffNavigationMenuItems mocks
- [x] Cut v0.5.0 release with g/G navigation and comprehensive test coverage

## Notes

### Testing Strategy
We now use Playwright for E2E testing to verify actual user interactions and UI behavior. E2E tests replace integration tests that only verified "no errors thrown" without checking actual behavior. The testing hierarchy is:
- E2E tests (Playwright) - User workflows, visual feedback, real browser behavior
- Integration tests (Vitest) - Complex component interactions, error states
- Unit tests (Vitest) - Pure functions, business logic, edge cases

See CLAUDE.md for detailed testing guidelines and when to use each type.

### Refactoring Goals
The refactoring items aim to improve code organization by:
- Extracting complex logic into dedicated services/modules
- Creating more focused, reusable components
