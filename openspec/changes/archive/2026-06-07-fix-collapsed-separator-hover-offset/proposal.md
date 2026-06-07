## Why

In the 2-way diff view, hovering over a collapsed separator under horizontal scroll causes the wavy line to shift position (jump) because the hover rules for 1-way/3-way views leak and apply scroll offsets to the statically-positioned 2-way separators. In 3-way view, the center (Base) pane separator fails to mask the 48px line-number column and does not render the thicker hovered wave, creating visual inconsistencies.

## What Changes

- Scope 1-way and 3-way hover alignment rules to non-2-way view modes so they do not leak into 2-way views.
- Ensure 2-way view separators retain their static alignment (`right center` for left pane, `left center` for right pane) when hovered.
- Apply the 48px line-number background mask and hover styling (thick wave and darker color) to the center pane separator in 3-way view.

## Capabilities

### New Capabilities

*(None)*

### Modified Capabilities

- `desktop-diff-viewer`: Update layout and hover specs for collapsed separators in both 2-way and 3-way views to ensure proper visual alignment and behavior.

## Impact

- `src/styles.css`: CSS styling for collapsed separators and their hover states.
- Out of scope: No write, commit, push, or backend alterations are introduced; this remains purely a client-side, read-only visual fix.
