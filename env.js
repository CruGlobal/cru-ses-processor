// This file is used by serverless to load environment from .env, and to set environment fields in functions
module.exports = () => {
  const { parsed } = require('dotenv').config()
  const env = {}
  for (const [key, value] of Object.entries(parsed)) {
    env[key] = process.env[key] || value
  }
  return env
}
