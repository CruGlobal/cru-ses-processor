const webpack = require('webpack')
const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')
const RollbarSourceMapPlugin = require('rollbar-sourcemap-webpack-plugin')
const childProcess = require('child_process')

function git (command) {
  return childProcess.execSync(`git ${command}`, { encoding: 'utf8' }).trim()
}

const version = git('rev-parse --short HEAD')

module.exports = {
  target: 'node',
  mode: 'production',
  entry: {
    'process-message': './handlers/process-message.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    chunkFormat: false,
    library: {
      type: 'commonjs2'
    }
  },
  externalsPresets: {
    node: true
  },
  externals: {
    'datadog-lambda-js': 'datadog-lambda-js',
    'dd-trace': 'dd-trace'
  },
  devtool: 'source-map',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false
          }
        }
      })
    ]
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
        version
      })
      : false
  ].filter(Boolean),
  ignoreWarnings: [
    {
      message: /aws-crt/
    }
  ]
}
