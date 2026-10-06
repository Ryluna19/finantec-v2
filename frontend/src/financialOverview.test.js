import { describe, expect, it } from 'vitest'
import { calculateFinancialOverview } from './financialOverview'

describe('calculateFinancialOverview', () => {
  it('separates consumption, reserve and available balance', () => {
    const result = calculateFinancialOverview([
      {
        type: 'income',
        category: 'Trabalho',
        amountInCents: 500000,
      },
      {
        type: 'expense',
        category: 'Casa',
        amountInCents: 120000,
      },
      {
        type: 'expense',
        category: 'Reserva',
        amountInCents: 100000,
      },
    ])

    expect(result).toMatchObject({
        incomeInCents: 500000,
        totalExpenseInCents: 220000,
        consumptionInCents: 120000,
        reserveInCents: 100000,
        balanceInCents: 280000,
        largestExpenseCategory: 'Casa',
        largestExpenseCategoryInCents: 120000,
    })
  })

  it('recognizes reserve ignoring surrounding spaces and case', () => {
    const result = calculateFinancialOverview([
      {
        type: 'expense',
        category: '  RESERVA  ',
        amountInCents: 75000,
      },
    ])

    expect(result.reserveInCents).toBe(75000)
    expect(result.consumptionInCents).toBe(0)
    expect(result.largestExpenseCategory).toBeNull()
  })

  it('finds the largest consumption category', () => {
    const result = calculateFinancialOverview([
      {
        type: 'expense',
        category: 'Casa',
        amountInCents: 5000,
      },
      {
        type: 'expense',
        category: 'Lazer',
        amountInCents: 3000,
      },
      {
        type: 'expense',
        category: 'Casa',
        amountInCents: 4000,
      },
      {
        type: 'expense',
        category: 'Reserva',
        amountInCents: 20000,
      },
    ])

    expect(result.largestExpenseCategory).toBe(
      'Casa',
    )

    expect(
      result.largestExpenseCategoryInCents,
    ).toBe(9000)
  })

  it('calculates period indicators', () => {
  const result = calculateFinancialOverview([
    {
      type: 'income',
      category: 'Trabalho',
      amountInCents: 500000,
    },
    {
      type: 'expense',
      category: 'Casa',
      amountInCents: 120000,
    },
    {
      type: 'expense',
      category: 'Reserva',
      amountInCents: 100000,
    },
    {
      type: 'expense',
      category: 'Lazer',
      amountInCents: 30000,
    },
  ])

  expect(result.transactionCount).toBe(4)
  expect(result.expenseTransactionCount).toBe(3)

  expect(result.averageExpenseInCents).toBe(
    250000 / 3,
  )

  expect(result.consumptionPercentage).toBe(30)
  expect(result.reservePercentage).toBe(20)
})

it('returns consumption categories sorted by amount', () => {
  const result = calculateFinancialOverview([
    {
      type: 'expense',
      category: 'Alimentação',
      amountInCents: 30000,
    },
    {
      type: 'expense',
      category: 'Moradia',
      amountInCents: 90000,
    },
    {
      type: 'expense',
      category: 'Alimentação',
      amountInCents: 20000,
    },
    {
      type: 'expense',
      category: 'Transporte',
      amountInCents: 15000,
    },
    {
      type: 'expense',
      category: 'Reserva',
      amountInCents: 100000,
    },
  ])

  expect(result.expenseCategories).toEqual([
    {
      category: 'Moradia',
      amountInCents: 90000,
    },
    {
      category: 'Alimentação',
      amountInCents: 50000,
    },
    {
      category: 'Transporte',
      amountInCents: 15000,
    },
  ])
    })
    it('calculates monthly income and expenses', () => {
    const result = calculateFinancialOverview([
        {
        date: '2026-01-10',
        type: 'income',
        category: 'Trabalho',
        amountInCents: 500000,
        },
        {
        date: '2026-01-15',
        type: 'expense',
        category: 'Casa',
        amountInCents: 120000,
        },
        {
        date: '2026-02-05',
        type: 'income',
        category: 'Freelance',
        amountInCents: 100000,
        },
        {
        date: '2026-02-10',
        type: 'expense',
        category: 'Reserva',
        amountInCents: 50000,
        },
    ])

    expect(result.monthlyEvolution[0]).toEqual({
        month: 1,
        incomeInCents: 500000,
        expenseInCents: 120000,
    })

    expect(result.monthlyEvolution[1]).toEqual({
        month: 2,
        incomeInCents: 100000,
        expenseInCents: 50000,
    })

    expect(result.monthlyEvolution[2]).toEqual({
        month: 3,
        incomeInCents: 0,
        expenseInCents: 0,
    })

    expect(result.monthlyEvolution).toHaveLength(12)
    })
})