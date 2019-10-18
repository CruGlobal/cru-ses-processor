import SesMessage, { DELIVERY_TYPE } from './ses-message'

const bounceMessage = require('../tests/fixtures/bounce')
const complaintMessage = require('../tests/fixtures/complaint')
const deliveryMessage = require('../tests/fixtures/delivery.json')

describe('SesMessage class', () => {
  describe('constructor(message)', () => {
    it('should initialize an instance', () => {
      const message = new SesMessage(bounceMessage)
      expect(message).toEqual(expect.any(SesMessage))
      expect(message.message).toBe(bounceMessage)
    })
  })

  describe('parse(json)', () => {
    it('should initialize an instance from JSON', () => {
      const message = SesMessage.parse(JSON.stringify(bounceMessage))
      expect(message).toEqual(expect.any(SesMessage))
      expect(message.message).toStrictEqual(bounceMessage)
    })
  })

  describe('isValid', () => {
    it('should return if message is a valid ses message type', () => {
      const message = new SesMessage({ notificationType: 'something' })
      expect(message.isValid).toBeFalsy()
      message.message.notificationType = DELIVERY_TYPE
      expect(message.isValid).toBeTruthy()
    })
  })

  describe('toJSON()', () => {
    it('should produce a JSON string', () => {
      const message = new SesMessage(bounceMessage)
      const json = message.toJSON()
      expect(json).toEqual(expect.any(String))
      expect(JSON.parse(json)).toStrictEqual(bounceMessage)
    })
  })

  describe('toSNSMessage()', () => {
    describe('delivery message', () => {
      it('should produce delivery SNS message payload', () => {
        const message = new SesMessage(deliveryMessage)
        const snsMessage = message.toSNSMessage()
        expect(snsMessage).toEqual({
          Message: JSON.stringify(deliveryMessage),
          MessageAttributes: {
            destination: {
              DataType: 'String.Array',
              StringValue: '["jane@example.com"]'
            },
            notificationType: {
              DataType: 'String',
              StringValue: 'Delivery'
            },
            recipients: {
              DataType: 'String.Array',
              StringValue: '["jane@example.com"]'
            },
            source: {
              DataType: 'String',
              StringValue: 'john@example.com'
            }
          }
        })
      })
    })

    describe('bounce message', () => {
      it('should produce bounce SNS message payload', () => {
        const message = new SesMessage(bounceMessage)
        const snsMessage = message.toSNSMessage()
        expect(snsMessage).toEqual({
          Message: JSON.stringify(bounceMessage),
          MessageAttributes: {
            destination: {
              DataType: 'String.Array',
              StringValue: '["jane@example.com","mary@example.com","richard@cru.org"]'
            },
            notificationType: {
              DataType: 'String',
              StringValue: 'Bounce'
            },
            bouncedRecipients: {
              DataType: 'String.Array',
              StringValue: '["jane@example.com","richard@cru.org"]'
            },
            source: {
              DataType: 'String',
              StringValue: 'john@example.com'
            },
            bounceSubType: {
              DataType: 'String',
              StringValue: 'General'
            },
            bounceType: {
              DataType: 'String',
              StringValue: 'Permanent'
            }
          }
        })
      })
    })

    describe('complaint message', () => {
      it('should produce complaint SNS message payload', () => {
        const message = new SesMessage(complaintMessage)
        const snsMessage = message.toSNSMessage()
        expect(snsMessage).toEqual({
          Message: JSON.stringify(complaintMessage),
          MessageAttributes: {
            destination: {
              DataType: 'String.Array',
              StringValue: '["jane@example.com","mary@example.com","richard@example.com"]'
            },
            notificationType: {
              DataType: 'String',
              StringValue: 'Complaint'
            },
            complainedRecipients: {
              DataType: 'String.Array',
              StringValue: '["richard@example.com"]'
            },
            source: {
              DataType: 'String',
              StringValue: 'john@example.com'
            },
            complaintFeedbackType: {
              DataType: 'String',
              StringValue: 'abuse'
            }
          }
        })
      })
    })
  })
})
