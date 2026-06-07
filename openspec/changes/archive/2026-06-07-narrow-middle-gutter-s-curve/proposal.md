## Why

In the 2-way diff view, the middle gutter is too wide (180px) and the center spacer space (60px) creates an overly sparse connection gap, which deviates from the compact, high-density layout of modern editors (e.g., JetBrains IDEs). We need to narrow the middle gutter to 120px to improve visual consistency and layout density, while maintaining seamless alignment of the left and right collapsed separator wave lines during scrolling.

## What Changes

- Narrow the middle gutter in 2-way view from 180px to 120px.
- Reduce left and right middle-gutter column widths to 50px each, and the center spacer/SVG connector width to 20px.
- Adjust the line-number gutter width in the middle columns to 32px and the action buttons container to 18px.
- Update the SVG connector coordinate path in `getSeparatorCoords` to scale the Bezier curve and wave lines to the new 120px boundaries.

## Capabilities

### New Capabilities

### Modified Capabilities

- `desktop-diff-viewer`: Adjust the middle gutter layout metrics and SVG coordinate mapping in 2-way view to support a compact 120px width (50px columns, 20px center transition spacer), ensuring the left and right collapsed separator wave lines remain aligned during vertical scroll.

## Impact

- `src/main.tsx` (SVG connector coordinates and render layout of middle gutter columns)
- `src/styles.css` (middle gutter widths and layout metrics)
- Out-of-Scope: The application remains strictly read-only and offline-first; no git writing, commits, or push actions are introduced.
