## About

GitHub Action to install [Enthought Deployment Manager](https://www.enthought.com/enthought-deployment-manager/) command line tool.

## Usage

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Cache EDM packages
        uses: actions/cache@v4
        with:
          path: ~/.cache
          key: ${{ runner.os }}--${{ hashFiles('requirements.txt') }}
      - name: Setup EDM
        uses: enthought/setup-edm-action@v4
        with:
          edm-version: latest
      - name: Install Python packages
        run: edm install -y typing
```

## Inputs

- `edm-version`: (Required)
  A string to specify the EDM version to be installed, e.g. '4.1.7', or
  `latest` to install the newest version that has an installer for the
  runner's platform (currently 4.1.7 on Linux and Windows and 4.1.3 on macOS,
  as no macOS installers are published for 4.1.4 and later). `latest` is
  resolved from `src/cli_installers.csv`, so it advances when that table is
  updated for a new EDM release. Installers for versions listed in the table
  (4.0.0 and later) are verified against a SHA256 checksum; other versions
  install with a warning.
- `download-directory`: (Optional)
  A string to specify the directory for storing the downloaded installer.
  Default to `~/.cache/download`, which is within the default cache folder
  `~/.cache` EDM uses for caching packages and Python runtimes. It is
  recommended that workflows cache this folder to speed up runs.

## Outputs

There are no outputs.
