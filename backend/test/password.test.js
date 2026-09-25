import test from 'node:test'
import assert from 'node:assert/strict'

import { hashPassword, verifyPassword } from '../src/password.js'

test('hashes and verifies the exact password without trimming it', async () => {
  const password = ' senha123 '
  const passwordHash = await hashPassword(password)

  assert.equal(await verifyPassword(password, passwordHash), true)
  assert.equal(await verifyPassword('senha123', passwordHash), false)
  assert.equal(await verifyPassword(' outra123 ', passwordHash), false)
})

test('creates different hashes for the same password', async () => {
  const password = 'senha123'

  const firstHash = await hashPassword(password)
  const secondHash = await hashPassword(password)

  assert.notEqual(firstHash, secondHash)
  assert.equal(await verifyPassword(password, firstHash), true)
  assert.equal(await verifyPassword(password, secondHash), true)
})

test('enforces the password length and whitespace rules', async () => {
  const minimumLengthPassword = 'a'.repeat(8)
  const maximumLengthPassword = 'a'.repeat(128)

  await assert.doesNotReject(() => hashPassword(minimumLengthPassword))
  await assert.doesNotReject(() => hashPassword(maximumLengthPassword))

  await assert.rejects(() => hashPassword('a'.repeat(7)), RangeError)
  await assert.rejects(() => hashPassword('a'.repeat(129)), RangeError)
  await assert.rejects(() => hashPassword('        '), RangeError)
})

test('rejects invalid or unsupported stored password hashes', async () => {
  const password = 'senha123'
  const passwordHash = await hashPassword(password)

  const parts = passwordHash.split('$')

  const unknownVersion = [
    parts[0],
    'v999',
    parts[2],
    parts[3],
    parts[4],
  ].join('$')

  const excessiveParameters = [
    parts[0],
    parts[1],
    'N=999999999,r=999,p=999,k=999',
    parts[3],
    parts[4],
  ].join('$')

  await assert.rejects(() => verifyPassword(password, 'invalid-hash'))
  await assert.rejects(() => verifyPassword(password, unknownVersion))
  await assert.rejects(() => verifyPassword(password, excessiveParameters))
})