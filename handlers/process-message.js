'use strict'

import { SNS } from 'aws-sdk'
import rollbar from '../config/rollbar'

export const handler = async (lambdaEvent) => {
  try {
  } catch (error) {
    rollbar.error('process-message error', error)
    return Promise.reject(error)
  }
}
