## Context

Currently, the diff grid layout uses `#1e1e1e` for the vertical borders between panes and gutter columns. The collapsed separators and connection waves use `#5f6164`. The difference in color and presence of internal gutter column borders creates a visual discontinuity.

## Goals / Non-Goals

**Goals:**
- Narrow the vertical borders separating the diff panes to `0.5px` and match the wave line color (`#5f6164`).
- Remove internal vertical borders of the middle gutter columns to make the middle gutter area cleaner.

**Non-Goals:**
- Modifying toolbar or sidebar background styling unrelated to the diff grid.
- Modifying how the wave lines themselves are generated or aligned.

## Decisions

### Update Border Colors and Widths in `src/styles.css`
- Change `.pane-wrapper` `border-right` to `0.5px solid #5f6164`.
- Remove the internal gutter borders by setting `border-right: none` and `border-left: none` for `.gutter-line-num.left`, `.gutter-line-num.right`, `.gutter-action-wrapper.left`, and `.gutter-action-wrapper.right`.

*Decision Rationale:* Narrowing the borders to `0.5px` matches the thin stroke design of the wavy line and results in a highly premium feel, especially on high-DPI displays. Removing internal borders in the middle gutter simplifies the layout to only display outer borders enclosing the middle gutter.

## Risks / Trade-offs

- **Risk**: High-DPI screens render `0.5px` borders beautifully, but very low resolution screens might render them faintly.
- **Mitigation**: `#5f6164` has enough contrast against `#2b2b2b` and `#313335` to remain sufficiently visible.
