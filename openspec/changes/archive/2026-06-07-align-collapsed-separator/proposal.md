## Why

The collapsed separator wavy lines in the 2-way code panes currently disconnect/misalign horizontally from the wavy lines in the middle gutter during layout rendering, panel width changes, and window resizing, causing a jarring visual seam.

## What Changes

Pin the horizontal background-position of the collapsed separator wavy lines in the Left and Right code panes in 2-way view to their respective inner pane boundaries (`right center` and `left center`) so that they meet the middle gutter SVG connector exactly in phase at the boundaries.

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- `desktop-diff-viewer`: Refine the layout alignment criteria to ensure the 2-way collapsed separator background waves align in phase with the gutter separator SVG connector.

## Impact

Modifies layout styles in `src/styles.css`. This change is purely visual and operates entirely on the frontend, fully adhering to the read-only, offline-first boundary of CodeReviwer. Out-of-scope operations include any write, commit, or push actions on the inspected repositories.
