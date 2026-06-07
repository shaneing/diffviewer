## Context

In the current implementation of the diff viewer interface, vertical alignment discrepancies exist between the code block text and the gutter line numbers. The line number container has a defined font size of 12px but lacks an explicit `line-height` and a monospace font-family (in 1-way/3-way views), while the code text has a font size of 13px without a specified `line-height`. These missing attributes cause browsers to calculate differing vertical alignments, leading to layout misalignment between code lines and their corresponding line numbers.

## Goals / Non-Goals

**Goals:**
- Unify styling and metrics (font family, line-height) of all line-number and code text elements to achieve pixel-perfect vertical alignment.
- Keep CSS overrides minimal and localized.

**Non-Goals:**
- Modifying the sync scroll mechanics or the layout structure.
- Altering the Rust-backend command definitions or file system operations (the strictly read-only boundary is maintained).

## Decisions

### 1. Apply Monospace Font Family to `.line-num`
- **Choice**: Add `font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;` to the `.line-num` class.
- **Rationale**: Since `.gutter-line-num` and `.line-code` already use this monospace font stack, `.line-num` must use the same to ensure identical vertical font metrics.

### 2. Set Explicit `line-height` on Text Elements
- **Choice**: Apply `line-height: 20px;` to `.line-code`, `.line-num`, and `.gutter-line-num`.
- **Rationale**: The line rows are defined as `height: 20px`. Giving the text elements a line height equal to the row height forces the browser to vertically center the text characters perfectly, preventing default browser font-metrics from shifting the baseline.
- **Alternative Considered**: Relying purely on Flexbox `align-items: center`. This is insufficient because the layout separates line numbers and code text into different scrollable panels in the 2-way view, so they do not share a single Flexbox row container to establish a common baseline alignment.

### 3. Center Gutter Line Numbers
- **Choice**: Set `.gutter-line-num` to `display: inline-flex; align-items: center; justify-content: center;` and remove left/right horizontal text-align alignment.
- **Rationale**: Ensures the line numbers are horizontally and vertically centered within their 40px width container.


## Risks / Trade-offs

- **[Risk]**: Differing font sizes (12px for numbers vs 13px for code) causing minor visual offsets.
- **[Mitigation]**: An explicit `line-height: 20px` forces vertical centering on the same vertical midpoint (10px) regardless of font size, guaranteeing alignment.
