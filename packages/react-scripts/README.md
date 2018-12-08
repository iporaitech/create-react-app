# react-scripts

This package includes scripts and configuration used by [Create React App](https://github.com/facebook/create-react-app) at [Iporaitech](http://www.iporaitech.com).

The original docs can be found at:

- [Getting Started](https://facebook.github.io/create-react-app/docs/getting-started) – How to create a new app.
- [User Guide](https://facebook.github.io/create-react-app/) – How to develop apps bootstrapped with Create React App.

## Scripts added by this fork

### `build:dev`

Output bundles in Webpack development mode.

This script can be called with:

`yarn build:dev` to generate bundles once

or

`yarn build:dev --watch` to run Webpack in watch mode.

By default the bundles are generated into `build/dev` dir of the CRA but this can be changed with the following ENV vars

- `CRA_BUILD_DEV_OUTPUT_PATH` which defaults to `build`
- `CRA_BUILD_DEV_STATIC_PATH` which defaults to `dev`

The script just uses the react-scripts webpack.config.js in `development` mode but removes the `HotModuleReplacementPlugin` because this plugin _requires_ WebpackDevServer to work.

This script is useful if you want to serve the bundles in development from a backend like Elixir/Phoenix, Ruby on Rails or similar, that already render html templates.

#### Example

For a Elixir/Phoenix project you might want to use the following

```bash
$ export CRA_BUILD_DEV_OUTPUT_OUTPUT=/your/app/priv
$ export CRA_BUILD_DEV_STATIC_PATH=static
$ yarn build:dev --watch
```
