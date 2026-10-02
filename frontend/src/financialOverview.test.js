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

    expect(result).toEqual({
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
})