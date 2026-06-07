## 1. CSS Styling Refinements

- [x] 1.1 Add `:not(.view-2way)` prefix to normal and hover state code pane separators in src/styles.css
- [x] 1.2 Explicitly specify static background-position for hovered 2-way separators (right center for first-child, left center for last-child)
- [x] 1.3 Add 48px line-number gradient mask and position rules for center pane separator in 3-way view (normal state)
- [x] 1.4 Add hover state styling (thick wave and darker color) for center pane separator in 3-way view

## 2. Verification

- [x] 2.1 Verify that the collapsed separator waves align perfectly in 2-way view when normal
- [x] 2.2 Verify that hovering over collapsed separators in 2-way view does not cause the waves to jump or shift offset under scroll
- [x] 2.3 Verify that in 3-way view, the center pane separator masks the line-number gutter and displays the thicker/darker wave on hover
