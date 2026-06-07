## ADDED Requirements

### Requirement: 3-Way Horizontal Scroll Sync
The system SHALL synchronize horizontal scrolling between the RTL Left pane and the LTR Middle and Right panes in 3-way view mode by translating scrollLeft coordinates.

#### Scenario: Horizontal scroll in 3-way view
- **WHEN** the user scrolls the Left pane horizontally
- **THEN** the Center and Right panes scroll horizontally to the same normalized horizontal position
- **AND** the Left pane does not scroll horizontally when LTR panes are scrolled only vertically

## MODIFIED Requirements

### Requirement: Collapsed Separator Wave Alignment
The system SHALL align the wavy lines of the collapsed separator across all panes in 1-way, 2-way, and 3-way view modes, ensuring they connect seamlessly in phase and remain aligned during horizontal scrolling.

#### Scenario: View collapsed separator under scroll
- **WHEN** a collapsed separator is rendered and the panes are scrolled horizontally
- **THEN** the background waves of the collapsed separators remain aligned in phase across all pane boundaries and middle gutters
