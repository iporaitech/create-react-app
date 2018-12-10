// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @remove-on-eject-end
'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

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

const isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Process CLI arguments
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;
const watch = argv.indexOf('--watch') !== -1;

// Generate configuration
const config = configFactory(
  'development',
  process.env.CRA_BUILD_STATIC_PREFIX || '',
  process.env.CRA_BUILD_PUBLIC_PATH
);

//
// Overwrite default CRA webpack config for development
//
config.output.path =
  process.env.CRA_BUILD_OUTPUT_PATH || path.resolve(paths.appBuild, 'dev');
config.entry = paths.appIndexJs; // Just index. We're not using WebpackDevServer
config.optimization.splitChunks = {
  chunks: 'all',
  name: true, // If false it generates a name that changes on each recompile,
  // when true, generates the name vendor~main.chunk.js and thus, we can put
  // it in script tags in another index.html
};
// We need to remove the HotModuleReplacementPlugin because we're not using
// the bundle in webpack-dev-server or something alike
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'HotModuleReplacementPlugin'
);

// We don't need to generate index.html here
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'HtmlWebpackPlugin'
);

// We don't need to generate a
config.plugins = config.plugins.filter(
  p => p.constructor.name !== 'ManifestPlugin'
);

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
function buildDev() {
  console.log(`Creating development build into ${config.output.path}  ...`);
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
  browsersCheckResult.then(buildDev);
}
