# Desktop Diff Viewer Specification

## ADDED Requirements

### Requirement: Desktop App Foundation

The system SHALL provide a cross-platform desktop application for local development using Tauri with a React, Vite, and TypeScript frontend.

#### Scenario: Launch local desktop app

- **GIVEN** the developer has installed the project dependencies
- **WHEN** the developer runs the local desktop development command
- **THEN** the desktop application opens with the diff viewer interface

### Requirement: Folder-Based Project Opening

The system SHALL allow the user to select a local folder as the active project.

#### Scenario: Open local folder

- **GIVEN** the desktop application is running
- **WHEN** the user selects a local folder
- **THEN** the app sets that folder as the active project
- **AND** the app inspects it for Git working tree changes and merge conflict files

### Requirement: Working Tree Change Detection

The system SHALL detect Git working tree changes in the active project folder.

#### Scenario: Show changed files

- **GIVEN** the active project is a Git repository with working tree changes
- **WHEN** the app inspects the project
- **THEN** it lists modified, added, deleted, renamed, and conflicted files that are present in Git status

### Requirement: Read-Only Working Tree Diff

The system SHALL display read-only 2-way diffs for working tree changes.

#### Scenario: View modified file diff

- **GIVEN** a modified file appears in the changed file list
- **WHEN** the user selects that file
- **THEN** the app displays a 2-way diff between the Git baseline content and the working tree content
- **AND** the app does not modify the selected repository

### Requirement: Merge Conflict Detection

The system SHALL detect files that contain merge conflict markers.

#### Scenario: Show conflict file

- **GIVEN** the active project contains a file with merge conflict markers
- **WHEN** the app inspects the project
- **THEN** it identifies the file as conflicted
- **AND** it makes the file available in the changed file list

### Requirement: Read-Only Conflict Viewing

The system SHALL display read-only conflict-oriented 3-way-style diffs for merge conflict files.

#### Scenario: View conflict sections

- **GIVEN** a conflicted file appears in the changed file list
- **WHEN** the user selects that file
- **THEN** the app displays the conflict sections in a 3-way-style diff view
- **AND** the app does not provide accept, reject, resolve, edit, or commit actions

### Requirement: Offline Operation

The system SHALL run without requiring network access or remote services.

#### Scenario: Use app offline

- **GIVEN** the desktop application is installed and local dependencies are available
- **WHEN** the user opens the app without network access
- **THEN** the app can open a local folder, inspect local Git state, and display local diffs
- **AND** it does not require CDN assets, cloud services, AI services, or telemetry
