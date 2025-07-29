# Manual Test Script - Critical Gaps in Automated Testing

This script covers functionality that our automated tests cannot fully verify. With our new E2E test coverage using Playwright, we have significantly reduced the manual testing burden. This script now focuses on the remaining gaps that still require manual verification.

## What's Now Covered by E2E Tests

Our Playwright E2E tests now verify:
- ✅ Keyboard navigation (j/k keys, boundary detection)
- ✅ Copy operations (Shift+L, Shift+H shortcuts)
- ✅ Arrow button copy operations
- ✅ Save button state management
- ✅ Undo functionality (Ctrl/Cmd+Z)
- ✅ Discard all changes functionality
- ✅ Current diff highlighting
- ✅ Navigation after copy operations

## Test Environment Setup

1. Start the application: `wails dev`
2. Use sample files from `resources/sample-files/` for consistent testing
3. Test on both light and dark themes
4. Test with both short and long files to verify scrolling behavior

---

## 1. Keyboard Navigation & Copy Operations

**Coverage**: ✅ E2E tests cover navigation (`j`/`k`), copy shortcuts (`Shift+L`/`Shift+H`), arrow button clicks, and save button state changes

**Remaining Gap**: Audio feedback and visual animations

### Test: Audio/Visual Feedback
- [ ] At first diff, press `k` - verify sound/beep for boundary
- [ ] At last diff, press `j` - verify sound/beep for boundary
- [ ] Verify smooth scroll animations when navigating
- [ ] Press `g` - verify jumps to first diff (when implemented)
- [ ] Press `G` - verify jumps to last diff (when implemented)

---

## 2. Save Operations & File State Management

**Coverage**: ✅ E2E tests verify save button enables/disables with copy operations, undo functionality

**Remaining Gap**: Actual file I/O and keyboard save shortcuts

### Test: File I/O Operations
- [ ] Make changes with copy operations
- [ ] Click save button - verify:
  - [ ] File actually saves to disk (check file contents)
  - [ ] No data corruption
  - [ ] Timestamps update

### Test: Keyboard Save Operations
- [ ] Make changes with copy operations
- [ ] Press `Cmd/Ctrl+S` - verify:
  - [ ] Files with unsaved changes are saved to disk
  - [ ] Files without changes are ignored
  - [ ] No crash occurs

### Test: Unsaved Changes Warning
- [ ] Make changes with copy operations
- [ ] Try to select new files - verify:
  - [ ] Confirmation dialog appears (if implemented)
  - [ ] Changes are preserved if canceled
  - [ ] Changes are discarded if confirmed

---

## 3. Minimap Interactions

**Gap**: Automated tests can't verify actual navigation or visual updates

### Test: Minimap Navigation
- [ ] Load files with many diffs (use long sample files or create custom ones)
- [ ] Verify minimap appears on right side
- [ ] Click different positions in minimap - verify:
  - [ ] Main view scrolls to clicked position
  - [ ] Viewport indicator updates position
  - [ ] Smooth scrolling animation (if present)

### Test: Minimap Viewport Dragging
- [ ] Drag the viewport indicator in minimap
- [ ] Verify main view scrolls accordingly
- [ ] Verify smooth dragging experience

### Test: Minimap Visual Feedback
- [ ] Navigate through diffs with `j`/`k`
- [ ] Verify current diff is highlighted in minimap
- [ ] Hover over minimap - verify tooltip shows line numbers

---

## 4. Scroll Synchronization

**Gap**: Automated tests can't verify actual scroll position updates

### Test: Synchronized Scrolling
- [ ] Load files with 50+ lines
- [ ] Scroll left pane with mouse wheel - verify right pane scrolls in sync
- [ ] Scroll right pane with mouse wheel - verify left pane scrolls in sync
- [ ] Drag scroll bar on left - verify right side updates
- [ ] Verify center gutter scrolls with both panes

### Test: Horizontal Scroll Sync
- [ ] Load files with very long lines (>200 characters)
- [ ] Scroll horizontally in left pane - verify right pane follows
- [ ] Scroll horizontally in right pane - verify left pane follows

---

## 5. Menu & Settings Interactions

**Gap**: Automated tests can't verify actual menu behavior and persistence

### Test: Hamburger Menu
- [ ] Click hamburger menu button - verify menu opens
- [ ] Click outside menu - verify menu closes
- [ ] Click menu items - verify menu closes after selection

### Test: Dark Mode Toggle
- [ ] Toggle dark mode from menu - verify:
  - [ ] Theme changes immediately
  - [ ] Menu button text updates (🌙/☀️)
  - [ ] Theme persists after app restart
  - [ ] All UI elements adapt to new theme

### Test: Minimap Toggle (via View menu)
- [ ] Toggle minimap visibility - verify:
  - [ ] Minimap shows/hides immediately
  - [ ] Layout adjusts properly
  - [ ] Setting persists after restart

