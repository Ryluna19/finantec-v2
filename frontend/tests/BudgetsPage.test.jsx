
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
  fireEvent,
  render,
  screen,
  waitFor,
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

function mockBudgetEditApi(initialBudget, onMutation) {
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

      if (url === `${API}/transactions`) {
        return apiResponse(200, [])
      }

      if (
        url === `${API}/budgets` &&
        !options.method
      ) {
        return apiResponse(200, [initialBudget])
      }

      return onMutation(url, options)
    },
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
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


it('edita a regra original usando PUT', async () => {
  const original = {
    id: 'b1',
    startPeriod: '2026-06',
    endPeriod: null,
    category: 'Alimentação',
    plannedAmountInCents: 10000,
  }

  const fetchMock = mockBudgetEditApi(
    original,
    async (url, options) => {
      if (
        url === `${API}/budgets/b1` &&
        options.method === 'PUT'
      ) {
        return apiResponse(200, {
          ...original,
          plannedAmountInCents: 20000,
        })
      }

      throw new Error(`Requisição inesperada: ${url}`)
    },
  )

  render(<App />)

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Orçamento',
    }),
  )

  fireEvent.change(
    await screen.findByLabelText('Mês de referência'),
    { target: { value: '2026-06' } },
  )

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Editar limite de Alimentação',
    }),
  )

  expect(
    screen.getByRole('heading', {
      name: 'Editar limite',
    }),
  ).toBeTruthy()

  expect(
    screen.getByLabelText('Valor mensal (R$)').value,
  ).toBe('100,00')

  fireEvent.change(
    screen.getByLabelText('Valor mensal (R$)'),
    { target: { value: '200,00' } },
  )

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Salvar alterações',
    }),
  )

  const summary = screen.getByRole(
    'region',
    { name: 'Resumo do mês' },
  )

  await waitFor(() => {
    expect(
      within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(20000))
  })

  const updateCall = fetchMock.mock.calls.find(
    ([url, options]) =>
      url === `${API}/budgets/b1` &&
      options.method === 'PUT',
  )

  expect(updateCall).toBeTruthy()

  expect(JSON.parse(updateCall[1].body)).toEqual({
    category: 'Alimentação',
    plannedAmountInCents: 20000,
    endPeriod: null,
  })

  expect(
    screen.queryByRole('heading', {
      name: 'Editar limite',
    }),
  ).toBeNull()
})

it('divide um orçamento em mês posterior sem alterar os meses anteriores', async () => {
  const original = {
    id: 'b1',
    startPeriod: '2026-06',
    endPeriod: null,
    category: 'Alimentação',
    plannedAmountInCents: 10000,
  }

  const fetchMock = mockBudgetEditApi(
    original,
    async (url, options) => {
      if (
        url === `${API}/budgets/b1/split` &&
        options.method === 'POST'
      ) {
        return apiResponse(201, {
          previousBudget: {
            ...original,
            endPeriod: '2026-06',
          },
          createdBudget: {
            ...original,
            id: 'b2',
            startPeriod: '2026-07',
            plannedAmountInCents: 30000,
          },
        })
      }

      throw new Error(`Requisição inesperada: ${url}`)
    },
  )

  render(<App />)

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Orçamento',
    }),
  )

  const monthInput =
    await screen.findByLabelText('Mês de referência')

  fireEvent.change(monthInput, {
    target: { value: '2026-07' },
  })

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Editar limite de Alimentação',
    }),
  )

  expect(
    screen.getByRole('heading', {
      name: 'Alterar a partir deste mês',
    }),
  ).toBeTruthy()

  expect(
    screen.getByText(
      /Os meses anteriores serão preservados/,
    ),
  ).toBeTruthy()

  fireEvent.change(
    screen.getByLabelText('Valor mensal (R$)'),
    { target: { value: '300,00' } },
  )

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Salvar alterações',
    }),
  )

  const summary = screen.getByRole(
    'region',
    { name: 'Resumo do mês' },
  )

  await waitFor(() => {
    expect(
      within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(30000))
  })

  const splitCall = fetchMock.mock.calls.find(
    ([url, options]) =>
      url === `${API}/budgets/b1/split` &&
      options.method === 'POST',
  )

  expect(splitCall).toBeTruthy()

  expect(JSON.parse(splitCall[1].body)).toEqual({
    splitPeriod: '2026-07',
    category: 'Alimentação',
    plannedAmountInCents: 30000,
    endPeriod: null,
  })

  fireEvent.change(monthInput, {
    target: { value: '2026-06' },
  })

  await waitFor(() => {
    expect(
      within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(10000))
  })
})


