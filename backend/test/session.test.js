import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createSessionToken,
  hashSessionToken,
} from '../src/session.js'

test('creates unique session tokens with stable hashes', () => {
  const firstToken = createSessionToken()
  const secondToken = createSessionToken()

  assert.notEqual(firstToken, secondToken)

  const firstHash = hashSessionToken(firstToken)
  const repeatedFirstHash = hashSessionToken(firstToken)
  const secondHash = hashSessionToken(secondToken)

  assert.equal(firstHash.equals(repeatedFirstHash), true)
  assert.equal(firstHash.equals(secondHash), false)
  assert.equal(firstHash.length, 32)
})