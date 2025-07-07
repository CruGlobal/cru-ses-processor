'use strict'

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
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

    const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' })
    return await Promise.all([
      // Forward message to `all-ses-events-filterable` SNS queue with added messageAttributes
      snsClient.send(new PublishCommand({
        TargetArn: process.env.SNS_SES_EVENTS_FILTERABLE_ARN,
        ...message.toSNSMessage()
      })),

      // Send SES event metrics to DataDog
      new DataDogMetrics(message)
        .send()
    ])
  } catch (error) {
    await rollbar.error('process-message error', error, { lambdaEvent })
    throw error
  }
}
