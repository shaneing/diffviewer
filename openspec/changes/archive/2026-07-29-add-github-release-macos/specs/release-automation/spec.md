## ADDED Requirements

### Requirement: Automated macOS Installer Build
The CI/CD workflow SHALL build unsigned `.dmg` and `.pkg` installer artifacts for macOS when a version release tag is pushed to GitHub.

#### Scenario: Release tag trigger
- **WHEN** a git tag matching pattern `v*` (e.g. `v0.1.0`) is pushed to the repository
- **THEN** GitHub Actions executes the release workflow on a macOS runner
- **THEN** Tauri builds unsigned `.dmg` and `.pkg` installers for the application

### Requirement: Automated GitHub Release Creation and Asset Upload
The release workflow SHALL automatically draft or publish a GitHub Release and attach the compiled `.dmg` and `.pkg` installer packages to the release.

#### Scenario: Attach installers to GitHub Release
- **WHEN** the macOS build and packaging completes successfully in GitHub Actions
- **THEN** a GitHub Release is created or updated for the corresponding release tag
- **THEN** the compiled `.dmg` and `.pkg` installer files are uploaded as release assets accessible to users

### Requirement: Manual Release Workflow Dispatch
The release workflow SHALL support manual invocation (`workflow_dispatch`) from the GitHub Actions tab.

#### Scenario: Manual trigger from GitHub UI
- **WHEN** a repository maintainer manually triggers the release workflow from GitHub Actions
- **THEN** the workflow compiles the macOS `.dmg` and `.pkg` packages and outputs release artifacts
