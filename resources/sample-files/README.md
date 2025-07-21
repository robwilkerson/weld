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

6. Modified content (`modified-*.cs`)

    Tests when existing lines are changed (not just added/removed). The files contain multiple types of modifications including method signature changes (sync to async), parameter modifications, additional logic, and refactored implementations. This exercises the similarity detection algorithm and inline diff highlighting for modified lines.

7. Moved content (`moved-*.sql`)

    Tests when blocks of code are relocated within the file. A 10-line function block (trigger function and CREATE TRIGGER statement) has been moved from after the index creation to near the end of the file. This tests how the diff tool handles relocated code blocks without modifications.

8. Mixed changes (`mixed-*.rb`)

    Test files with multiple types of changes including:
    - Multi-line addition: New `check_email_uniqueness` method
    - Single-line addition: Cache check in `find_user` method
    - Multi-line modification: Enhanced `update_email` method with validation and notifications
    - Single-line modification: Method name change from `validate_email` to `validate_email_format`
    - Deletion: Removed `legacy_authenticate` method
    - Moved code: `notify_user` method relocated from bottom to middle of class

9. Large files (`large-*.php`)

    Test performance with files containing thousands of lines. The files are ~2000+ lines each with extensive changes throughout including new methods, enhanced implementations, and modified signatures. Performance testing shows excellent results with ~78ms backend processing and ~735ms total time for 3375 lines.

### Coming Soon(-ish)

2. Binary files - Test handling of non-text files (images, PDFs, etc.)
3. Encoding differences - Test files with different character encodings
4. Line ending differences - Test files with different line endings (CRLF vs LF)
5. Whitespace differences - Test files that differ only in whitespace (tabs vs spaces, trailing spaces)
6. Conflict markers - Test files containing git merge conflict markers
