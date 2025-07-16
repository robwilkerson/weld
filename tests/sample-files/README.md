# Sample Files

This directory contains sample files for manual validation of core functionality. Each set of sample files can, and maybe should, represent source code from different languages. This is so that we can also test syntax highlighting for each of the file types when/if that gets implemented.

## Naming Convention

Each file follows a specific naming convention:

```
${test_scenario}-(1|2).${file_extension}
```

`${test_scenario}` is some kind of indication of the very discrete and specific scenario that the comparison is intended to represent. For example, `addfirst` represents two files that started exactly the same, but where one or more lines has been added to the very top of the file.

`-(1|2)` is just a naming convention to make it clear that the two files are related and, for most tests, intended to be compared to each other, but makes the filename unique. Probably good to test each file on each side of the diff window to be sure the UI isn't materially altered.

`.${file_extension}`, of course, is just the file extension itself which provides the system and the user a clue as to how the syntax highlighting should appear.

## Scenarios

### Available Now

1. Identical files (`same-1.js`, `same-2.js`)

    Should render zero diffs and a banner should be displayed across the top indicating that the files are identical.

2. Added content at the beginning of a file (`addfirst-*.js`)

    Should render a single diff highlighted as an addition in `addfirst-2.js`. There should be arrows allowing the user to add that content to `addfirst-1.js` _or_ delete that added content by "copying" the empty line from `addfirst-1.js`. The result of either action should enable the **Save** button next to the file that was changed and display the banner indicating that the files are identical.

3. Added content at the end of a file (`addend-*.py`)

    Similar to the `addfirst-*` scenario, but implemented at the very end of the file and adding 3 lines rather than 1, just to introduce another variation.

4. Added content in the middle of a file (`addmiddle-*.go`)

    Another test of 2 files that are the same except for new content that exists in one of them. In this case, the diff may be a little more complex depending on how it's performed, but it should be pretty clear what's happening.

5. Horizontal scrolling (`shortlines-*.java`)

    The scrollbar introduces a visual element that, if not handled properly can impact how files are displayed and introduce a misalignment across the left pane, action gutter, and right pane. In this case, both files have a bunch of short lines that require no horizontal scrolling, but to one of the files a long line has been added. This ensures that the UI adjusts for the scrollbar itself properly.

### Coming Soon(-ish)

1. Modified content (`modified-*.cs`) - Test when existing lines are changed (not just added/removed)
1. Moved content (`moved-*.cpp`) - Test when blocks of code are relocated
within the file
1. Mixed changes (`mixed-*.rb`) - Test files with multiple types of changes
(adds, deletes, modifications)
1. Large files (`large-*.php`) - Test performance with files containing
thousands of lines
1. Binary files - Test handling of non-text files (images, PDFs, etc.)
1. Encoding differences - Test files with different character encodings
1. Line ending differences - Test files with different line endings (CRLF vs
  LF)
1. Whitespace differences - Test files that differ only in whitespace (tabs
vs spaces, trailing spaces)
1. Conflict markers - Test files containing git merge conflict markers
