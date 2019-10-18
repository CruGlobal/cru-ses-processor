export const BOUNCE_TYPE = 'Bounce'
export const COMPLAINT_TYPE = 'Complaint'
export const DELIVERY_TYPE = 'Delivery'
export const VALID_NOTIFICATION_TYPES = [BOUNCE_TYPE, COMPLAINT_TYPE, DELIVERY_TYPE]

class SesMessage {
  constructor (message) {
    this.message = message
  }

  static parse (json) {
    return new SesMessage(JSON.parse(json))
  }

  get notificationType () {
    return this.message.notificationType
  }

  get isValid () {
    return VALID_NOTIFICATION_TYPES.indexOf(this.notificationType) > -1
  }

  get messageAttributes () {
    // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html
    return {
      notificationType: {
        DataType: 'String',
        StringValue: this.notificationType
      },
      ...this.mailMessageAttributes,
      ...this.bounceMessageAttributes,
      ...this.complaintMessageAttributes,
      ...this.deliveryMessageAttributes
    }
  }

  get mailMessageAttributes () {
    // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#mail-object
    return {
      source: {
        DataType: 'String',
        StringValue: this.message['mail'].source
      },
      destination: {
        DataType: 'String.Array',
        StringValue: JSON.stringify(this.message['mail'].destination)
      }
    }
  }

  get bounceMessageAttributes () {
    if (this.notificationType === BOUNCE_TYPE) {
      // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-object
      const bouncedRecipients = this.message['bounce'].bouncedRecipients.map(val => val.emailAddress)
      return {
        bounceType: {
          DataType: 'String',
          StringValue: this.message['bounce'].bounceType
        },
        bounceSubType: {
          DataType: 'String',
          StringValue: this.message['bounce'].bounceSubType
        },
        bouncedRecipients: {
          DataType: 'String.Array',
          StringValue: JSON.stringify(bouncedRecipients)
        }
      }
    }
    return {}
  }

  get complaintMessageAttributes () {
    if (this.notificationType === COMPLAINT_TYPE) {
      // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complaint-object
      const complaints = this.message['complaint'].complainedRecipients.map(val => val.emailAddress)
      const attributes = {
        complainedRecipients: {
          DataType: 'String.Array',
          StringValue: JSON.stringify(complaints)
        }
      }
      /* istanbul ignore else */
      if (this.message['complaint'].complaintFeedbackType) {
        attributes.complaintFeedbackType = {
          DataType: 'String',
          StringValue: this.message['complaint'].complaintFeedbackType
        }
      }
      return attributes
    }
    return {}
  }

  get deliveryMessageAttributes () {
    if (this.notificationType === DELIVERY_TYPE) {
      // See https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#delivery-object
      return {
        recipients: {
          DataType: 'String.Array',
          StringValue: JSON.stringify(this.message['delivery'].recipients)
        }
      }
    }
    return {}
  }

  toJSON () {
    return JSON.stringify(this.message)
  }

  toSNSMessage () {
    return {
      Message: this.toJSON(),
      MessageAttributes: this.messageAttributes
    }
  }
}

export default SesMessage
