# AGENTS.md

## What this repo is

A GitHub Action (`enthought/setup-edm-action`) that installs the Enthought Deployment Manager (EDM) CLI on Linux, macOS, and Windows runners. Runtime is `node24`; the runner executes `src/index.js` directly (`runs.main` in `action.yml`).

## Zero dependencies: no build step

The action uses only Node.js built-ins, so there is no `dist/`, `node_modules`, or bundler, and an edit to `src/` is live as soon as it is committed. Keep it that way: an npm dependency would force bundling (ncc/rollup) and a checked-in `dist/` again. Instead of `@actions/core`/`@actions/exec`, `src/index.js` has small helpers over the runner's documented interface (`INPUT_*` env vars, `::warning::`/`::error::` commands, the `GITHUB_PATH` file); extend those.

Gotchas the helpers encode:

- Input env var names keep hyphens: `edm-version` is `INPUT_EDM-VERSION`.
- The runner does not enforce `required: true`; `getInput` fails on an empty value.

## Testing

There are no automated unit tests and no test script. Testing is done by CI (`.github/workflows/ci.yml`), which runs the action end-to-end on `ubuntu-latest`, `macos-latest`, and `windows-latest` using `edm-version: latest`, then verifies `edm versions` exits 0. CI triggers on `pull_request` and `workflow_dispatch` (can be run manually from the Actions tab without opening a PR).

## No linting or type-checking

No ESLint, Prettier, TypeScript, or pre-commit hooks are configured.

## Architecture

`src/index.js` reads `edm-version` and `download-directory` inputs, then dispatches by `process.platform`:

| Platform | Script | PATH addition |
|---|---|---|
| `linux` | `src/install-edm-linux.sh` | `~/edm/bin` via `GITHUB_PATH` |
| `darwin` | `src/install-edm-osx.sh` | handled by macOS installer |
| `win32` | `src/install-edm-windows.cmd` | `C:\Enthought\edm` via `GITHUB_PATH` |

Platform scripts skip the download if the installer file already exists (cache-friendly).

## Installer URL versioning quirk

The shell/cmd scripts have version-conditional logic for constructing the installer download URL:

- `< 4.0`: Linux uses `rh6_x86_64` folder + `_linux_x86_64.sh` suffix; macOS `.pkg` has no arch suffix; Windows `_x86_64.msi`
- `= 4.0`: Linux uses `rh8_x86_64` folder + `_linux_x86_64.sh` suffix; macOS no arch suffix; Windows `_x86_64.msi`
- `> 4.0` (i.e. `>= 4.1`): Linux uses `rh8_x86_64` folder + `_rh8_x86_64.sh` suffix; macOS `osx_<arch>` folder + `_osx_<arch>.pkg` (`arch` is `arm64` on Apple silicon, else `x86_64`; chosen in `src/index.js`, which passes `arm64`/`x86_64` to the script); Windows `_win_x86_64.msi`

`src/cli_installers.csv` (`version,platform,url,sha256`) holds the expected SHA256 of each supported installer. `src/index.js` looks up the checksum for the requested version and passes it to the platform script, which verifies the installer (including a cached one) and fails on a mismatch. Versions not listed only produce a warning and are installed unverified. `edm-version: latest` is resolved in `src/index.js` to the highest version in the CSV that has a row for the runner's platform (`osx-arm64` on Apple silicon), so adding rows for a new release is what makes it the new `latest`.

### Adding a new EDM version

1. Get the digests from the release assets: `gh release view vX.Y.Z -R enthought/edm --json assets -q '.assets[]|select(.name|test("^edm_cli_.*\\.(sh|pkg|msi)$"))|.name+" "+.digest'`. Releases before 4.1.2 have no digests; download the installer from `package-data.enthought.com` and run `sha256sum` on it.
2. Add one row per platform to `src/cli_installers.csv` (platforms: `linux-x86_64`, `osx-x86_64`, `osx-arm64`, `win-x86_64`). No macOS installers are published for 4.1.4 and later.

## Key files

| File | Role |
|---|---|
| `action.yml` | Action metadata and input definitions |
| `src/index.js` | Main logic (platform dispatch) |
| `src/install-edm-linux.sh` | Linux installer |
| `src/install-edm-osx.sh` | macOS installer |
| `src/install-edm-windows.cmd` | Windows installer |
| `src/cli_installers.csv` | Installer URL + expected SHA256 per version/platform |
| `DEVELOPING.md` | Developer setup guide |
