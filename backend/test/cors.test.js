import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'

const database = {
  query() { throw new Error('CORS tests should not access the database') },
}

function configureEnvironment(t, mode, origin) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.NODE_ENV = mode
  if (origin === undefined) delete process.env.FRONTEND_ORIGIN
  else process.env.FRONTEND_ORIGIN = origin
}

test('development CORS allows the existing Vite origin and credentialed preflight', async (t) => {
  configureEnvironment(t, 'development')
  const app = createApp({ database })
  const response = await request(app)
    .options('/transactions/example')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'PUT')
    .set('Access-Control-Request-Headers', 'content-type')

  assert.equal(response.status, 204)
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173')
  assert.equal(response.headers['access-control-allow-credentials'], 'true')
  assert.match(response.headers['access-control-allow-methods'], /PUT/)
  assert.equal(response.headers['access-control-allow-headers'], 'content-type')
})

test('CORS uses the configured origin without reflecting other request origins', async (t) => {
  configureEnvironment(t, 'production', 'https://finantec.example.test')
  const app = createApp({ database })

  for (const origin of ['https://finantec.example.test', 'https://untrusted.example.test']) {
    const response = await request(app).get('/health').set('Origin', origin)
    assert.equal(response.status, 200)
    assert.equal(response.headers['access-control-allow-origin'], 'https://finantec.example.test')
    assert.equal(response.headers['access-control-allow-credentials'], 'true')
  }
})

test('production without an explicit CORS origin serves same-origin requests without allowing cross-origin reads', async (t) => {
  configureEnvironment(t, 'production')
  const app = createApp({ database })

  const sameOrigin = await request(app).get('/health')
  assert.equal(sameOrigin.status, 200)
  assert.deepEqual(sameOrigin.body, { status: 'ok' })

  for (const origin of ['http://localhost:5173', 'https://untrusted.example.test']) {
    const response = await request(app).get('/health').set('Origin', origin)
    assert.equal(response.status, 200)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
    assert.equal(response.headers['access-control-allow-credentials'], undefined)
  }
})

test('CORS configuration rejects wildcards and URLs with paths', (t) => {
  configureEnvironment(t, 'production')

  for (const origin of ['*', 'https://finantec.example.test/app']) {
    process.env.FRONTEND_ORIGIN = origin
    assert.throws(() => createApp({ database }))
  }
})
