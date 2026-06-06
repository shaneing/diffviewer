# Tasks

## 1. Project Foundation

- [x] 1.1 Scaffold a Tauri application with React, Vite, and TypeScript.
- [x] 1.2 Configure local development commands for running the desktop app.
- [x] 1.3 Move away from CDN runtime dependencies so the app works offline.
- [x] 1.4 Preserve the existing HTML prototype as a visual reference.

## 2. Folder And Git Inspection

- [x] 2.1 Add a folder picker for selecting a local project folder.
- [x] 2.2 Detect whether the selected folder is inside a Git repository.
- [x] 2.3 Read Git working tree status for modified, added, deleted, renamed, and conflicted files.
- [x] 2.4 Display changed and conflicted files in a project/file tree.

## 3. Read-Only Diff Viewing

- [x] 3.1 Read baseline file contents from Git for working tree comparisons.
- [x] 3.2 Read working tree file contents from disk.
- [x] 3.3 Render read-only 2-way diffs for working tree changes.
- [x] 3.4 Detect merge conflict markers in conflicted files.
- [x] 3.5 Render read-only conflict-oriented 3-way-style diffs.
- [x] 3.6 Keep diff pane scrolling and line gutter alignment stable.

## 4. Offline Desktop Behavior

- [x] 4.1 Ensure the app runs without network access.
- [x] 4.2 Keep all repository inspection local to the user's machine.
- [x] 4.3 Avoid write operations to the selected repository.

## 5. Verification

- [x] 5.1 Verify the app launches in local development mode.
- [x] 5.2 Verify opening a Git folder populates changed files.
- [x] 5.3 Verify a modified file displays a 2-way diff.
- [x] 5.4 Verify a conflict file displays conflict sections.
- [x] 5.5 Verify no review, edit, resolve, commit, AI, or network feature is required.
