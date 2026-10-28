import { afterAll, afterEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import useAuth from '../src/features/auth/useAuth'
import useTransactions from '../src/features/transactions/useTransactions'
import useBudgets from '../src/features/budgets/useBudgets'

vi.hoisted(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('routes authenticated requests through the configured API base URL', async () => {
  const user = { id: 'user-id', username: 'Ryan' }
  const fetchMock = vi.fn(async (url) => {
    const data = {
      '/api/auth/me': { user },
      '/api/transactions': [],
      '/api/budgets': [],
    }

    if (!(url in data)) throw new Error(`Unexpected URL: ${url}`)

    return { ok: true, status: 200, json: async () => data[url] }
  })
  vi.stubGlobal('fetch', fetchMock)

  const authOptions = {
    captureAuthGeneration: () => 0,
    isCurrentAuthGeneration: (generation) => generation === 0,
    expireSession: vi.fn(),
  }
  const auth = renderHook(() => useAuth())
  const transactions = renderHook(() => useTransactions(authOptions))
  const budgets = renderHook(() => useBudgets(authOptions))

  await waitFor(() => {
    expect(auth.result.current.user).toEqual(user)
    expect(transactions.result.current.isLoadingTransactions).toBe(false)
    expect(budgets.result.current.isLoadingBudgets).toBe(false)
  })

  expect(transactions.result.current.transactionsLoadError).toBeNull()
  expect(budgets.result.current.budgetsLoadError).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(3)
  for (const path of ['/auth/me', '/transactions', '/budgets']) {
    expect(fetchMock).toHaveBeenCalledWith(`/api${path}`, { credentials: 'include' })
  }
})
