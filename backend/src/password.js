import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 3
const SCRYPT_KEY_LENGTH = 32
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const SALT_LENGTH = 16

function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string.')
  }

  const passwordLength = Array.from(password).length

  if (
    passwordLength < MIN_PASSWORD_LENGTH ||
    passwordLength > MAX_PASSWORD_LENGTH
  ) {
    throw new RangeError('Password length is invalid.')
  }

  if (password.trim().length === 0) {
    throw new RangeError('Password cannot contain only whitespace.')
  }
}

export async function hashPassword(password) {
  validatePassword(password)

  const salt = randomBytes(SALT_LENGTH)

  const derivedKey = await scryptAsync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    },
  )

  const parameters =
    `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P},k=${SCRYPT_KEY_LENGTH}`

  return [
    'scrypt',
    'v1',
    parameters,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$')
}

function parsePasswordHash(passwordHash) {
  if (typeof passwordHash !== 'string') {
    throw new TypeError('Password hash must be a string.')
  }

  const parts = passwordHash.split('$')

  if (parts.length !== 5) {
    throw new Error('Invalid password hash format.')
  }

  const [algorithm, version, parameters, saltEncoded, hashEncoded] = parts

  const expectedParameters =
    `N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P},k=${SCRYPT_KEY_LENGTH}`

  if (
    algorithm !== 'scrypt' ||
    version !== 'v1' ||
    parameters !== expectedParameters
  ) {
    throw new Error('Unsupported password hash format.')
  }

  const base64UrlPattern = /^[A-Za-z0-9_-]+$/

  if (
    !base64UrlPattern.test(saltEncoded) ||
    !base64UrlPattern.test(hashEncoded)
  ) {
    throw new Error('Invalid password hash encoding.')
  }

  const salt = Buffer.from(saltEncoded, 'base64url')
  const storedKey = Buffer.from(hashEncoded, 'base64url')

  if (
    salt.length !== SALT_LENGTH ||
    storedKey.length !== SCRYPT_KEY_LENGTH ||
    salt.toString('base64url') !== saltEncoded ||
    storedKey.toString('base64url') !== hashEncoded
  ) {
    throw new Error('Invalid password hash data.')
  }

  return { salt, storedKey }
}

export async function verifyPassword(password, passwordHash) {
  validatePassword(password)

  const { salt, storedKey } = parsePasswordHash(passwordHash)

  const derivedKey = await scryptAsync(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    },
  )

  return timingSafeEqual(storedKey, derivedKey)
}