## Why

The current line numbering and code views (in 1-way, 2-way, and 3-way views) suffer from vertical and font-family misalignment. Setting font styles, sizes, and explicit line heights will ensure text aligns consistently across all panes.

## What Changes

- Modify styling for `.line-num` to use the same monospace font family as `.line-code` and `.gutter-line-num`.
- Set explicit `line-height: 20px` and reset `margin: 0` on `.line-code`, `.line-num`, and `.gutter-line-num`.
- The application remains fully offline and read-only. Editing code or writing to local repositories remains completely out of scope.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

*(None)*

## Impact

- **Affected Files**: `src/styles.css` is the only affected file containing the layout styles.
- **Dependencies**: No new npm packages or Rust dependencies are added.
- **System Boundaries**: This is a pure CSS change affecting only client-side presentation; the Tauri backend and read-only boundary remain unaffected.
