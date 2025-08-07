# Weld Development TODO List

## High Priority

### Pending
- [ ] Fix Wails/Go version mismatch issue
  - [ ] Install Wails via `go install` instead of Nix to avoid version conflicts
  - [ ] Document the installation method in README
  - [ ] Consider creating a mise plugin for Wails or using direnv
- [ ] Fix `large-*` files issues
  - [ ] Scrolling gets out of sync
  - [ ] Line 26 is weird and the chunk is handled as 2 separate diffs; happens elsewhere in the file as well when there's a modified line adjacent to a new/deleted line, I think
- [ ] Improve type safety - Replace `any` types and non-null assertions
  - [ ] Replace 3 instances of `any` type in DiffViewer component refs
  - [ ] Create proper TypeScript interfaces for Svelte component refs
- [ ] Enable directory comparison since file diffs are fully featured and stable
- [ ] Directory comparison should allow double click on a file in the directory to open a diff of that file
- [ ] App icon
- [ ] Make available in package managers
  - [ ] Homebrew cask
  - [ ] Chocolatey,
  - [ ] Scoop
  - [ ] Etc.?

### Completed
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

## Medium Priority

### Pending
- [ ] Add an unsaved indicator
- [ ] Search/Find functionality - Add ability to search within the diff (Ctrl+F) for large files
- [ ] Upgrade Svelte and vite to the latest version (and all that entails)
  * Related to [PR #7](https://github.com/robwilkerson/weld/pull/7)
- [ ] Enable performant syntax highlighting
- [ ] Review backend test coverage and add quality tests to improve coverage from 58%
- [ ] Address accessibility warnings - Add proper ARIA labels and keyboard focus management for screen readers
- [ ] Remove unused CSS selectors flagged by biome (QuitDialog .button-group styles)

## Low Priority

### Pending
- [ ] Extract save button logic from DiffViewer into separate component
- [ ] Review DiffViewer.svelte for further extraction opportunities (currently 706 lines)
- [ ] Consider creating a DiffViewerToolbar component (combine save buttons and file headers)
- [ ] Fix flicker when copying lines (diff navigation reset)
- [ ] Create a dedicated DiffOperations service/module
- [ ] Extract file operation handlers into a separate module
- [ ] Create a dedicated MenuBar component
- [ ] Menu bar option: Edit > Copy Left
- [ ] Menu bar option: Edit > Copy Right
- [ ] Investigate tooltip display consistency issue
- [ ] Extract syntax highlighting logic into a separate service
- [ ] Recently compared files - Quick access to recent file pairs for faster re-comparison
- [ ] Support custom themes - Allow users to customize colors and appearance
- [ ] Redo functionality
- [ ] Undo multiple (up to 50, perhaps)
- [ ] Optionally display a status bar
  - [ ] Current file's lines added, removed, modified
  - [ ] File charset
  - [ ] File type (go, ruby, etc.)
  - [ ] Load/processing times (useful for large files)
    - [ ] time to open the files
    - [ ] time to evaluate the diffs
    - [ ] time to display
    - [ ] ...
- [ ] Make the file content editable directly
- [ ] Implement E2E tests in CI for Linux and Windows platforms (currently macOS only)

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
