## Context

In the diff viewer, vertical alignment of chunk blocks and code lines drifts as the user scrolls in 2-way mode. In the CSS structure, `.chunk-block` is defined with a `border-bottom: 1px solid transparent;`. Since `box-sizing: border-box` is set globally, a chunk-block with an inline style height (like the middle gutter) has a total height exactly matching the calculated height, but chunk-blocks in the left and right panes (which lack inline heights) default to their contents' height plus the bottom border, causing them to be `1px` taller per chunk. This cumulative layout discrepancy offsets scrolling sync and connector positioning.

## Goals / Non-Goals

**Goals:**
- Resolve vertical layout and scrolling sync drift by ensuring all chunk blocks have heights that align perfectly with their line-based metrics.
- Maintain minimal and localized CSS adjustments.

**Non-Goals:**
- Modify the piece-wise linear scrolling algorithm or height calculation logic in JS.
- Modify Tauri API interactions, Rust code, or any read-write boundaries (always remaining read-only and offline-first).

## Decisions

### 1. Set `border-bottom: none` on `.chunk-block`
- **Choice**: Remove or set `border-bottom: none` on `.chunk-block`.
- **Rationale**: Since the bottom border was defined as `transparent` and has no visual styling/overrides elsewhere in the application, setting it to `none` eliminates the `1px` cumulative height discrepancy. This ensures that the DOM height of every chunk-block in every pane is exactly `N * 20px` (where `N` is the number of lines/spacers inside), matching the JS layout calculations and scroll maps.

## Risks / Trade-offs

- **[Risk]** Loss of visual separation between chunks.
- **[Mitigation]** The border was `transparent` and thus invisible anyway. Removing it has no visible stylistic impact while restoring perfect pixel alignment.
