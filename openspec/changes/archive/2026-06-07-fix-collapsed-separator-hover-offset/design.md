## Context

The collapsed separator wave alignment works by dynamically setting background positions on code pane separators in 1-way/3-way views to align with horizontal scrolls. However, in 2-way views, the separators are statically positioned relative to the 120px wide middle gutter using `right center` and `left center` positioning. The hover selector `.pane-wrapper:first-child .collapsed-separator.hovered` matches elements in both 2-way and 1-way/3-way views, which leaks the dynamic scroll-offset position onto 2-way separators, causing them to jump/offset on hover. Furthermore, the 3-way view's center pane separator has no hover styling and lacks the 48px line-number column background mask.

## Goals / Non-Goals

**Goals:**
- Isolate the 1-way/3-way CSS rules for `.collapsed-separator` using `:not(.view-2way)` so they do not affect 2-way layout elements.
- Keep the static positioning (`right center`/`left center`) for 2-way hovered separators.
- Mask the 48px line-number column in the 3-way center pane separator.
- Synchronize hover thickening for the center pane separator in 3-way view.

**Non-Goals:**
- Modifying React code or JS layout logics (this is a CSS-only visual fix).
- Adding edit/write operations (remains read-only and offline-first).

## Decisions

### 1. Isolate 1-way/3-way rules using `:not(.view-2way)`
- **Decision**: Prefix the 1-way/3-way normal and hover separator selectors with `:not(.view-2way)`.
- **Rationale**: This prevents selectors like `.pane-wrapper:first-child .collapsed-separator.hovered` from matching elements in 2-way view mode, ensuring their styling stays completely separate.
- **Alternatives Considered**: Add explicit classes (like `.view-1way`, `.view-3way`) to the layout. We rejected this because it requires modifying React markup, whereas a CSS-only change is safer and more self-contained.

### 2. Explicitly specify background position on 2-way hover rules
- **Decision**: Add `background-position: right center;` and `background-position: left center;` to the 2-way hovered separator styles.
- **Rationale**: Prevents accidental inheritance of fallback background positions when the hovered class is added.
- **Alternatives Considered**: None.

### 3. Add rules for 3-way center pane separator
- **Decision**: Add selectors for `:not(.view-2way) .pane-wrapper:not(:first-child):not(:last-child) .collapsed-separator` to apply the 48px line-number gradient mask and hover effects to the center pane in 3-way view.
- **Rationale**: Since the center pane in 3-way view has line numbers, its separator must also mask the line-number gutter area and display the bold wave on hover for visual symmetry.

## Risks / Trade-offs

- **Risk**: Future layout changes or new view modes might conflict with `:not(.view-2way)`.
- **Mitigation**: The design relies on the fact that any view mode *other* than 2-way has line-number columns on the left of each code pane. This is a robust layout assumption.
