import { describe, expect, it } from 'vitest'
import { calculateMonthlyBudgetTracking } from '../src/features/budgets/budgetCalculations'

function budget(id, category, plannedAmountInCents, startPeriod = '2026-01', endPeriod = null) {
  return { id, category, plannedAmountInCents, startPeriod, endPeriod }
}

function transaction(date, type, category, amountInCents) {
  return { date, type, category, amountInCents }
}

describe('calculateMonthlyBudgetTracking', () => {
  it('soma apenas despesas do mês e normaliza a categoria', () => {
    const result = calculateMonthlyBudgetTracking({
      period: '2026-09',
      budgets: [budget('a', 'Alimentação mensal', 50000)],
      transactions: [
        transaction('2026-09-01', 'expense', ' ALIMENTACAO    MENSAL ', 10000),
        transaction('2026-09-15', 'expense', 'Alimentação Mensal', 5000),
        transaction('2026-08-30', 'expense', 'Alimentação mensal', 4000),
        transaction('2026-09-15', 'income', 'Alimentação mensal', 100000),
        transaction('2026-09-15', 'expense', 'RÉSÉRVA', 9000),
        transaction('2026-09-15', 'expense', 'Lazer', 12000),
      ],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'a',
      spentInCents: 15000,
      remainingInCents: 35000,
      usagePercentage: 30,
      status: 'within_limit',
    })
    expect(result.summary).toEqual({
      totalPlannedInCents: 50000,
      totalSpentInCents: 15000,
      totalRemainingInCents: 35000,
      plannedCategories: 1,
      categoriesOverLimit: 0,
    })
  })

  it('aplica vigências inclusivas e mantém orçamento sem gasto', () => {
    const budgets = [
      budget('jan', 'Casa', 10000, '2026-01', '2026-03'),
      budget('abr', 'Casa', 15000, '2026-04', null),
      budget('passado', 'Lazer', 5000, '2025-01', '2025-12'),
      budget('futuro', 'Saúde', 7000, '2026-05', null),
    ]

    const march = calculateMonthlyBudgetTracking({ transactions: [], budgets, period: '2026-03' })
    const april = calculateMonthlyBudgetTracking({ transactions: [], budgets, period: '2026-04' })

    expect(march.items.map((item) => item.id)).toEqual(['jan'])
    expect(april.items.map((item) => item.id)).toEqual(['abr'])
    expect(april.items[0].spentInCents).toBe(0)
    expect(april.items[0].remainingInCents).toBe(15000)
  })

  it('respeita os limiares 80%, 100% e acima de 100%', () => {
    const budgets = [
      budget('below', 'Casa', 10000),
      budget('eighty', 'Saúde', 10000),
      budget('exact', 'Transporte', 10000),
      budget('over', 'Lazer', 10000),
    ]

    const transactions = [
      transaction('2026-02-01', 'expense', 'Casa', 7999),
      transaction('2026-02-01', 'expense', 'Saúde', 8000),
      transaction('2026-02-01', 'expense', 'Transporte', 10000),
      transaction('2026-02-01', 'expense', 'Lazer', 15000),
    ]

    const { items, summary } = calculateMonthlyBudgetTracking({
      transactions,
      budgets,
      period: '2026-02',
    })

    expect(items.map((item) => item.status)).toEqual([
      'within_limit',
      'near_limit',
      'near_limit',
      'over_limit',
    ])
    expect(items[0].usagePercentage).toBeCloseTo(79.99)
    expect(items[1].usagePercentage).toBe(80)
    expect(items[2].usagePercentage).toBe(100)
    expect(items[3].usagePercentage).toBe(150)
    expect(items[3].remainingInCents).toBe(-5000)
    expect(summary).toEqual({
      totalPlannedInCents: 40000,
      totalSpentInCents: 40999,
      totalRemainingInCents: -999,
      plannedCategories: 4,
      categoriesOverLimit: 1,
    })
  })

  it('produz um resumo zerado sem orçamentos vigentes', () => {
    expect(
      calculateMonthlyBudgetTracking({
        transactions: [transaction('2027-01-01', 'expense', 'Casa', 10000)],
        budgets: [budget('a', 'Casa', 5000, '2026-01', '2026-12')],
        period: '2027-01',
      }),
    ).toEqual({
      items: [],
      summary: {
        totalPlannedInCents: 0,
        totalSpentInCents: 0,
        totalRemainingInCents: 0,
        plannedCategories: 0,
        categoriesOverLimit: 0,
      },
    })
  })

  it('rejeita um valor planejado inválido em vez de apresentar um percentual incorreto', () => {
    expect(() =>
      calculateMonthlyBudgetTracking({
        period: '2026-01',
        transactions: [],
        budgets: [budget('a', 'Casa', 0)],
      }),
    ).toThrow(RangeError)
  })
})