## ADDED Requirements

### Requirement: Align Chunk Blocks and Line Code
The system SHALL render all chunk blocks, line numbers, and gutter elements with matching layout metrics and heights to prevent scrolling and connector drift.

#### Scenario: Scroll down in 2-way spacer-less view mode
- **WHEN** the user scrolls down through multiple change chunks in 2-way view mode
- **THEN** all chunk blocks in the left and right code panes align perfectly with their corresponding line numbers and SVG connector lines in the middle gutter
