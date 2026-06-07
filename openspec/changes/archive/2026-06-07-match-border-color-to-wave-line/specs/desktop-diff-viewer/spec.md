## ADDED Requirements

### Requirement: Border and Wave Line Color Matching
The system SHALL render the outer vertical borders of the middle pane/gutter with a narrow width of `0.5px` and the same color as the wave line (`#5f6164`) to ensure a unified and integrated layout appearance, and SHALL NOT render internal vertical border lines within the middle gutter columns.

#### Scenario: View matched border colors
- WHEN the user views the diff grid in 2-way or 3-way view mode
- THEN the pane wrapper borders use the wave line color `#5f6164` and a width of `0.5px`
- AND the internal gutter line number borders and gutter action wrapper borders are not rendered (removed)
