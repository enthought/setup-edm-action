# Developing

The steps follow closely [GitHub documentation on creating a JavaScript action](https://docs.github.com/en/free-pro-team@latest/actions/creating-actions/creating-a-javascript-action)

## Setting up development environment

The requirements are:

- Git
- Node.js (version 12)

## Directory structure

Directory `src` contains the main source for the GitHub action.
Directory `dist` contains automatically compiled modules for distribution.

## Recompile the action

```
npm install
npm i -g @vercel/ncc
npm run -s build
```

You'll see changes in the `dist` directory.

## Testing the action

There is a workflow in this repository for testing the action. Open a pull
request to see it run on GitHub Actions.
