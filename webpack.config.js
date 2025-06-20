const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')
const RollbarSourceMapPlugin = require('rollbar-sourcemap-webpack-plugin')
const childProcess = require('child_process')

function git (command) {
  return childProcess.execSync(`git ${command}`, { encoding: 'utf8' }).trim()
}

module.exports = (async () => {
  const version = git('rev-parse --short HEAD')
  return {
    entry: './handlers/process-message.js',
    target: 'node',
    devtool: 'hidden-source-map',
    mode: 'production',
    externals: [nodeExternals()],
    performance: {
      hints: false
    },
    optimization: {
      minimize: false,
      usedExports: true
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        SOURCEMAP_VERSION: version
      }),
      process.env.CI
        ? new RollbarSourceMapPlugin({
            accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
            ignoreErrors: true,
            publicPath: '/var/task',
            version: version
          })
        : false
    ].filter(Boolean)
  }
})()
