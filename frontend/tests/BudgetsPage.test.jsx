
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import App from '../src/app/App'

const API = 'http://localhost:3000'

const currencyFormatter = new Intl.NumberFormat(
  'pt-BR',
  {
    style: 'currency',
    currency: 'BRL',
  },
)

function formatCurrency(cents) {
  return currencyFormatter.format(cents / 100)
}

function apiResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BudgetsPage', () => {
  it('carrega orçamentos ao abrir a página e calcula o mês selecionado', async () => {
    const transactions = [
      {
        id: 't1',
        date: '2026-06-10',
        type: 'expense',
        category: 'ALIMENTACAO',
        amountInCents: 15000,
      },
      {
        id: 't2',
        date: '2026-06-10',
        type: 'income',
        category: 'Alimentação',
        amountInCents: 50000,
      },
      {
        id: 't3',
        date: '2026-06-12',
        type: 'expense',
        category: 'Lazer',
        amountInCents: 8000,
      },
    ]

    const budgets = [
      {
        id: 'b1',
        startPeriod: '2026-01',
        endPeriod: '2026-06',
        category: 'Alimentação',
        plannedAmountInCents: 10000,
      },
      {
        id: 'b2',
        startPeriod: '2026-07',
        endPeriod: null,
        category: 'Casa',
        plannedAmountInCents: 20000,
      },
    ]

    const fetchMock = vi.fn(
      async (url, options = {}) => {
        if (url === `${API}/auth/me`) {
          return apiResponse(200, {
            user: {
              id: 'user-1',
              username: 'Teste',
            },
          })
        }

        if (
          url === `${API}/transactions` &&
          !options.method
        ) {
          return apiResponse(200, transactions)
        }

        if (
          url === `${API}/budgets` &&
          !options.method
        ) {
          return apiResponse(200, budgets)
        }

        throw new Error(`Requisição inesperada: ${url}`)
      },
    )

    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByRole('heading', {
      name: 'Visão geral',
    })

    expect(
      fetchMock.mock.calls.some(
        ([url]) => url === `${API}/budgets`,
      ),
    ).toBe(false)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Orçamento',
      }),
    )

    const monthInput =
      await screen.findByLabelText(
        'Mês de referência',
      )

    fireEvent.change(monthInput, {
      target: { value: '2026-06' },
    })

    await screen.findByText('Alimentação')

    const summary = screen.getByRole(
      'region',
      { name: 'Resumo do mês' },
    )

    expect(summary.textContent).toContain(
      formatCurrency(10000),
    )

    expect(summary.textContent).toContain(
      formatCurrency(15000),
    )

    expect(summary.textContent).toContain(
      formatCurrency(-5000),
    )

    expect(
      screen.getByText('Limite ultrapassado'),
    ).toBeTruthy()

    const progress = screen.getByRole(
      'progressbar',
      {
        name:
          'Alimentação: progresso de consumo',
      },
    )

    expect(
      progress.getAttribute('aria-valuenow'),
    ).toBe('100')

    expect(
      progress.getAttribute('aria-valuetext'),
    ).toBe('150% do limite utilizado')

    fireEvent.change(monthInput, {
      target: { value: '2026-07' },
    })

    await screen.findByText('Casa')

    expect(
      screen.queryByText('Alimentação'),
    ).toBeNull()

    expect(
    within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(20000))

    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === `${API}/budgets`,
      ),
    ).toHaveLength(1)
  })

  it('mostra erro do backend sem apresentar o estado vazio', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === `${API}/auth/me`) {
        return apiResponse(200, {
          user: {
            id: 'user-1',
            username: 'Teste',
          },
        })
      }

      if (url === `${API}/transactions`) {
        return apiResponse(200, [])
      }

      if (url === `${API}/budgets`) {
        return apiResponse(500, {
          error: 'Erro de banco.',
        })
      }

      throw new Error(`Requisição inesperada: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    vi.spyOn(console, 'error')
      .mockImplementation(() => {})

    render(<App />)

    await screen.findByRole('button', {
      name: 'Orçamento',
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Orçamento',
      }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain(
      'Não foi possível carregar os orçamentos.',
    )

    expect(
      screen.queryByText(
        'Nenhum orçamento vigente para o mês selecionado.',
      ),
    ).toBeNull()
  })
})
