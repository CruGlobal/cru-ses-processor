import DataDogMetrics from './datadog-metrics'
import SesMessage from './ses-message'
import dogapi from 'dogapi'

const bounceMessage = require('../tests/fixtures/bounce')
const complaintMessage = require('../tests/fixtures/complaint')
const deliveryMessage = require('../tests/fixtures/delivery.json')

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
      expect(dogapi.initialize).toHaveBeenCalledWith({
        api_key: 'api_key',
        app_key: 'app_key'
      })
    })
  })

  describe('send()', () => {
    describe('delivery message', () => {
      it('should send correct delivery metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(deliveryMessage))
        dogapi.metric.send_all.mockImplementation((metrics, callback) => {
          callback(undefined, {})
        })
        await datadog.send()
        expect(dogapi.metric.send_all).toHaveBeenCalledWith([{
          metric: 'cru.ses.delivery',
          points: [[1453906778, 1]],
          metric_type: 'count',
          tags: [
            'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
            'sender:john@example.com',
            'caller_identity:sesv2-app-prod',
            'recipient_domain:example.com',
            'subject:hello'
          ]
        }], expect.any(Function))
      })
    })

    describe('bounce message', () => {
      it('should send correct bounce metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(bounceMessage))
        dogapi.metric.send_all.mockImplementation((metrics, callback) => {
          callback(undefined, {})
        })
        await datadog.send()
        expect(dogapi.metric.send_all).toHaveBeenCalledWith([{
          metric: 'cru.ses.bounce',
          points: [[1453906778, 1]],
          metric_type: 'count',
          tags: [
            'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
            'sender:john@example.com',
            'caller_identity:sesv2-app-prod',
            'recipient_domain:example.com',
            'subject:super_long_subject_with_w_rd_characters_and_emoji_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdef',
            'bounce_type:permanent',
            'bounce_sub_type:general'
          ]
        }, {
          metric: 'cru.ses.bounce',
          points: [[1453906778, 1]],
          metric_type: 'count',
          tags: [
            'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
            'sender:john@example.com',
            'caller_identity:sesv2-app-prod',
            'recipient_domain:cru.org',
            'subject:super_long_subject_with_w_rd_characters_and_emoji_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz0123456789:/\\-_abcdefghijklmnopqrstuvwxyz_abcdef',
            'bounce_type:permanent',
            'bounce_sub_type:general'
          ]
        }], expect.any(Function))
      })
    })

    describe('complaint message', () => {
      it('should send correct complaint metrics', async () => {
        const datadog = new DataDogMetrics(new SesMessage(complaintMessage))
        dogapi.metric.send_all.mockImplementation((metrics, callback) => {
          callback(undefined, {})
        })
        await datadog.send()
        expect(dogapi.metric.send_all).toHaveBeenCalledWith([{
          metric: 'cru.ses.complaint',
          points: [[1453906778, 1]],
          metric_type: 'count',
          tags: [
            'source_arn:arn:aws:ses:us-west-2:888888888888:identity/example.com',
            'sender:john@example.com',
            'caller_identity:sesv2-app-prod',
            'recipient_domain:example.com',
            'subject:hello',
            'complaint_type:abuse'
          ]
        }], expect.any(Function))
      })
    })

    describe('dogapi error', () => {
      it('should reject the promise', async () => {
        const datadog = new DataDogMetrics(new SesMessage(deliveryMessage))
        dogapi.metric.send_all.mockImplementation((metrics, callback) => {
          callback(new Error('An Error Occurred!'), {})
        })
        await expect(datadog.send()).rejects.toThrow('An Error Occurred!')
      })
    })
  })
})
