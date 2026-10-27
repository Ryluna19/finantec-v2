import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import useTransactions from '../src/features/transactions/useTransactions'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('rejects transaction operations while the initial load is pending or has failed', async () => {
  let resolveGet
  const pendingGet = new Promise((resolve) => {
    resolveGet = resolve
  })

  const fetchMock = vi.fn((_url, options = {}) => {
    if (!options.method) {
      return pendingGet
    }

    throw new Error('Unexpected operation before loading transactions')
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})

  const options = {
    captureAuthGeneration: () => 0,
    isCurrentAuthGeneration: (generation) => generation === 0,
    expireSession: vi.fn(),
  }

  const { result } = renderHook(() => useTransactions(options))
  const file = new File(['CSV'], 'transacoes.csv', { type: 'text/csv' })
  const transaction = {
    date: '2026-10-15',
    type: 'income',
    description: 'Nova transação',
    category: 'Trabalho',
    amountInCents: 10000,
  }

  async function expectOperationsBlocked() {
    const operations = [
      () => result.current.addTransaction(transaction),
      () => result.current.updateTransaction('transaction-id', transaction),
      () => result.current.deleteTransaction('transaction-id'),
      () => result.current.previewTransactionImport(file),
      () => result.current.importTransactions(file, false),
    ]

    for (const operation of operations) {
      await expect(operation()).rejects.toThrow(/carregadas/)
    }

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:3000/transactions',
      { credentials: 'include' },
    )
  }

  expect(result.current.isLoadingTransactions).toBe(true)
  await expectOperationsBlocked()

  await act(async () => {
    resolveGet({ ok: false, status: 500 })
    await pendingGet
  })

  expect(result.current.isLoadingTransactions).toBe(false)
  expect(result.current.transactionsLoadError).toBe(
    'Não foi possível carregar as transações.',
  )
  await expectOperationsBlocked()
})
