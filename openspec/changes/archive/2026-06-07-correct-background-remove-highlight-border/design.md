## Context

In the 2-way diff viewer, change blocks on the left and right are connected by SVG paths drawn in the middle gutter. Currently, the visual presentation of these connectors has two issues:
1. Mismatched shapes: The connector background polygon (`fillPath`) utilizes straight lines for the top edge, whereas the boundary strokes (`topPath` and `bottomPath`) use cubic Bezier curves. This causes the colored background to visually misalign with the border lines.
2. visually distracting highlights: The top and bottom boundaries of the connector are rendered with bright highlight strokes, which creates a cluttered design.

## Goals / Non-Goals

**Goals:**
- Correct the SVG `fillPath` calculation to use the same Bezier curves as the top and bottom boundaries, making the background shape align perfectly.
- Remove the highlight stroke paths from the connector SVG elements in the 2-way diff view.

**Non-Goals:**
- Altering the connector color scheme, widths, or layout dimensions.
- Changing scroll syncing mechanisms or performance characteristics.

## Decisions

### 1. Update `fillPath` to use Bezier curves
- **Choice**: Replace the straight-line segment `L ${svgWidth} ${rightTopLocal}` in `fillPath` with a cubic Bezier curve that matches the top boundary curve exactly: `C ${svgWidth / 2} 0, ${svgWidth / 2} ${rightTopLocal}, ${svgWidth} ${rightTopLocal}`.
- **Rationale**: This guarantees that the background fill conforms to the curved boundary design instead of displaying straight edges that clip or leave gaps.

### 2. Remove highlight border paths
- **Choice**: Remove `<path className="top-path">` and `<path className="bottom-path">` from the `<svg className="gutter-svg-connector">` element in `src/main.tsx` and clean up the scroll sync DOM updates that query these paths.
- **Rationale**: Completely removing these paths from the JSX and scroll update logic reduces DOM node count and avoids unnecessary element selection/rendering overhead.

## Risks / Trade-offs

- **[Risk]**: Mismatch during scrolls if update logic isn't fully cleaned up.
- **[Mitigation]**: Ensure both the JSX rendering logic and the direct DOM updater in the `scroll` event handler are updated in sync to construct the new `fillPath`.
