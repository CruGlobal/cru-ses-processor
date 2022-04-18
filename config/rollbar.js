'use strict'

import Rollbar from 'rollbar'
import { includes } from 'lodash'

const rollbar = new Rollbar({
  // https://rollbar.com/docs/notifier/rollbar.js/#configuration-reference
  accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
  // Enable rollbar on staging and production
  enabled: includes(['staging', 'production'], process.env.ENVIRONMENT),
  payload: {
    environment: process.env.ENVIRONMENT,
    client: {
      javascript: {
        source_map_enabled: true,
        code_version: process.env.SOURCEMAP_VERSION,
        guess_uncaught_frames: true
      }
    }
  }
})

export default {
  error: (...args) => new Promise(resolve => rollbar.error(...args, resolve))
}
