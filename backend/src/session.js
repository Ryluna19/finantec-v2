import { createHash, randomBytes } from 'node:crypto'

const SESSION_TOKEN_LENGTH = 32

export function createSessionToken() {
  return randomBytes(SESSION_TOKEN_LENGTH).toString('base64url')
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('Session token must be a non-empty string.')
  }

  return createHash('sha256').update(token).digest()
}