## MODIFIED Requirements

### Requirement: Align Chunk Blocks and Line Code
The system SHALL render all chunk blocks, line numbers, and gutter elements with matching layout metrics and heights to prevent scrolling and connector drift, using a compact 120px wide middle gutter layout (50px columns, 20px center connector) in 2-way view mode.

#### Scenario: Scroll down in 2-way spacer-less view mode
- **WHEN** the user scrolls down through multiple change chunks in 2-way view mode
- **THEN** all chunk blocks in the left and right code panes align perfectly with their corresponding line numbers and the 20px wide SVG connector lines in the 120px middle gutter

### Requirement: Collapsed Separator Wave Alignment
The system SHALL align the wavy lines of the collapsed separator across all panes in 1-way, 2-way, and 3-way view modes, ensuring they connect seamlessly in phase and remain aligned during horizontal scrolling, utilizing a compact 120px wide middle gutter connector in 2-way view.

#### Scenario: View collapsed separator in 2-way view
- **WHEN** a collapsed separator is rendered in 2-way view mode
- **THEN** the background wave of the left pane separator meets the left edge of the 120px middle gutter SVG connector in phase at the vertical border
- **AND** the background wave of the right pane separator meets the right edge of the 120px middle gutter SVG connector in phase at the vertical border

#### Scenario: View collapsed separator under scroll
- **WHEN** a collapsed separator is rendered and the panes are scrolled horizontally
- **THEN** the background waves of the collapsed separators remain aligned in phase across all pane boundaries and the 120px middle gutter