### Test: File > Save Menu Items
- [ ] Load two different files and compare
- [ ] Verify File > Save submenu shows with all items disabled
- [ ] Make changes via copy operation (Shift+L)
- [ ] Verify File > Save > Save Right Pane enables
- [ ] Click Save Right Pane - verify file saves and menu item disables
- [ ] Make changes to both files
- [ ] Verify Save Left Pane, Save Right Pane, and Save All enable
- [ ] Test keyboard shortcuts:
  - [ ] Cmd/Ctrl+S for Save All (saves both files if they have changes)

### Test: Edit > Discard All Changes Menu Item
- [ ] Make changes to both files
- [ ] Verify Edit > Discard All Changes enables
- [ ] Click Discard All Changes - verify:
  - [ ] All changes are discarded
  - [ ] Files reload from disk
  - [ ] Menu item disables
  - [ ] Save menu items all disable

---

## 6. Quit Dialog & Session Management

**Gap**: Automated tests can't verify actual dialog appearance or app quit behavior

### Test: Quit Dialog Flow
- [ ] Make unsaved changes with copy operations
- [ ] Press `Cmd/Ctrl+Q` - verify:
  - [ ] Quit dialog appears with three options
  - [ ] "Save Selected & Quit" option works
  - [ ] "Discard All & Quit" option works
  - [ ] "Cancel" keeps app running and preserves changes

### Test: File Selection Dialog
- [ ] Click "Select Left File" button
- [ ] Verify native file dialog opens
- [ ] Select various file types - verify proper icons display
- [ ] Test with very long file paths

---

## 7. Startup & Command Line Behavior

**Gap**: Automated tests can't verify actual startup behavior

### Test: Command Line File Loading
- [ ] Restart app with: `./app file1.txt file2.txt`
- [ ] Verify files load automatically
- [ ] Verify auto-comparison occurs
- [ ] Verify scroll to first diff (if implemented)

### Test: Theme Persistence
- [ ] Set dark mode and quit app
- [ ] Restart app - verify dark mode is restored
- [ ] Same test with light mode

---

## 8. Error Handling & Edge Cases

**Gap**: Automated tests can't verify actual error dialogs or edge case behavior

### Test: Binary File Handling
- [ ] Try to load a binary file using the file selector:
  - [ ] Try `resources/sample-files/binary-test.bin`
  - [ ] Verify error message: "binary files cannot be compared: [filename]"
  - [ ] Verify file is not loaded and no garbled content appears
- [ ] Try to launch app with binary files from command line:
  - [ ] Run: `./app resources/sample-files/binary-test.bin file.txt`
  - [ ] Verify app exits with error: "Cannot compare binary file: [path]"
- [ ] Verify app doesn't crash in either case

### Test: File System Errors
- [ ] Load a file, then delete it from file system
- [ ] Try to save changes - verify proper error handling
- [ ] Try to compare deleted file - verify graceful failure

### Test: Large File Performance
- [ ] Load files with 1000+ lines
- [ ] Verify smooth scrolling performance
- [ ] Verify minimap renders correctly
- [ ] Verify copy operations still work efficiently

---

## 9. Accessibility & Visual Feedback

**Gap**: Automated tests can't verify visual appearance or accessibility

### Test: Visual Feedback
- [ ] Verify diff highlighting is clear and readable
- [ ] Verify current diff has distinct highlighting
- [ ] Verify syntax highlighting works for various file types
- [ ] Test with both light and dark themes

### Test: Keyboard Accessibility
- [ ] Navigate entire app using only keyboard
- [ ] Verify focus indicators are visible
- [ ] Verify all functionality accessible via keyboard

---

## Critical Issues to Watch For

With our improved E2E test coverage, the remaining critical areas for manual testing are:

1. **Binary file rejection** - Should show error, not garbled content
2. **File I/O operations** - Actual disk writes and data integrity
3. **Scroll synchronization** - Both panes should stay in sync
4. **Theme persistence** - Settings should survive app restart
5. **Performance** - Large files should remain responsive
6. **Audio feedback** - Boundary beeps and error sounds
7. **Native dialogs** - File selection, quit confirmation

---

## 7. Go Menu Testing

### Previous/Next Diff Navigation
1. Compare two files with multiple differences
2. Verify Go menu exists with Previous Diff and Next Diff options
3. Test Previous Diff:
   - Initially disabled when no diff is selected
   - Press `k` key or use Go > Previous Diff
   - Navigates to previous difference
   - Shows notification sound when at first diff
   - Menu item disabled when at first diff
4. Test Next Diff:
   - Initially enabled when at first diff
   - Press `j` key or use Go > Next Diff
   - Navigates to next difference
   - Shows notification sound when at last diff
   - Menu item disabled when at last diff
5. Test state updates:
   - After each navigation, menu items update enable/disable state
   - Current diff is highlighted in UI
   - Minimap shows current position

## Post-Refactoring Verification

After any significant refactoring, run through this entire script to ensure:
- Core functionality still works end-to-end
- Performance hasn't degraded
- UI responsiveness is maintained
- Error handling remains robust
- Accessibility isn't broken

This manual testing complements our automated smoke tests by verifying the actual user experience and complex interactions that can't be simulated in the test environment.