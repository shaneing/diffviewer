## Why

In the desktop-diff-viewer, horizontal scroll synchronization is broken in 3-way view due to a lack of RTL/LTR scroll coordinate conversion. This causes the left pane (Ours) to jump horizontally to the far right on any vertical scroll in the other panes. Additionally, horizontal scrolling shifts the collapsed separator wavy lines, causing them to misalign and disconnect from the middle gutter and adjacent panes.

## What Changes

- Modify `handleScroll` to perform correct RTL/LTR conversion for 3-way horizontal scroll synchronization.
- Introduce a `--scroll-x` CSS custom property to track horizontal scroll offsets on all code panes.
- Update `.collapsed-separator` styling in `src/styles.css` to offset the background wave pattern using `--scroll-x`, keeping it anchored to the viewport.

## Capabilities

### New Capabilities

### Modified Capabilities

- `desktop-diff-viewer`: Align the collapsed separator wave lines during horizontal scrolling, and correct horizontal scroll synchronization across RTL/LTR panes in 3-way view.

## Impact

- `src/main.tsx` (scroll handler and offset initialization)
- `src/styles.css` (wavy line background positioning)
- Out-of-Scope: All actions remain completely read-only and offline-first. Out-of-scope operations include write, commit, push, or modifying repositories on disk.
