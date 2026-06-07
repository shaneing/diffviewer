## Why

In the current implementation of the 2-way diff viewer's middle gutter, the connector SVG has a visual mismatch:
1. The background fill (`fillPath`) utilizes straight lines for its top boundary, whereas the top and bottom borders (`topPath` and `bottomPath`) use cubic Bezier curves. This creates an ugly, offset visual mismatch between the background fill shape and the outline.
2. The bright highlight borders (the stroke outlines on the top and bottom of the connectors) are visually distracting and redundant. Removing them provides a cleaner, more premium user interface.

This change corrects the SVG background path curves to match the top/bottom boundaries exactly and removes the highlight borders for a cleaner look.

## What Changes

- Update the path calculation logic in `src/main.tsx` (for both initial rendering and dynamic scroll syncing) to use cubic Bezier curves in the SVG connector background path (`fillPath`) to match the curves of the connector boundaries.
- Remove the top and bottom highlight border stroke paths (`topPath` and `bottomPath`) from the 2-way diff view's gutter connectors, leaving only the filled connector background.

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- `desktop-diff-viewer`: Update the 2-way diff connector UI to render correct curved background fills without highlight border strokes.

## Impact

- React components and DOM helpers inside `src/main.tsx` that calculate and manipulate SVG paths (`fillPath`, `topPath`, `bottomPath`) for gutter connectors in the 2-way diff viewer.
- The visual rendering of the middle gutter in the 2-way diff view.
