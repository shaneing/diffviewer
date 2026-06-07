## ADDED Requirements

### Requirement: Align Code Lines and Gutter Numbers
The system SHALL display line numbers and code text with matching font family, matching line heights, and perfect vertical alignment across all panes and gutters in 1-way, 2-way, and 3-way views.

#### Scenario: Verify monospace styling and vertical alignment of line numbers
- **WHEN** the user selects any file and views the diff
- **THEN** all line numbers in the gutter are styled using a monospace font family
- **AND** the line numbers align perfectly with the corresponding code lines on the same vertical baseline
- **AND** the gutter line numbers are horizontally centered within their column width
