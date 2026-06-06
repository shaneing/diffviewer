# CodeReviwer Diff Viewer

A high-performance, offline-first desktop application for inspecting Git working tree changes and resolving merge conflicts. Inspired by the JetBrains style diff viewer, CodeReviwer is built using **Tauri v2**, **React**, **TypeScript**, and **Rust**.

---

## Key Features

- **📂 Folder Inspection**: Instantly pick any local folder to scan its Git working tree.
- **🌳 Git-Aware File Tree**: Displays all added, modified, renamed, deleted, or conflicted files with clear Git status indicators.
- **⚖️ Side-by-Side 2-Way Diff**: Visually compare your working tree changes side-by-side with the `HEAD` baseline version. Includes synchronized scrolling.
- **⚡ 3-Way Conflict Resolver**: Detects Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and renders a three-pane layout (Base, Ours, and Theirs) for clear conflict review.
- **🔒 Read-Only & Secure**: Runs completely offline, reading only local Git status and repository files, keeping your codebase secure.

---

## Tech Stack

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Desktop Shell**: [Tauri v2](https://v2.tauri.app/)
- **Styling**: Vanilla CSS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend / OS Integration**: [Rust](https://www.rust-lang.org/)

---

## Prerequisites

To run and build this application, you will need the following tools installed on your system:

1. **Node.js** (v18 or higher recommended) and **npm**
2. **Rust** toolchain (installed via `rustup`)
3. Tauri development dependencies for your operating system (refer to the [Tauri Getting Started Guide](https://v2.tauri.app/start/prerequisites/) if needed).

---

## Getting Started

### 1. Install Dependencies
Navigate to the project directory and install the Node package dependencies:
```bash
npm install
```

### 2. Run in Development Mode
To start the Tauri application with hot-reloading for the frontend and automatic Rust rebuilding:
```bash
npm run dev
```

> [!TIP]
> If you only want to work on or preview the React frontend in the browser without Tauri's OS APIs, run:
> ```bash
> npm run dev:vite
> ```
> This starts the dev server at `http://127.0.0.1:1420`. Note that actions invoking native dialogs or running shell git commands (such as directory picking or file diff loading) will require Tauri to function.

### 3. Build for Production
To bundle the application into a optimized, standalone native desktop executable:
```bash
npm run build
```
This compile the Rust code and packages the application. The final bundle will be generated under the `src-tauri/target/release/` directory.

---

## Available Scripts

Here is a summary of scripts defined in `package.json`:

| Script | Command | Purpose |
|:---|:---|:---|
| `npm run dev` | `tauri dev` | Runs the desktop app in development mode |
| `npm run dev:vite` | `vite --host 127.0.0.1 --port 1420` | Runs the Vite frontend only in web browser |
| `npm run build` | `tauri build` | Builds native installers/executables |
| `npm run build:vite` | `tsc && vite build` | Typechecks and builds static assets for web |
| `npm run preview` | `vite preview` | Previews the built frontend production files |
| `npm run typecheck` | `tsc --noEmit` | Performs TypeScript static type checking |

---

## Directory Structure

```
├── .agent/                 # Agent workflows and configurations
├── src/                    # Frontend source code
│   ├── main.tsx            # App core state, UI layout, diff calculations, & rendering
│   └── styles.css          # App styling and custom design tokens
├── src-tauri/              # Tauri backend source code
│   ├── src/
│   │   ├── main.rs         # Entry point for Tauri application
│   │   └── lib.rs          # Git parsing, diff logic, & Tauri command handlers
│   ├── capabilities/       # Tauri security capability configurations
│   ├── tauri.conf.json     # Main Tauri configurations (bundle, windows, etc.)
│   └── Cargo.toml          # Rust dependency manifest
├── index.html              # Frontend entry HTML
├── vite.config.ts          # Vite bundler configurations
└── tsconfig.json           # TypeScript configuration
```
