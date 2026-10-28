import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it.each([
  ['development default', false, undefined, 'http://localhost:3000/transactions'],
  ['production same-origin default', true, undefined, '/transactions'],
  ['configured API prefix', true, 'https://api.example.test/api///', 'https://api.example.test/api/transactions'],
  ['explicit same-origin development', false, '', '/transactions'],
])('builds API URLs using the %s', async (_name, production, baseUrl, expected) => {
  vi.stubEnv('PROD', production)
  vi.stubEnv('VITE_API_BASE_URL', baseUrl)

  const { apiUrl } = await import('../src/apiUrl')

  expect(apiUrl('/transactions')).toBe(expected)
})
