import { describe, expect, it } from 'vitest'
import { filterTransactionsByPeriod } from './transactionSelectors'

describe('filterTransactionsByPeriod', () => {
  const transactions = [
    {
      id: '1',
      date: '2026-09-15',
    },
    {
      id: '2',
      date: '2026-10-05',
    },
    {
      id: '3',
      date: '2025-09-20',
    },
    {
      id: '4',
      date: '2030-09-10',
    },
  ]

  it('filters transactions by year and month', () => {
    expect(
      filterTransactionsByPeriod(
        transactions,
        2026,
        9,
      ).map((transaction) => transaction.id),
    ).toEqual(['1'])
  })

  it('accepts all months for the selected year', () => {
    expect(
      filterTransactionsByPeriod(
        transactions,
        2026,
        'all',
      ).map((transaction) => transaction.id),
    ).toEqual(['1', '2'])
  })

  it('does not exclude future years', () => {
    expect(
      filterTransactionsByPeriod(
        transactions,
        2030,
        9,
      ).map((transaction) => transaction.id),
    ).toEqual(['4'])
  })
})
