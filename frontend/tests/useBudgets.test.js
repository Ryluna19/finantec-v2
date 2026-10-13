
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react'

import useBudgets from '../src/features/budgets/useBudgets'

const API = 'http://localhost:3000'

function budget(id, changes = {}) {
  return {
    id,
    startPeriod: '2026-01',
    endPeriod: null,
    category: 'Casa',
    plannedAmountInCents: 10000,
    ...changes,
  }
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

function deferredResponse() {
  let resolve

  const promise = new Promise((done) => {
    resolve = done
  })

  return { promise, resolve }
}

function authenticatedHook() {
  const generation = { current: 0 }

  const expireSession = vi.fn(
    (requestGeneration) => {
      if (
        requestGeneration ===
        generation.current
      ) {
        generation.current += 1
      }
    },
  )

  const options = {
    captureAuthGeneration: () =>
      generation.current,

    isCurrentAuthGeneration: (value) =>
      value === generation.current,

    expireSession,
  }

  return {
    generation,
    expireSession,
    options,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useBudgets', () => {
  it('carrega apenas os orçamentos da sessão autenticada', async () => {
    const existing = budget('a')

    const fetchMock = vi.fn(
      async () =>
        response(200, [existing]),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { options } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() => {
      expect(
        result.current.isLoadingBudgets,
      ).toBe(false)
    })

    expect(
      result.current.budgets,
    ).toEqual([existing])

    expect(
      result.current.budgetsLoadError,
    ).toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/budgets`,
      {
        credentials: 'include',
      },
    )
  })

  it('sincroniza criação, edição, divisão e exclusão sem novo GET', async () => {
    const original = budget('a')

    const created = budget('b', {
      startPeriod: '2026-02',
      category: 'Lazer',
    })

    const updated = {
      ...created,
      endPeriod: '2026-12',
      plannedAmountInCents: 20000,
    }

    const oldSegment = {
      ...updated,
      endPeriod: '2026-05',
    }

    const newSegment = budget('c', {
      startPeriod: '2026-06',
      endPeriod: '2026-12',
      category: 'Lazer',
      plannedAmountInCents: 23000,
    })

    const fetchMock = vi.fn(
      async (url, options = {}) => {
        if (
          url === `${API}/budgets` &&
          !options.method
        ) {
          return response(200, [original])
        }

        if (
          url === `${API}/budgets` &&
          options.method === 'POST'
        ) {
          return response(201, created)
        }

        if (
          url === `${API}/budgets/b` &&
          options.method === 'PUT'
        ) {
          return response(200, updated)
        }

        if (
          url === `${API}/budgets/b/split` &&
          options.method === 'POST'
        ) {
          return response(201, {
            previousBudget: oldSegment,
            createdBudget: newSegment,
          })
        }

        if (
          url === `${API}/budgets/c` &&
          options.method === 'DELETE'
        ) {
          return response(204)
        }

        throw new Error(
          `Requisição inesperada: ${options.method} ${url}`,
        )
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    const { options } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() =>
      expect(
        result.current.isLoadingBudgets,
      ).toBe(false),
    )

    const createPayload = {
      startPeriod: '2026-02',
      category: 'Lazer',
      plannedAmountInCents: 10000,
    }

    await act(async () => {
      expect(
        await result.current.addBudget(
          createPayload,
        ),
      ).toEqual(created)
    })

    expect(
      result.current.budgets,
    ).toEqual([created, original])

    const updatePayload = {
      endPeriod: '2026-12',
      category: 'Lazer',
      plannedAmountInCents: 20000,
    }

    await act(async () => {
      expect(
        await result.current.updateBudget(
          'b',
          updatePayload,
        ),
      ).toEqual(updated)
    })

    expect(
      result.current.budgets,
    ).toEqual([updated, original])

    // A ausência de endPeriod deve ser preservada.
    const splitPayload = {
      splitPeriod: '2026-06',
      category: 'Lazer',
      plannedAmountInCents: 23000,
    }

    await act(async () => {
      expect(
        await result.current.splitBudget(
          'b',
          splitPayload,
        ),
      ).toEqual({
        previousBudget: oldSegment,
        createdBudget: newSegment,
      })
    })

    expect(
      result.current.budgets,
    ).toEqual([
      newSegment,
      oldSegment,
      original,
    ])

    await act(async () => {
      expect(
        await result.current.deleteBudget('c'),
      ).toBe(true)
    })

    expect(
      result.current.budgets,
    ).toEqual([
      oldSegment,
      original,
    ])

    expect(fetchMock).toHaveBeenCalledTimes(5)

    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/budgets`,
      {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createPayload),
      },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/budgets/b/split`,
      {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(splitPayload),
      },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/budgets/c`,
      {
        credentials: 'include',
        method: 'DELETE',
      },
    )
  })

  it('preserva os dados locais e expõe o erro de conflito HTTP 409', async () => {
    const existing = budget('a')

    const fetchMock = vi.fn(
      async (url, options = {}) => {
        if (url !== `${API}/budgets`) {
          throw new Error('Rota inesperada')
        }

        if (!options.method) {
          return response(200, [existing])
        }

        return response(409, {
          error:
            'Já existe um orçamento para essa categoria.',
        })
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    const { options } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() =>
      expect(
        result.current.isLoadingBudgets,
      ).toBe(false),
    )

    await act(async () => {
      await expect(
        result.current.addBudget({
          startPeriod: '2026-01',
          category: 'Casa',
          plannedAmountInCents: 10000,
        }),
      ).rejects.toThrow(
        'Já existe um orçamento para essa categoria.',
      )
    })

    expect(
      result.current.budgets,
    ).toEqual([existing])
  })

  it('não permite que um GET atrasado sobrescreva um orçamento recém-criado', async () => {
    const pendingGet = deferredResponse()
    const created = budget('novo')

    const fetchMock = vi.fn(
      (url, options = {}) => {
        if (url !== `${API}/budgets`) {
          throw new Error('Rota inesperada')
        }

        if (!options.method) {
          return pendingGet.promise
        }

        return Promise.resolve(
          response(201, created),
        )
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    const { options } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await act(async () => {
      await result.current.addBudget({
        startPeriod: '2026-01',
        category: 'Casa',
        plannedAmountInCents: 10000,
      })
    })

    expect(
      result.current.budgets,
    ).toEqual([created])

    await act(async () => {
      pendingGet.resolve(
        response(200, []),
      )

      await pendingGet.promise
    })

    await waitFor(() =>
      expect(
        result.current.isLoadingBudgets,
      ).toBe(false),
    )

    expect(
      result.current.budgets,
    ).toEqual([created])
  })

  it('descarta a resposta de uma mutação pertencente a uma sessão antiga', async () => {
    const pendingPost = deferredResponse()

    const fetchMock = vi.fn(
      (url, options = {}) => {
        if (url !== `${API}/budgets`) {
          throw new Error('Rota inesperada')
        }

        if (!options.method) {
          return Promise.resolve(
            response(200, []),
          )
        }

        return pendingPost.promise
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    const {
      generation,
      options,
    } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() =>
      expect(
        result.current.isLoadingBudgets,
      ).toBe(false),
    )

    let resultOfMutation

    await act(async () => {
      const operation =
        result.current.addBudget({
          startPeriod: '2026-01',
          category: 'Casa',
          plannedAmountInCents: 10000,
        })

      generation.current += 1

      pendingPost.resolve(
        response(201, budget('anterior')),
      )

      resultOfMutation = await operation
    })

    expect(resultOfMutation).toBeNull()

    expect(
      result.current.budgets,
    ).toEqual([])
  })

  it('encaminha HTTP 401 para a expiração da sessão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(401)),
    )

    const {
      options,
      expireSession,
    } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() =>
      expect(expireSession).toHaveBeenCalledWith(0),
    )

    expect(
      result.current.budgets,
    ).toEqual([])
  })

  it('distingue falha no carregamento de lista vazia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('API indisponível')
      }),
    )

    vi.spyOn(
      console,
      'error',
    ).mockImplementation(() => {})

    const { options } = authenticatedHook()

    const { result } = renderHook(() =>
      useBudgets(options),
    )

    await waitFor(() => {
      expect(
        result.current.budgetsLoadError,
      ).toBe(
        'Não foi possível carregar os orçamentos.',
      )
    })

    expect(
      result.current.budgets,
    ).toEqual([])

    expect(
      result.current.isLoadingBudgets,
    ).toBe(false)
  })
})
