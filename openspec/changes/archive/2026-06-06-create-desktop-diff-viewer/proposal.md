# Create Desktop Diff Viewer

## Why

The project currently has a browser-based JetBrains-style 3-way diff prototype. To make it useful as a local development tool, it needs a cross-platform desktop shell that can open a local folder, inspect Git working tree changes, and visualize merge conflict files without requiring network access.

## What Changes

- Create a cross-platform desktop application for local development.
- Use Tauri as the desktop shell.
- Use React, Vite, and TypeScript for the frontend.
- Allow users to open a local folder as the current project.
- Detect Git working tree changes in the selected folder.
- Detect files that contain merge conflicts.
- Display read-only 2-way diffs for working tree changes.
- Display read-only conflict-oriented 3-way-style diffs for merge conflict files.
- Keep the app fully offline.

## Out of Scope

- Editing files.
- Accepting, rejecting, or resolving changes.
- Creating commits.
- AI review or AI-assisted conflict resolution.
- Cloud sync or remote services.
- Production packaging, signing, and auto-update.

## Impact

- Establishes the application foundation and local dev workflow.
- Introduces desktop runtime dependencies and frontend build tooling.
- Preserves the existing HTML prototype as a visual reference rather than as the final implementation structure.
