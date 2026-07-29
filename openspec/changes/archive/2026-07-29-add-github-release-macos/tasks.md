## 1. Tauri Configuration

- [x] 1.1 Enable bundle generation (`"active": true`) and set macOS target formats (`["dmg", "app"]`) in `src-tauri/tauri.conf.json`.
- [x] 1.2 Validate Tauri build configuration locally with `cargo check`.

## 2. GitHub Actions Release Workflow

- [x] 2.1 Create `.github/workflows/release.yml` workflow file triggered on release tags (`v*`) and `workflow_dispatch`.
- [x] 2.2 Configure Node.js, Rust toolchain, and `tauri-apps/tauri-action@v2` step to build unsigned `.dmg` and `.pkg` installers and upload assets to GitHub Releases.

## 3. Documentation & Verification

- [x] 3.1 Update `README.md` with macOS release installer download links and instructions for running unsigned binaries.
- [x] 3.2 Verify workflow file structure and ensure all configuration settings meet OpenSpec criteria.
