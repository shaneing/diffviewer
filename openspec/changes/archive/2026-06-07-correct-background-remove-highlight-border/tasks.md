## 1. Implement SVG Connector Path Changes

- [x] 1.1 Update `fillPath` rendering calculation in `src/main.tsx` to use Bezier curves for the top edge.
- [x] 1.2 Update `fillPath` scroll sync direct DOM updates in `src/main.tsx` to use the matching Bezier curve calculation.
- [x] 1.3 Remove top and bottom highlight border path elements from the JSX template in `src/main.tsx`.
- [x] 1.4 Remove direct DOM updates of top and bottom highlight border path elements in `src/main.tsx` scroll-sync handlers.

## 2. Verification

- [x] 2.1 Start the development server and verify the layout and scroll sync of 2-way diff connectors.
- [x] 2.2 Verify that the background fill curve aligns perfectly with the boundaries and has no visual gap or offset.
- [x] 2.3 Verify that the highlight border strokes (top and bottom lines) are no longer rendered.
