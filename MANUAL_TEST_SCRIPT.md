# Manual Test Script - Critical Gaps in Automated Testing

This script covers functionality that our automated integration tests cannot verify due to test environment limitations. These are the critical behaviors that need manual verification, especially after refactoring.

## Test Environment Setup

1. Start the application: `wails dev`
2. Use sample files from `resources/sample-files/` for consistent testing
3. Test on both light and dark themes
4. Test with both short and long files to verify scrolling behavior

---

## 1. Keyboard Navigation & Copy Operations

**Gap**: Automated tests can't verify actual cursor movement, visual feedback, or state changes

### Test: Diff Navigation
- [ ] Load `addfirst-1.js` vs `addfirst-2.js` and compare
- [ ] Press `j` - verify cursor moves to next diff with visual highlight
- [ ] Press `k` - verify cursor moves to previous diff
- [ ] At first diff, press `k` - verify sound/feedback for boundary
- [ ] At last diff, press `j` - verify sound/feedback for boundary
- [ ] Press `g` - verify jumps to first diff (when implemented)
- [ ] Press `G` - verify jumps to last diff (when implemented)

### Test: Copy Operations with State Changes
- [ ] Load `addmiddle-1.go` vs `addmiddle-2.go` and compare
- [ ] Navigate to first diff with `j`
- [ ] Press `Shift+L` - verify:
  - [ ] Content copies from left to right
  - [ ] Cursor advances to next diff automatically
  - [ ] Save button enables for right file
  - [ ] File path shows (no unsaved indicator exists in app)
- [ ] Press `Shift+H` - verify:
  - [ ] Content copies from right to left
  - [ ] Cursor advances to next diff
  - [ ] Save button enables for left file

### Test: Arrow Button Copy Operations
- [ ] Click arrow buttons in gutter between panes
- [ ] Verify same behavior as keyboard shortcuts
- [ ] Test both single-line and chunk copy operations

---

## 2. Save Operations & File State Management

**Gap**: Automated tests can't verify actual file I/O or save button state changes

### Test: Save Button State Management
- [ ] Load any two different files and compare
- [ ] Verify save buttons are disabled initially
- [ ] Make a copy operation (`Shift+L`)
- [ ] Verify right save button enables
- [ ] Click save button - verify:
  - [ ] File actually saves to disk
  - [ ] Save button disables again after save
  - [ ] No crash or error

### Test: Keyboard Save Operations
- [ ] Make changes with copy operations
- [ ] Press `Cmd/Ctrl+S` - verify:
  - [ ] Files with unsaved changes are saved
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
- [ ] Try to load a binary file (image, executable, etc.)
- [ ] Verify app shows error instead of garbled content (KNOWN BUG)
- [ ] Verify app doesn't crash

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

Based on our automated testing gaps, pay special attention to:

1. **Binary file rejection** - Should show error, not garbled content (KNOWN BUG)
2. **Cursor advancement** - Should move to next diff after copy operations
3. **Scroll synchronization** - Both panes should stay in sync
4. **Theme persistence** - Settings should survive app restart
5. **Performance** - Large files should remain responsive

---

## Post-Refactoring Verification

After any significant refactoring, run through this entire script to ensure:
- Core functionality still works end-to-end
- Performance hasn't degraded
- UI responsiveness is maintained
- Error handling remains robust
- Accessibility isn't broken

This manual testing complements our automated smoke tests by verifying the actual user experience and complex interactions that can't be simulated in the test environment.