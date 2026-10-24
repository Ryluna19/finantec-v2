
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

function mockBudgetCreationApi(onPost) {
  const fetchMock = vi.fn(
    async (url, options = {}) => {
      if (
        url === `${API}/auth/me` &&
        !options.method
      ) {
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
        return apiResponse(200, [])
      }

      if (
        url === `${API}/budgets` &&
        !options.method
      ) {
        return apiResponse(200, [])
      }

      if (
        url === `${API}/budgets` &&
        options.method === 'POST'
      ) {
        return onPost(options)
      }

      throw new Error(
        `Requisição inesperada: ${options.method ?? 'GET'} ${url}`,
      )
    },
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

async function openBudgetCreationForm() {
  render(<App />)

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Orçamento',
    }),
  )

  await screen.findByText(
    'Nenhum orçamento vigente para o mês selecionado.',
  )

  fireEvent.change(
    screen.getByLabelText('Mês de referência'),
    {
      target: { value: '2026-06' },
    },
  )

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Novo limite',
    }),
  )
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


  it('cadastra um limite contínuo e atualiza o resumo sem novo GET', async () => {
    const fetchMock = mockBudgetCreationApi(
      async (options) => {
        const payload = JSON.parse(options.body)

        return apiResponse(201, {
          id: 'budget-created',
          ...payload,
        })
      },
    )

    await openBudgetCreationForm()

    fireEvent.change(
      screen.getByLabelText('Categoria do orçamento'),
      {
        target: { value: '  Alimentação  ' },
      },
    )

    fireEvent.change(
      screen.getByLabelText('Valor mensal (R$)'),
      {
        target: { value: '500,25' },
      },
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cadastrar limite',
      }),
    )

    await screen.findByText('Alimentação')

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === `${API}/budgets` &&
        options.method === 'POST',
    )

    expect(postCall).toBeTruthy()

    expect(postCall[1].credentials).toBe(
      'include',
    )

    expect(JSON.parse(postCall[1].body)).toEqual({
      startPeriod: '2026-06',
      endPeriod: null,
      category: 'Alimentação',
      plannedAmountInCents: 50025,
    })

    const summary = screen.getByRole(
      'region',
      { name: 'Resumo do mês' },
    )

    expect(summary.textContent).toContain(
      formatCurrency(50025),
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Novo limite',
      }),
    ).toBeNull()

    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          url === `${API}/budgets` &&
          !options.method,
      ),
    ).toHaveLength(1)
  })

  it('valida a vigência temporária e envia o mês final', async () => {
    const fetchMock = mockBudgetCreationApi(
      async (options) => {
        return apiResponse(201, {
          id: 'budget-temporary',
          ...JSON.parse(options.body),
        })
      },
    )

    await openBudgetCreationForm()

    fireEvent.change(
      screen.getByLabelText('Categoria do orçamento'),
      {
        target: { value: 'Saúde' },
      },
    )

    fireEvent.change(
      screen.getByLabelText('Valor mensal (R$)'),
      {
        target: { value: '200,00' },
      },
    )

    fireEvent.change(
      screen.getByLabelText('Vigência'),
      {
        target: { value: 'temporary' },
      },
    )

    fireEvent.change(
      screen.getByLabelText('Mês final'),
      {
        target: { value: '2026-05' },
      },
    )

    const form = screen.getByRole(
      'button',
      { name: 'Cadastrar limite' },
    ).closest('form')

    fireEvent.submit(form)

    expect(
      screen.getByRole('alert').textContent,
    ).toContain(
      'O mês final não pode ser anterior ao mês inicial.',
    )

    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          url === `${API}/budgets` &&
          options.method === 'POST',
      ),
    ).toHaveLength(0)

    fireEvent.change(
      screen.getByLabelText('Mês final'),
      {
        target: { value: '2026-08' },
      },
    )

    fireEvent.submit(form)

    await screen.findByText('Saúde')

    const postCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === `${API}/budgets` &&
        options.method === 'POST',
    )

    expect(JSON.parse(postCall[1].body)).toEqual({
      startPeriod: '2026-06',
      endPeriod: '2026-08',
      category: 'Saúde',
      plannedAmountInCents: 20000,
    })
  })

  it('mantém o formulário aberto quando o backend retorna conflito 409', async () => {
    mockBudgetCreationApi(
      async () =>
        apiResponse(409, {
          error:
            'Já existe um orçamento para essa categoria em parte do período informado.',
        }),
    )

    await openBudgetCreationForm()

    fireEvent.change(
      screen.getByLabelText('Categoria do orçamento'),
      {
        target: { value: 'Lazer' },
      },
    )

    fireEvent.change(
      screen.getByLabelText('Valor mensal (R$)'),
      {
        target: { value: '300,00' },
      },
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cadastrar limite',
      }),
    )

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain(
      'Já existe um orçamento para essa categoria',
    )

    expect(
      screen.getByRole('heading', {
        name: 'Novo limite',
      }),
    ).toBeTruthy()

    expect(
      screen.getByText(
        'Nenhum orçamento vigente para o mês selecionado.',
      ),
    ).toBeTruthy()
  })

})
