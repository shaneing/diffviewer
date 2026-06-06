# Design: Desktop Diff Viewer

## Overview

The application should become a read-only offline desktop tool for inspecting local Git changes and merge conflicts. The existing `jetbrains_style_3_way_diff.html` prototype defines the visual direction: IDE-like project navigation, dark diff panes, synchronized scrolling, line gutters, and conflict-aware highlighting.

## Stack

- Desktop shell: Tauri
- Frontend: React, Vite, TypeScript
- Backend bridge: Tauri commands for filesystem and Git access
- Runtime mode: offline local desktop app

React + Vite gives the diff interface a maintainable component structure for file trees, tabs, pane synchronization, diff chunks, conflict sections, and local UI state. Tauri keeps the desktop app compact and gives the frontend controlled access to local folders and Git data.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│ Tauri Desktop App                                   │
├─────────────────────────────────────────────────────┤
│ React Frontend                                      │
│ - Project picker                                    │
│ - Changed/conflicted file tree                      │
│ - 2-way diff panes                                  │
│ - Conflict / 3-way-style viewer                     │
│ - Read-only navigation state                        │
├─────────────────────────────────────────────────────┤
│ Tauri Backend Commands                              │
│ - open folder dialog                                │
│ - get Git working tree status                       │
│ - read file contents                                │
│ - read baseline contents from Git                   │
│ - detect conflict markers                           │
├─────────────────────────────────────────────────────┤
│ Local System                                        │
│ - selected folder                                   │
│ - Git repository                                    │
│ - working tree files                                │
└─────────────────────────────────────────────────────┘
```

## Read-Only Boundary

The app must not write to the selected repository in the initial version. File operations are limited to opening a folder, reading Git status, reading baseline file contents, reading working tree file contents, and parsing conflict markers.

## Diff Sources

### Working Tree Changes

For changed files, the app should compare the Git baseline version against the current working tree version and render a 2-way diff.

### Merge Conflict Files

For conflict files, the app should detect conflict markers in the working tree file and render a conflict-oriented 3-way-style view. The first implementation can parse marker sections from file contents:

```text
<<<<<<< ours
...
=======
...
>>>>>>> theirs
```

A later enhancement may read Git index stages for a fuller base/ours/theirs model.

## Offline Behavior

The app must not depend on CDN assets, remote services, telemetry, cloud APIs, or network-only resources. Dependencies needed by the UI should be bundled into the app.

## Local Dev First

The first milestone should prioritize a reliable local development command and visible desktop app behavior over signed distribution packages.
