'use strict'

module.exports = () => {
  // Use dotenv to load local development overrides
  require('dotenv').config()
  return {
    ENVIRONMENT: process.env['ENVIRONMENT'] || 'development',
    ROLLBAR_ACCESS_TOKEN: process.env['ROLLBAR_ACCESS_TOKEN'] || '',
    SNS_ALL_SES_EVENTS_ARN: process.env['SNS_ALL_SES_EVENTS_ARN'] || '',
    SNS_SES_EVENTS_FILTERABLE_ARN: process.env['SNS_SES_EVENTS_FILTERABLE_ARN'] || ''
  }
}
