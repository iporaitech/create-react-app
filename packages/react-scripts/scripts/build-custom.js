// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Iporaitech, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end
'use strict';

// Process CLI arguments
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;
const watch = argv.indexOf('--watch') !== -1;
const mode = argv[0];

if (mode !== 'development' && mode !== 'production') {
  throw `
    Invalid environment name passed to build-custom: ${argv[0]}\n
    Mode should be the first arg build-custom.js
  `;
}

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = mode;
process.env.NODE_ENV = mode;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

// @remove-on-eject-begin
// Do the preflight checks (only happens before eject).
const verifyPackageTree = require('./utils/verifyPackageTree');
if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');
verifyTypeScriptSetup();
// @remove-on-eject-end

const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const webpack = require('webpack');
const bfj = require('bfj');
const configFactory = require('../config/webpack.config');
const paths = require('../config/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printBuildError = require('react-dev-utils/printBuildError');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appIndexJs])) {
  process.exit(1);
}

// Get default CRA config
const config = configFactory(mode);

////
// Override some stuff from default CRA webpack config.
// NOTICE that in this script we don't use the prefix static/ hardcoded
// in the original webpack.config
//

config.output.path =
  process.env.CRA_BUILD_OUTPUT_PATH || path.resolve(paths.appBuild, mode);
config.output.publicPath = process.env.CRA_BUILD_PUBLIC_PATH || '/';

// Don't include hash in filename even in production.
// Assets manifest should be handled by the backend API. i.e.: `mix phx.digest`
config.output.filename = 'js/bundle.js';

// Use contenthash in chunFilename in production to support code-splitting
config.output.chunkFilename =
  mode === 'production'
    ? 'js/[name].[contenthash:8].chunk.js'
    : 'js/[name].chunk.js';

// Just index. We're not using WebpackDevServer
config.entry = paths.appIndexJs;

// If name is false, as it's in original react-scripts, it generates a
// name that changes on each recompile, when true, generates the name
// vendor~main.chunk.js and thus, we can put it in script tags in
// another index.html
config.optimization.splitChunks = {
  chunks: 'all',
  name: true,
};

// Override hardcoded static prefix in url-loader and file-loader
// These are themselves under oneOf rule
const oneOfRuleIndex = config.module.rules.findIndex(r => !!r.oneOf);
config.module.rules[oneOfRuleIndex].oneOf = config.module.rules[
  oneOfRuleIndex
].oneOf.map(r => {
  if (
    r.loader &&
    (r.loader.indexOf('url-loader') > -1 ||
      r.loader.indexOf('file-loader') > -1)
  ) {
    return {
      ...r,
      options: {
        ...r.options,
        name: 'media/[name].[hash:8].[ext]',
      },
    };
  }

  return r;
});

// Remove hardcoded static prefix and contenthas from MiniCssSExtractPlugin
// This plugin is used only in production
if (mode === 'production') {
  const miniCssPluginIndex = config.plugins.findIndex(
    p => p.constructor.name === 'MiniCssExtractPlugin'
  );

  config.plugins[miniCssPluginIndex] = new MiniCssExtractPlugin({
    filename: 'css/[name].css',
    chunkFilename: 'css/[name].[contenthash:8].chunk.css',
  });
}

// Remove HotModuleReplacementPlugin because we're not using
// the bundle in webpack-dev-server or something alike
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'HotModuleReplacementPlugin'
);

// Don't generate index.html
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'HtmlWebpackPlugin'
);

// Don't generate a cache manifest. Leave this to task to the
// servers these assets are going to be served from, such as
// `mix phx.digest`, `bin/rake assets:precompile`, etc
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'ManifestPlugin'
);

// Avoid using contenthash in chunkFilename of initial chunks.
// See https://github.com/webpack/webpack/issues/6598
// Without this we need to update the index.html for each new build
class ChunkNamesPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('ChunkNamesPlugin', compilation => {
      compilation.chunkTemplate.hooks.renderManifest.intercept({
        register(tapInfo) {
          if (tapInfo.name === 'JavascriptModulesPlugin') {
            const originalFn = tapInfo.fn;

            tapInfo.fn = (result, options) => {
              const chunkName = options.chunk.name;

              // Don't mutation options passed to other plugins
              let customOpts = { ...options };

              if (chunkName === 'main' || chunkName === 'vendors~main') {
                customOpts.outputOptions = {
                  ...options.outputOptions,
                  chunkFilename: 'js/[name].chunk.js',
                };

                const hasCss =
                  result[0] &&
                  result[0].identifier.startsWith('mini-css-extract-plugin');

                if (hasCss) {
                  result[0].filenameTemplate = 'css/[name].chunk.css';
                }
              }

              originalFn(result, customOpts);
            };
          }

          return tapInfo;
        },
      });
    });
  }
}
config.plugins.push(new ChunkNamesPlugin());

// We require that you explicitly set browsers and do not fall back to
// browserslist defaults.
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
const browsersCheckResult = checkBrowsers(paths.appPath, isInteractive).catch(
  err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  }
);

/**
 * Starts webpack a webpack compiler instance in watch mode.
 */
function watchBuild() {
  console.log('Watching for changes for development build...');
  console.log(`Output path: ${config.output.path}\n`);

  // Remove all content but keep the directory so that
  // if you're in it, you don't end up in Trash
  fs.emptyDirSync(config.output.path);

  // Get compiler instance
  const compiler = webpack(config);

  // Show progress while compiling
  const progressHandler = (percentage, msg, current, active, modulepath) => {
    if (process.stdout.isTTY && percentage < 1) {
      process.stdout.cursorTo(0);
      modulepath = modulepath
        ? ' …' + modulepath.substr(modulepath.length - 30)
        : '';
      current = current ? ' ' + current : '';
      active = active ? ' ' + active : '';
      process.stdout.write(
        (percentage * 100).toFixed(0) +
          '% ' +
          msg +
          current +
          active +
          modulepath +
          ' '
      );
      process.stdout.clearLine(1);
    } else if (percentage === 1) {
      process.stdout.write('\n');
      console.log('webpack: done.');
    }
  };
  new webpack.ProgressPlugin(progressHandler).apply(compiler);

  // Just in case, don't watch node_modules
  const watchOptions = {
    ignored: /node_modules/,
  };

  // Start watching, like when `webpack --watch-stdin`
  compiler.watch(watchOptions, (err, stats) => {
    if (err) {
      throw err;
    }
    process.stdout.write(
      stats.toString({
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
      }) + '\n\n'
    );
  });
}

/**
 * Similar to react-scripts/build but the ouptut is in development mode
 */
function buildCustom() {
  console.log(`Creating ${mode} build into ${config.output.path}  ...`);
  console.log();

  // Remove all content but keep the directory so that
  // if you're in it, you don't end up in Trash
  fs.emptyDirSync(config.output.path);

  // Get compiler instance
  const compiler = webpack(config);

  return new Promise((resolve, reject) =>
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          return reject(err);
        }
        messages = formatWebpackMessages({
          errors: [err.message],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        warnings: messages.warnings,
      };
      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    })
  ).then(
    ({ warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }
    },
    err => {
      console.log(chalk.red('Failed to compile.\n'));
      printBuildError(err);
      process.exit(1);
    }
  );
}

//
// Finally watch or build
//
if (watch) {
  browsersCheckResult.then(watchBuild);
} else {
  browsersCheckResult.then(buildCustom);
}
