import DataDogMetrics from './datadog-metrics'
import SesMessage from './ses-message'
import { sendDistributionMetricWithDate } from 'datadog-lambda-js'

const bounceMessage = require('../tests/fixtures/bounce')
const complaintMessage = require('../tests/fixtures/complaint')
const deliveryMessage = require('../tests/fixtures/delivery.json')

jest.mock('datadog-lambda-js', () => ({
  sendDistributionMetricWithDate: jest.fn()
}))

describe('DataDogMetrics', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('constructor(sesMessage)', () => {
    it('should initialize the client', () => {
      const message = { foo: { bar: 'baz' } }
      const datadog = new DataDogMetrics(message)
      expect(datadog.sesMessage).toEqual(message)
      expect(datadog.message).toEqual(message.message)
    })
  })

  describe('send()', () => {
    describe('delivery message', () => {
      it('should send correct delivery metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(deliveryMessage))
        sendDistributionMetricWithDate.mockImplementation(() => {})
        await datadog.send()
        expect(sendDistributionMetricWithDate).toHaveBeenCalledWith(
          'cru.sesv2.delivery',
          1,
          new Date('2016-01-27T14:59:38.237Z'),
          'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
          'sender:john@example.com',
          'caller_identity:sesv2-app-prod',
          'recipient_domain:example.com',
          'subject:hello'
        )
      })
    })

    describe('bounce message', () => {
      it('should send correct bounce metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(bounceMessage))
        sendDistributionMetricWithDate.mockImplementation(() => {})
        await datadog.send()
        expect(sendDistributionMetricWithDate).toHaveBeenCalledTimes(2)
        expect(sendDistributionMetricWithDate).toHaveBeenCalledWith(
          'cru.sesv2.bounce',
          1,
          new Date('2016-01-27T14:59:38.237Z'),
          'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
          'sender:john@example.com',
          'caller_identity:sesv2-app-prod',
          'recipient_domain:example.com',
          'subject:super_long_subject_with_w_rd_characters_and_emoji_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdef',
          'bounce_type:permanent',
          'bounce_sub_type:general'
        )
        expect(sendDistributionMetricWithDate).toHaveBeenCalledWith(
          'cru.sesv2.bounce',
          1,
          new Date('2016-01-27T14:59:38.237Z'),
          'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
          'sender:john@example.com',
          'caller_identity:sesv2-app-prod',
          'recipient_domain:cru.org',
          'subject:super_long_subject_with_w_rd_characters_and_emoji_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdef',
          'bounce_type:permanent',
          'bounce_sub_type:general'
        )
      })
    })

    describe('complaint message', () => {
      it('should send correct complaint metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(complaintMessage))
        sendDistributionMetricWithDate.mockImplementation(() => {})
        await datadog.send()
        expect(sendDistributionMetricWithDate).toHaveBeenCalledWith(
          'cru.sesv2.complaint',
          1,
          new Date('2016-01-27T14:59:38.237Z'),
          'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
          'sender:john@example.com',
          'caller_identity:sesv2-app-prod',
          'recipient_domain:example.com',
          'subject:hello',
          'complaint_type:abuse'
        )
      })
    })

      describe('dogapi error', () => {
        it('should reject the promise', async () => {
          const datadog = new DataDogMetrics(new SesMessage(deliveryMessage))
          sendDistributionMetricWithDate.mockImplementation(() => {
            throw new Error('An Error Occurred!')
          })
          await expect(datadog.send()).rejects.toThrow('An Error Occurred!')
        })
      })
  })
})