it('bloqueia a navegação enquanto um orçamento é salvo', async () => {
  const original = {
    id: 'b1',
    startPeriod: '2026-06',
    endPeriod: null,
    category: 'Alimentação',
    plannedAmountInCents: 10000,
  }

  const updated = {
    ...original,
    plannedAmountInCents: 20000,
  }

  let persistedBudget = original
  let resolvePut
  let budgetsGetCount = 0

  const fetchMock = vi.fn((url, options = {}) => {
    if (url === `${API}/auth/me`) {
      return Promise.resolve(
        apiResponse(200, {
          user: {
            id: 'user-1',
            username: 'Teste',
          },
        }),
      )
    }

    if (url === `${API}/transactions`) {
      return Promise.resolve(
        apiResponse(200, []),
      )
    }

    if (
      url === `${API}/budgets` &&
      !options.method
    ) {
      budgetsGetCount += 1

      return Promise.resolve(
        apiResponse(200, [persistedBudget]),
      )
    }

    if (
      url === `${API}/budgets/b1` &&
      options.method === 'PUT'
    ) {
      return new Promise((resolve) => {
        resolvePut = resolve
      })
    }

    throw new Error(
      `Requisição inesperada: ${options.method ?? 'GET'} ${url}`,
    )
  })

  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Orçamento',
    }),
  )

  fireEvent.change(
    await screen.findByLabelText(
      'Mês de referência',
    ),
    {
      target: { value: '2026-06' },
    },
  )

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Editar limite de Alimentação',
    }),
  )

  fireEvent.change(
    screen.getByLabelText('Valor mensal (R$)'),
    {
      target: { value: '200,00' },
    },
  )

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Salvar alterações',
    }),
  )

  const overviewButton = screen.getByRole(
    'button',
    { name: 'Visão geral' },
  )

  await waitFor(() => {
    expect(overviewButton.disabled).toBe(true)
  })

  expect(
    screen.getByRole('button', {
      name: 'Transações',
    }).disabled,
  ).toBe(true)

  expect(
    screen.getByRole('button', {
      name: 'Sair',
    }).disabled,
  ).toBe(false)

  // A tentativa de sair não deve desmontar BudgetsPage.
  fireEvent.click(overviewButton)

  expect(
    screen.getByRole('heading', {
      name: 'Orçamento',
    }),
  ).toBeTruthy()

  // Simula o banco concluindo a gravação.
  await act(async () => {
    persistedBudget = updated
    resolvePut(apiResponse(200, updated))
  })

  const summary = screen.getByRole(
    'region',
    { name: 'Resumo do mês' },
  )

  await waitFor(() => {
    expect(
      within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(20000))

    expect(overviewButton.disabled).toBe(false)
  })


  // Agora pode navegar e voltar normalmente.
  fireEvent.click(overviewButton)

  expect(
    screen.getByRole('heading', {
      name: 'Visão geral',
    }),
  ).toBeTruthy()

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Orçamento',
    }),
  )

  // Espera a página voltar a aparecer.
  const refreshedMonthInput =
    await screen.findByLabelText(
      'Mês de referência',
    )

  // Seleciona novamente o mês editado.
  fireEvent.change(refreshedMonthInput, {
    target: { value: '2026-06' },
  })

  // Verifica se a nova instância carregou o valor atualizado.
  await waitFor(() => {
    const refreshedSummary = screen.getByRole(
      'region',
      { name: 'Resumo do mês' },
    )

    expect(
      within(refreshedSummary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(20000))
  })

  // Um GET inicial e outro após voltar à página.
  expect(budgetsGetCount).toBe(2)

})


