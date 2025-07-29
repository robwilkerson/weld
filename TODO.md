# Weld Development TODO List

## High Priority

### Pending
- [ ] Be more deliberate about handling errors (error-noread.txt)
- [ ] Fix `large-*` files issues
  - [ ] Scrolling gets out of sync
  - [ ] Line 26 is weird and the chunk is handled as 2 separate diffs; happens elsewhere in the file as well when there's a modified line adjacent to a new/deleted line, I think
- [ ] Improve type safety - Replace `any` types and non-null assertions
  - [ ] Replace 3 instances of `any` type in DiffViewer component refs
  - [ ] Create proper TypeScript interfaces for Svelte component refs
- [ ] Create E2E tests for remaining features
  - [ ] Save operations E2E tests (file operations and UI state)
  - [ ] Minimap interaction E2E tests (click to navigate, viewport dragging)
  - [ ] File selection E2E tests (workflow and error handling)
  - [ ] Quit dialog E2E tests (dialog appearance and behavior)
- [ ] Remove redundant integration tests replaced by E2E
  - [ ] minimap-interaction.test.ts (after E2E tests are created)
  - [ ] save-operations.test.ts (after E2E tests are created)
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

## Medium Priority

### Pending
- [ ] Implement: Jump to first diff with g key
- [ ] Implement: Jump to last diff with G key
- [ ] Implement: `Enter` to compare files if the `Compare` button is enabled
- [ ] Add an unsaved indicator
- [ ] Create Svelte stores for state management - Extract global state into stores
- [ ] Extract unsaved changes logic into a store or service
- [ ] Upgrade Svelte and vite to the latest version (and all that entails)
  * Related to [PR #7](https://github.com/robwilkerson/weld/pull/7)
- [ ] Enable performant syntax highlighting

## Low Priority

### Pending
- [ ] Moving global state to Svelte stores for better state management
- [ ] Create a dedicated DiffOperations service/module
- [ ] Extract file operation handlers into a separate module
- [ ] Create a dedicated MenuBar component
- [ ] Menu bar option: Edit > Copy Left
- [ ] Menu bar option: Edit > Copy Right
- [ ] Investigate tooltip display consistency issue
- [ ] Extract syntax highlighting logic into a separate service
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
