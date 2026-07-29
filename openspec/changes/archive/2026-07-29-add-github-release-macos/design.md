## Context

CodeReviwer Desktop Diff Viewer uses Tauri v2 for building desktop releases. Currently, `"bundle": { "active": false }` in `src-tauri/tauri.conf.json`, preventing automated creation of platform-native installer packages. To automate release publishing, we need to activate bundling for macOS targets (`dmg` and `pkg`) and add a GitHub Actions workflow using `tauri-apps/tauri-action@v2`.

## Goals / Non-Goals

**Goals:**
- Enable Tauri bundling for `.dmg` and `.pkg` installers.
- Create a GitHub Actions workflow `.github/workflows/release.yml` triggered on release tags (`v*`) and `workflow_dispatch`.
- Automatically compile and attach `.dmg` and `.pkg` installers to GitHub Releases.

**Non-Goals:**
- Purchasing or embedding Apple Developer ID certificates for code signing and Apple Notarization (builds will be unsigned).
- Setting up Windows (`.msi`, `.exe`) or Linux (`.AppImage`, `.deb`) release workflows in this change (can be added separately).
- Setting up Tauri auto-updater plugin server endpoints.

## Decisions

### 1. Enable Tauri Bundling for DMG and PKG
- **Choice**: Set `"active": true` and `"targets": ["dmg", "pkg"]` in `src-tauri/tauri.conf.json`.
- **Rationale**: `.dmg` is the standard desktop application distribution format for macOS, while `.pkg` provides standard installer wizard capability.

### 2. Unsigned Release Build Strategy
- **Choice**: Produce unsigned release binaries without requiring Apple Developer Certificate or Notarization secrets in GitHub Actions.
- **Rationale**: Avoids developer account subscription overhead while allowing full open source release automation.

### 3. GitHub Action Setup using `tauri-apps/tauri-action@v2`
- **Choice**: Use standard official action `tauri-apps/tauri-action@v2` running on `macos-latest`.
- **Rationale**: `tauri-action` natively handles frontend building (`npm run build:vite`), Rust target compiling (`tauri build`), and uploading output installer artifacts directly to the GitHub Release.

## Risks / Trade-offs

- **Gatekeeper Block on Unsigned macOS Apps**:
  - *Risk*: macOS Gatekeeper will show a security warning when opening unsigned `.dmg` or `.pkg` files downloaded from GitHub.
  - *Mitigation*: Document execution steps in README and release notes (`Right-click -> Open` or `xattr -cr /Applications/"CodeReviwer Diff Viewer.app"`).
