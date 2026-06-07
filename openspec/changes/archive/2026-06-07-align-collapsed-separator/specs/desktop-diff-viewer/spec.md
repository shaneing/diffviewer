## ADDED Requirements

### Requirement: Collapsed Separator Wave Alignment
The system SHALL align the wavy lines of the collapsed separator in the left and right code panes with the wavy lines in the middle gutter in 2-way view mode, ensuring they connect seamlessly in phase at the pane boundaries.

#### Scenario: View collapsed separator in 2-way view
- **WHEN** a collapsed separator is rendered in 2-way view mode
- **THEN** the background wave of the left pane separator meets the left edge of the middle gutter SVG connector in phase at the vertical border
- **AND** the background wave of the right pane separator meets the right edge of the middle gutter SVG connector in phase at the vertical border
