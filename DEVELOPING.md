# Developing

The action is a [JavaScript action](https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action)
that uses only Node.js built-ins. It has no npm dependencies and no build
step: the runner executes `src/index.js` directly.

## Setting up development environment

The requirements are:

- Git
- Node.js (version 24)

## Directory structure

Directory `src` contains the action: `index.js` and the per-platform
install scripts it runs.

## Running the action locally

The runner passes inputs as `INPUT_<NAME>` environment variables (hyphens are
kept), so the action can be run directly, e.g. on Linux:

```
env "INPUT_EDM-VERSION=latest" "INPUT_DOWNLOAD-DIRECTORY=~/.cache/download" node src/index.js
```

## Testing the action

There is a workflow in this repository for testing the action. Open a pull
request to see it run on GitHub Actions.
