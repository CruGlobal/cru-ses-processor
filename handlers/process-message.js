'use strict'

import { SNS } from 'aws-sdk'
import rollbar from '../config/rollbar'
import SesMessage from '../models/ses-message'
import DataDogMetrics from '../models/datadog-metrics'

export const handler = async (lambdaEvent) => {
  try {
    // Parse message from lambdaEvent
    const message = SesMessage.parse(lambdaEvent.Records[0].Sns.Message)

    // Bail if this isn't a valid SES message
    if (!message.isValid) {
      return {}
    }

    return await Promise.all([
      // Forward message to `all-ses-events-filterable` SNS queue with added messageAttributes
      new SNS({ apiVersion: '2010-03-31' })
        .publish({ TargetArn: process.env.SNS_SES_EVENTS_FILTERABLE_ARN, ...message.toSNSMessage() })
        .promise(),
      // Send SES event metrics to DataDog
      new DataDogMetrics(message)
        .send()
    ])
  } catch (error) {
    await rollbar.error('process-message error', error, { lambdaEvent })
    throw error
  }
}
