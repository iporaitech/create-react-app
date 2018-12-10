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

This script is useful if you want to serve the bundles in development from a backend like Elixir/Phoenix, Ruby on Rails or similar, that already render html templates.

It uses the react-scripts original webpack.config.js in `development` mode but tweaks some webpack configs to have predictable bundle names and removes:

- `HotModuleReplacementPlugin` because this plugin _requires_ WebpackDevServer to work.
- `HtmlWebpackPlugin` because the idea of `build:dev` is to put the bundles in your own index.html
- `ManifestPlugin` because so far we didn't need it when working on our custom backend in development.

By default the bundles are generated into `build/dev` dir of the CRA but this can be changed with the following ENV vars

- `CRA_BUILD_OUTPUT_PATH` this variable sets the value of webpack's `output.path` and defaults to `build/dev` dir at the root of the CRA.

- `CRA_BUILD_STATIC_PREFIX` it defaults to an empty string. Set this value to `static` if you want to get file and chunk names similar to the original CRA react-scripts, i.e.: `static/js/bundles.js`

- `CRA_BUILD_PUBLIC_PATH` it sets publicPath in webpack config. It defaults to `/`.

#### Example

For a Elixir/Phoenix project you might want to use the following

```bash
$ export CRA_BUILD_OUTPUT_PATH=/your/app/priv/static
$ yarn build:dev --watch
```

And then add the script to your layout template

```html
<body>
  <!-- your body stuff here -->
  <script src="<%= static_path(@conn, "/js/bundle.js") %>"></script>
  <script src="<%= static_path(@conn, "/js/vendors~main.chunk.js") %>"></script>
  <script src="<%= static_path(@conn, "/js/main.chunk.js") %>"></script>
</body>
```
