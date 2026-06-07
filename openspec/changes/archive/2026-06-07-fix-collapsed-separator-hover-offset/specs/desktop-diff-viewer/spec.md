## MODIFIED Requirements

### Requirement: Collapsed Separator Wave Alignment
The system SHALL align the wavy lines of the collapsed separator across all panes in 1-way, 2-way, and 3-way view modes, ensuring they connect seamlessly in phase and remain aligned during horizontal scrolling, without layout offsets or jumps when hovered, utilizing a compact 120px wide middle gutter connector in 2-way view.

#### Scenario: View collapsed separator in 2-way view
- **WHEN** a collapsed separator is rendered in 2-way view mode
- **THEN** the background wave of the left pane separator meets the left edge of the 120px middle gutter SVG connector in phase at the vertical border
- **AND** the background wave of the right pane separator meets the right edge of the 120px middle gutter SVG connector in phase at the vertical border

#### Scenario: View collapsed separator under scroll
- **WHEN** a collapsed separator is rendered and the panes are scrolled horizontally
- **THEN** the background waves of the collapsed separators remain aligned in phase across all pane boundaries and the 120px middle gutter

#### Scenario: Hover collapsed separator in 2-way view under horizontal scroll
- **WHEN** a collapsed separator in 2-way view mode is hovered under horizontal scroll
- **THEN** the background waves of the separators retain their static alignment (right center for left pane, left center for right pane) and do not jump or shift position

#### Scenario: Hover collapsed separator in 3-way view
- **WHEN** a collapsed separator in 3-way view mode is hovered
- **THEN** the background waves in all three panes (including the center pane) turn thick in phase
- **AND** the center pane separator masks the 48px line-number column in both normal and hovered states
