import { handler } from './process-message'
import { SNS } from 'aws-sdk'
import DataDogMetrics from '../models/datadog-metrics'
import rollbar from '../config/rollbar'
import SesMessage from '../models/ses-message'

jest.mock('../config/rollbar')
const mockSend = jest.fn()
jest.mock('../models/datadog-metrics', () => jest.fn().mockImplementation(() => ({ send: mockSend })))

const deliveryMessage = require('../tests/fixtures/delivery')

describe('`process-message` lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should send message to SNS and metrics to DataDog', async () => {
    SNS._publishPromiseMock.mockResolvedValueOnce({})
    mockSend.mockResolvedValueOnce({})

    await handler({ Records: [{ Sns: { Message: JSON.stringify(deliveryMessage) } }] })

    expect(SNS).toHaveBeenCalledWith({ apiVersion: '2010-03-31' })
    expect(DataDogMetrics).toHaveBeenCalledWith(expect.any(SesMessage))
    expect(SNS._publishMock).toHaveBeenCalledWith(expect.objectContaining({
      Message: expect.anything(),
      MessageAttributes: expect.anything()
    }))
    expect(mockSend).toHaveBeenCalled()
  })

  it('should return an error', async () => {
    SNS._publishPromiseMock.mockRejectedValueOnce(new Error('Ohh noes!!!'))
    mockSend.mockResolvedValue({})

    await expect(handler({ Records: [{ Sns: { Message: JSON.stringify(deliveryMessage) } }] }))
      .rejects.toThrowError('Ohh noes!!!')
    expect(rollbar.error).toHaveBeenCalled()
  })

  it('short circuits if notificationType is invalid', async () => {
    await handler({ Records: [{ Sns: { Message: JSON.stringify({ notificationType: 'blah' }) } }] })
    expect(SNS).not.toHaveBeenCalled()
    expect(DataDogMetrics).not.toHaveBeenCalled()
  })
})