it('preserva a vigência ao dividir um orçamento temporário', async () => {
  const original = {
    id: 'b1',
    startPeriod: '2026-06',
    endPeriod: '2026-08',
    category: 'Alimentação',
    plannedAmountInCents: 10000,
  }

  const previousBudget = {
    ...original,
    endPeriod: '2026-06',
  }

  const createdBudget = {
    ...original,
    id: 'b2',
    startPeriod: '2026-07',
    plannedAmountInCents: 25000,
  }

  const fetchMock = mockBudgetEditApi(
    original,
    async (url, options) => {
      if (
        url === `${API}/budgets/b1/split` &&
        options.method === 'POST'
      ) {
        return apiResponse(201, {
          previousBudget,
          createdBudget,
        })
      }

      throw new Error(
        `Requisição inesperada: ${url}`,
      )
    },
  )

  render(<App />)

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Orçamento',
    }),
  )

  const monthInput =
    await screen.findByLabelText(
      'Mês de referência',
    )

  fireEvent.change(monthInput, {
    target: { value: '2026-07' },
  })

  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Editar limite de Alimentação',
    }),
  )

  expect(
    screen.getByRole('heading', {
      name: 'Alterar a partir deste mês',
    }),
  ).toBeTruthy()

  expect(
    screen.getByLabelText('Vigência').value,
  ).toBe('temporary')

  expect(
    screen.getByLabelText('Mês final').value,
  ).toBe('2026-08')

  expect(
    screen.getByLabelText(
      'Mês inicial da regra',
    ).disabled,
  ).toBe(true)

  fireEvent.change(
    screen.getByLabelText('Valor mensal (R$)'),
    { target: { value: '250,00' } },
  )

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Salvar alterações',
    }),
  )

  await waitFor(() => {
    const summary = screen.getByRole(
      'region',
      { name: 'Resumo do mês' },
    )

    expect(
      within(summary)
        .getByText('Planejado')
        .parentElement.textContent,
    ).toContain(formatCurrency(25000))
  })

  const splitCall = fetchMock.mock.calls.find(
    ([url, options]) =>
      url === `${API}/budgets/b1/split` &&
      options.method === 'POST',
  )

  expect(splitCall).toBeTruthy()

  expect(JSON.parse(splitCall[1].body)).toEqual({
    splitPeriod: '2026-07',
    category: 'Alimentação',
    plannedAmountInCents: 25000,
    endPeriod: '2026-08',
  })

  // Junho deve manter a regra original.
  fireEvent.change(monthInput, {
    target: { value: '2026-06' },
  })

  const summary = screen.getByRole(
    'region',
    { name: 'Resumo do mês' },
  )

  expect(
    within(summary)
      .getByText('Planejado')
      .parentElement.textContent,
  ).toContain(formatCurrency(10000))

  // Agosto ainda utiliza o novo limite.
  fireEvent.change(monthInput, {
    target: { value: '2026-08' },
  })

  expect(
    within(summary)
      .getByText('Planejado')
      .parentElement.textContent,
  ).toContain(formatCurrency(25000))

  // Setembro está fora da vigência.
  fireEvent.change(monthInput, {
    target: { value: '2026-09' },
  })

  expect(
    screen.getByText(
      'Nenhum orçamento vigente para o mês selecionado.',
    ),
  ).toBeTruthy()

  expect(
    fetchMock.mock.calls.some(
      ([url, options]) =>
        url === `${API}/budgets/b1` &&
        options.method === 'PUT',
    ),
  ).toBe(false)
})

})
