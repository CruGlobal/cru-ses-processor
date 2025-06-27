export const handler = async (lambdaEvent) => {
  const envKeys = Object.keys(process.env)
  envKeys.sort()
  return Promise.resolve(JSON.stringify(envKeys, null, 2))
}
