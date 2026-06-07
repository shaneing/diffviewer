## ADDED Requirements

### Requirement: Curved Gutter Connector without Highlights
The system SHALL render SVG connectors in the 2-way middle gutter with a curved background fill matching the top and bottom Bezier boundaries exactly, and SHALL NOT render highlight border strokes on those boundaries.

#### Scenario: View 2-way diff connector UI
- **WHEN** the user views the 2-way diff mode for a modified file
- **THEN** the middle gutter displays curved change connectors where the filled background matches the top/bottom Bezier boundary curves exactly
- **AND** the connector does not display any highlight border strokes
