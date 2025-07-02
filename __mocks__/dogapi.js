const mockDogapi = jest.createMockFromModule('dogapi')

// client methods aren't exposed in the module, so they aren't auto-mocked
mockDogapi.metric = {
  send_all: jest.fn()
}

export default mockDogapi
