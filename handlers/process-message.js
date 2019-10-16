'use strict'

import { SNS } from 'aws-sdk'
import rollbar from '../config/rollbar'

const notificationTypes = ['Bounce', 'Complaint', 'Delivery']

export const handler = async (lambdaEvent) => {
  try {
    // Parse message from lambdaEvent
    const message = JSON.parse(lambdaEvent.Records[0].Sns.Message)

    if (notificationTypes.indexOf(message.notificationType) < 0) {
      return {}
    }

    // Create message attributes
    const messageAttributes = {
      // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html
      notificationType: {
        DataType: 'String',
        StringValue: message.notificationType
      },
      source: {
        DataType: 'String',
        StringValue: message['mail'].source
      },
      destination: {
        DataType: 'String.Array',
        StringValue: JSON.stringify(message['mail'].destination)
      }
    }

    switch (message.notificationType) {
      case 'Bounce':
        // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-object
        messageAttributes.bounceType = {
          DataType: 'String',
          StringValue: message['bounce'].bounceType
        }
        messageAttributes.bounceSubType = {
          DataType: 'String',
          StringValue: message['bounce'].bounceSubType
        }
        const bouncedRecipients = message['bounce'].bouncedRecipients.map(val => val.emailAddress)
        messageAttributes.bouncedRecipients = {
          DataType: 'String.Array',
          StringValue: JSON.stringify(bouncedRecipients)
        }
        break
      case 'Complaint':
        // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complaint-object
        const complaints = message['complaint'].complainedRecipients.map(val => val.emailAddress)
        messageAttributes.complainedRecipients = {
          DataType: 'String.Array',
          StringValue: JSON.stringify(complaints)
        }
        if (message['complaint'].complaintFeedbackType) {
          messageAttributes.complaintFeedbackType = {
            DataType: 'String',
            StringValue: message['complaint'].complaintFeedbackType
          }
        }
        break
      case 'Delivery':
        // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#delivery-object
        message.recipients = {
          DataType: 'String.Array',
          StringValue: JSON.stringify(message['delivery'].recipients)
        }
        break
    }

    const sns = new SNS({ apiVersion: '2010-03-31' })
    return await sns.publish({
      TargetArn: process.env.SNS_SES_EVENTS_FILTERABLE_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: messageAttributes
    }).promise()
  } catch (error) {
    rollbar.error('process-message error', error, { lambdaEvent })
    return Promise.reject(error)
  }
}
