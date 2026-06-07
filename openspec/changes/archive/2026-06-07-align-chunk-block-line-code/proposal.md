## Why

In the 2-way spacer-less diff viewer mode, as the user scrolls, chunk blocks drift out of vertical alignment with code lines. This misalignment occurs due to layout and height discrepancies (such as bottom borders on chunk blocks) that accumulate scroll offsets.

## What Changes

- Modify styling for `.chunk-block` to set `border-bottom: none`, removing the transparent 1px bottom border that causes cumulative layout drift.
- Ensure chunk heights are calculated and rendered consistently with line height expectations across code panes and middle gutters.
- The application remains fully offline and read-only. Modifying files, staging, committing, or pushing git changes remains completely out of scope.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `desktop-diff-viewer`: Align chunk blocks vertically with line code elements to prevent vertical scroll and connector drift.

## Impact

- **Affected Files**: `src/styles.css` containing the layout styles.
- **Dependencies**: No new npm packages or Rust dependencies are added.
- **System Boundaries**: This is a pure client-side CSS presentation change. The Tauri backend and read-only boundaries remain unaffected.
