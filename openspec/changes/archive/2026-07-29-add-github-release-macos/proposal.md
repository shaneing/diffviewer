## Why

The CodeReviwer Desktop Diff Viewer app currently lacks an automated build and distribution pipeline for macOS users. Users and contributors currently have to manually clone and build the app locally using Rust and Node toolchains. Adding an automated GitHub Release workflow ensures every release tag automatically builds, packages, and attaches ready-to-use macOS installer packages (`.dmg` and `.pkg`).

## What Changes

- Update Tauri configuration (`src-tauri/tauri.conf.json`) to enable installer bundling (`"active": true`) targeting macOS Disk Images (`dmg`) and Package installers (`pkg`).
- Configure app metadata and bundle settings in `src-tauri/tauri.conf.json` (such as bundle targets and identification).
- Add GitHub Actions release workflow (`.github/workflows/release.yml`) triggered on tag pushes (`v*`) and manual workflow dispatches.
- Build unsigned macOS release artifacts (`.dmg` and `.pkg`) via `tauri-apps/tauri-action@v2` on `macos-latest` runners.
- Automatically create a GitHub Release draft or published release with attached `.dmg` and `.pkg` installers.

## Capabilities

### New Capabilities
- `release-automation`: Build and package macOS unsigned `.dmg` and `.pkg` installers automatically on GitHub tag releases and upload them as release assets.

### Modified Capabilities
*(None - existing core diff viewing capabilities remain unchanged.)*

## Impact

- **Build & CI/CD**: Adds `.github/workflows/release.yml`.
- **Tauri Configuration**: Modifies `src-tauri/tauri.conf.json` to set `"active": true` in `bundle` settings and targets `["dmg", "pkg"]`.
- **Distribution**: Enables zero-install binary distribution for macOS users.
