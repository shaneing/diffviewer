## Context

In the 2-way diff view of CodeReviwer, the middle gutter serves to connect changes between the Left and Right panes while displaying line numbers and action buttons. Currently, the middle gutter is 180px wide with a 60px center spacer containing an SVG connector. The user requested reducing the center width to make the layout more compact (modeled on the JetBrains diff viewer) while maintaining the S-curve connection and alignment of the Left/Right pane collapsed separator wave lines.

## Goals / Non-Goals

**Goals:**
- Reduce the overall 2-way view middle gutter width from 180px to 120px.
- Adjust left/right column widths to 50px each, and the center SVG connector area to 20px.
- Reposition all middle gutter columns and update SVG paths in `src/main.tsx` using these new dimensions.
- Modify CSS classes in `src/styles.css` to align with the new 120px gutter layout.
- Update the SVG separator path mathematical coordinates to draw a compact S-curve (starting at 48px and ending at 72px) that seamlessly joins the left and right waves.

**Non-Goals:**
- Altering the 3-way view layout or pane sizing.
- Implementing any write actions back to Git repositories on disk (remaining completely read-only).
- Modifying Tauri backend command interfaces (this is a pure React and CSS layout change).

## Decisions

### Decision 1: Gutter Sizing Strategy
- **Option A (Dynamic Percentage-based Gutter)**: Dynamically scale columns and SVG path connector relative to viewport width. (Rejected: line numbers and action buttons require fixed pixel widths to prevent text clipping and alignment jitter).
- **Option B (Fixed 120px Compact Gutter)**: Use a fixed 120px total width (`flex: 0 0 120px`) with fixed sub-column divisions: 50px left, 20px center, 50px right. (Chosen: extremely stable, matches default styling patterns, and guarantees pixel-perfect Bezier curves).

### Decision 2: Wave Phase Alignment for Compact Path
- **Decision**: Define the Left waves from 0 to 48px (exactly three 16px wave periods), start the Bezier S-curve transition from 48px to 72px (a 24px transition width spanning the center spacer), and draw the Right waves from 72px to 120px.
- **Rationale**: Since the background wave patterns on the left and right panes are aligned to the borders in phase 0, drawing exactly three full wave periods on the left (48px) and three on the right (ending at 120px) ensures that the SVG path matches the repeating wave patterns of the left and right pane backgrounds exactly at the gutter boundaries, preventing phase shifts or seams during scrolling.

## Risks / Trade-offs

- **[Risk]**: The 50px columns (32px line-number + 18px action wrapper) might clip 4+ digit line numbers.
  - *Mitigation*: 32px is wide enough for up to 999 lines (3 digits) in 12px JetBrains Mono. For files exceeding 1000 lines, the font size or padding will gracefully scale, or line numbers will slightly overlap with action wrappers without breaking functionality. This is a standard layout trade-off for compact diff views.
