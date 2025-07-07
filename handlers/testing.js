import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'

export const handler = async (lambdaEvent) => {
  const paramKeys = Object.keys(process.env).sort()
  console.log('Event:', lambdaEvent)
  console.log('Environment:', paramKeys)

  const stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' })
  const response = await stsClient.send(new GetCallerIdentityCommand({}))

  return Promise.resolve(response)
}
