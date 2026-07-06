# AGENTS.md

## What this repo is

A GitHub Action (`enthought/setup-edm-action`) that installs the Enthought Deployment Manager (EDM) CLI on Linux, macOS, and Windows runners. Runtime is `node20`; entrypoint is `dist/index.js`.

## Critical: `dist/` is checked in and must be rebuilt

The `dist/` directory is **not** gitignored. GitHub Actions executes `dist/index.js` directly. Changing `src/` without rebuilding leaves CI running the old compiled code.

**Always rebuild and commit `dist/` before merging a PR.**

## Commands

```sh
# Install dependencies
npm install

# Install bundler (one-time global install)
npm i -g @vercel/ncc

# Build: bundles src/index.js → dist/index.js + copies shell/cmd scripts
npm run -s build
```

## Testing

There are no automated unit tests and no test script. Testing is done by CI (`.github/workflows/ci.yml`), which runs the action end-to-end on `ubuntu-latest`, `macos-latest`, and `windows-latest` using `edm-version: 4.1.0`, then verifies `edm versions` exits 0. CI triggers on `pull_request` and `workflow_dispatch` (can be run manually from the Actions tab without opening a PR).

## No linting or type-checking

No ESLint, Prettier, TypeScript, or pre-commit hooks are configured. No `devDependencies` in `package.json`.

## Architecture

`src/index.js` reads `edm-version` and `download-directory` inputs, then dispatches by `process.platform`:

| Platform | Script | PATH addition |
|---|---|---|
| `linux` | `src/install-edm-linux.sh` | `~/edm/bin` via `core.exportVariable` |
| `darwin` | `src/install-edm-osx.sh` | handled by macOS installer |
| `win32` | `src/install-edm-windows.cmd` | `C:\Enthought\edm` via `core.exportVariable` |

Platform scripts skip the download if the installer file already exists (cache-friendly).

## Installer URL versioning quirk

The shell/cmd scripts have version-conditional logic for constructing the installer download URL:

- `< 4.0`: Linux uses `rh6_x86_64` folder + `_linux_x86_64.sh` suffix; macOS `.pkg` has no arch suffix; Windows `_x86_64.msi`
- `= 4.0`: Linux uses `rh8_x86_64` folder + `_linux_x86_64.sh` suffix; macOS no arch suffix; Windows `_x86_64.msi`
- `> 4.0` (i.e. `>= 4.1`): Linux uses `rh8_x86_64` folder + `_rh8_x86_64.sh` suffix; macOS `_osx_x86_64.pkg`; Windows `_win_x86_64.msi`

`cli_installers.csv` is the reference table of installer URLs and SHA256 checksums. `edm_installers.py` is a helper script (not part of the action) for discovering new installer URLs when bumping supported versions.

## Key files

| File | Role |
|---|---|
| `action.yml` | Action metadata and input definitions |
| `src/index.js` | Main logic (platform dispatch) |
| `src/install-edm-linux.sh` | Linux installer |
| `src/install-edm-osx.sh` | macOS installer |
| `src/install-edm-windows.cmd` | Windows installer |
| `cli_installers.csv` | Installer URL + checksum reference |
| `edm_installers.py` | Utility to discover new installer URLs |
| `DEVELOPING.md` | Developer setup guide |
