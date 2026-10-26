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
        uses: enthought/setup-edm-action@v3
        with:
          edm-version: 3.7.0
      - name: Install Python packages
        run: edm install -y typing
```

## Inputs

- `edm-version`: (Required)
  A string to specify the EDM version to be installed, e.g. '4.1.7'. Installers for versions listed in
  `src/cli_installers.csv` (4.0.0 and later) are verified against a SHA256
  checksum; other versions install with a warning. No macOS installers are
  published for 4.1.4 and later.
- `download-directory`: (Optional)
  A string to specify the directory for storing the downloaded installer.
  Default to `~/.cache/download`, which is within the default cache folder
  `~/.cache` EDM uses for caching packages and Python runtimes. It is
  recommended that workflows cache this folder to speed up runs.

## Outputs

There are no outputs.
