const SNS = jest.fn()
SNS._publishMock = jest.fn()
SNS._publishPromiseMock = jest.fn()
SNS.mockImplementation(() => ({
  publish: SNS._publishMock
}))
SNS._publishMock.mockImplementation(() => ({
  promise: SNS._publishPromiseMock
}))

const AWS = {
  SNS
}

export { AWS as default, SNS }
