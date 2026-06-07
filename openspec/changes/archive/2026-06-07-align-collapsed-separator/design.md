## Context

In 2-way view, the collapsed separator spans the width of each pane. The middle gutter draws the connector curves via SVGs whose starting and ending boundaries are fixed at phase 0. The left and right code panes render CSS repeating wave backgrounds. Currently, their background positions shift horizontally with the global `--pane-x` CSS custom property, causing a phase disconnect at the vertical borders.

## Goals / Non-Goals

**Goals:**
- Align the horizontal phase of the repeating wave background in the Left and Right code panes to connect seamlessly with the SVG connector wave in the middle gutter.
- Ensure the alignment remains perfect across all window sizes, pane widths, and layout configurations.

**Non-Goals:**
- Modify the SVG rendering code or path mathematics.
- Write any backend Rust code.
- Add any write or commit actions on Git repositories (fully maintaining read-only and offline boundaries).

## Decisions

- **Decision:** Set `background-position` of the Left code pane's collapsed separator to `right center` (or `100% center`), and the Right code pane's collapsed separator to `left center` (or `0% center` or `0 center`).
- **Rationale:** 
  - The middle gutter's SVG wave starts at `x = 0` (left boundary) with phase 0 (starts flat and curves downwards). Aligning the Left code pane's wave to the right edge guarantees it ends exactly at phase 0 at the right boundary.
  - The middle gutter's SVG wave ends at `x = 180` (right boundary) with phase 0. Aligning the Right code pane's wave to the left edge guarantees it starts exactly at phase 0 at the left boundary.
- **Alternatives Considered:** 
  - Dynamically computing the phase offset in JavaScript and updating a CSS variable. Rejected because it is overly complex and prone to latency/jitter during panel resizing.

## Risks / Trade-offs

- **[Risk]** The Left Pane has `direction: rtl` to move the scrollbar.
  - *Mitigation:* Because the collapsed separator has `position: sticky; right: 0; width: 100%;` in 2-way overrides, it fills the pane's viewport exactly, so pinning the background-position to the right edge (`right center`) always aligns it with the right boundary of the Left Pane regardless of `direction: rtl`.
