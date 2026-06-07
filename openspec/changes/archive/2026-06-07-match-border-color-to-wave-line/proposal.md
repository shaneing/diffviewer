## Why

The current vertical borders separating the diff panes and gutter columns create visual contrast against the wave lines. Narrowing the pane-middle border width to `0.5px` and matching its color to the wave line color, while removing internal middle gutter column borders entirely, will provide a clean, unified, and premium-feeling visual experience.

## What Changes

- Update the border-right of pane wrapper elements to `0.5px solid #5f6164` to match the wave line color and provide a narrower visual separator.
- Remove the internal vertical borders within the middle gutter columns (e.g. `.gutter-line-num` and `.gutter-action-wrapper` borders).

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `desktop-diff-viewer`: The pane borders must be narrowed to `0.5px` and match the wave line color (`#5f6164`), while internal middle gutter borders are removed.

## Impact

- `src/styles.css`: Modifies style rules that define the pane borders and gutter borders.
