import { handler } from './process-message'
import DataDogMetrics from '../models/datadog-metrics'
import rollbar from '../config/rollbar'
import SesMessage from '../models/ses-message'
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'

jest.mock('../config/rollbar')
const mockSend = jest.fn()
jest.mock('../models/datadog-metrics', () => jest.fn().mockImplementation(() => ({ send: mockSend })))

const mockSnsSend = jest.fn()
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({
    send: mockSnsSend
  })),
  PublishCommand: jest.fn().mockImplementation(() => {})
}))

const deliveryMessage = require('../tests/fixtures/delivery')

describe('`process-message` lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send message to SNS and metrics to DataDog', async () => {
    await handler({ Records: [{ Sns: { Message: JSON.stringify(deliveryMessage) } }] })

    expect(SNSClient).toHaveBeenCalledTimes(1)
    expect(PublishCommand).toHaveBeenCalledWith(expect.objectContaining({
      Message: expect.anything(),
      MessageAttributes: expect.anything()
    }))
    expect(mockSnsSend).toHaveBeenCalledTimes(1)
    expect(DataDogMetrics).toHaveBeenCalledWith(expect.any(SesMessage))
  })

  it('should return an error', async () => {
    mockSnsSend.mockRejectedValueOnce(new Error('Ohh noes!!!'))
    mockSend.mockResolvedValue({})

    await expect(handler({ Records: [{ Sns: { Message: JSON.stringify(deliveryMessage) } }] }))
      .rejects.toThrow('Ohh noes!!!')
    expect(rollbar.error).toHaveBeenCalled()
  })

  it('short circuits if notificationType is invalid', async () => {
    await handler({ Records: [{ Sns: { Message: JSON.stringify({ notificationType: 'blah' }) } }] })
    expect(SNSClient).not.toHaveBeenCalled()
    expect(DataDogMetrics).not.toHaveBeenCalled()
  })
})
