export const handler = async (lambdaEvent) => {
  const paramKeys = Object.keys(process.env)
  console.log('Event:', lambdaEvent)
  console.log('Environment:', paramKeys)

  return Promise.resolve({})
}
