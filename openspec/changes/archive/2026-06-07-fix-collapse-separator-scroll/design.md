## Context

The CodeReviwer Desktop Diff Viewer features a side-by-side (2-way) and 3-way layout for inspecting differences. In 3-way view mode, the left pane uses RTL layout (for scrollbar positioning) while the other panes use LTR layout. The scroll synchronization between RTL and LTR panes does not convert horizontal scroll coordinates, causing Left pane scroll-jumps on vertical scroll. Furthermore, horizontal scrolling causes the collapsed separator wavy background lines to mismatch due to shifting elements.

## Goals / Non-Goals

**Goals:**
- Implement correct RTL/LTR horizontal scroll coordinate translation in 3-way view.
- Fix Left pane scroll-jumps during vertical scrolls of LTR panes.
- Keep the repeat-x wave pattern of the collapsed separator perfectly aligned across all panes during horizontal scrolling by introducing viewport-relative background positioning via `--scroll-x`.

**Non-Goals:**
- Changing vertical scroll mechanics.
- Altering backend Rust command definitions (this fix is purely frontend/CSS).
- Introducing persistent write operations to local Git repositories.

## Decisions

### Decision 1: RTL/LTR Scroll Mapping in 3-Way Scroll Sync
- **Option A (Direct Copying)**: Directly sync `scrollLeft` values (Current implementation, causes horizontal jump and broken sync).
- **Option B (RTL/LTR Translation)**: Map coordinates using:
  - Normalized Left (RTL) offset: `leftMax + scrollLeft`
  - Normalized LTR offset: `scrollLeft`
  - Target Left (RTL) scroll: `-leftMax + normalized`
  - Target LTR scroll: `normalized`
- **Chosen Option**: **Option B**. This resolves coordinate mismatch and prevents left-pane jumping.

### Decision 2: Scroll-Compensated Separator Backgrounds
- **Option A (Sticky separation elements)**: Use sticky positioning on horizontal scroll for all views (Not viable for 1-way and 3-way because separators need to stretch across the full width of scrollable code lines).
- **Option B (CSS Custom Property for scroll offset)**: Track the distance that the left edge of scrollable content is scrolled out of view (`--scroll-x`), and adjust the background position using `left calc(0px - var(--pane-x) + var(--scroll-x)) center`.
- **Chosen Option**: **Option B**. Extremely performant, standard CSS, keeps the wave patterns visually anchored to the viewport.

## Risks / Trade-offs

- *[Risk]*: Sub-pixel discrepancies in pane size leading to minor alignment offsets.
  *Mitigation*: The formula maps layout boundaries and is rounded/clamped automatically by the browser's scrollLeft engine.
