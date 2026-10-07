import { describe, expect, it } from 'vitest'

import { serializeTransactionsToCsv } from '../src/features/transactions/transactionExport'

describe('transaction export', () => {
  it('serializes transactions using the FinanTec CSV contract', () => {
    const csv = serializeTransactionsToCsv([
      {
        id: '11111111-1111-4111-8111-111111111111',
        userId:
          '22222222-2222-4222-8222-222222222222',
        date: '2026-10-06',
        type: 'income',
        description: 'Salário',
        category: 'Trabalho',
        amountInCents: 150000,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        date: '2026-10-07',
        type: 'expense',
        description: 'Mercado',
        category: 'Alimentação',
        amountInCents: 5590,
      },
    ])

    expect(csv).toBe(
      '\uFEFF' +
        'DATA,TIPO,DESCRIÇÃO,CATEGORIA,VALOR\r\n' +
        '2026-10-06,receita,Salário,Trabalho,1500.00\r\n' +
        '2026-10-07,despesa,Mercado,Alimentação,55.90\r\n',
    )

    expect(csv).not.toContain(
      '11111111-1111-4111-8111-111111111111',
    )

    expect(csv).not.toContain(
      '22222222-2222-4222-8222-222222222222',
    )
  })

  it('escapes commas, quotes and line breaks inside text fields', () => {
    const csv = serializeTransactionsToCsv([
      {
        date: '2026-10-06',
        type: 'expense',
        description:
          'Mercado, "Centro"\nCompra semanal',
        category: 'Casa, alimentação',
        amountInCents: 1099,
      },
    ])

    expect(csv).toContain(
      '"Mercado, ""Centro""\nCompra semanal"',
    )

    expect(csv).toContain(
      '"Casa, alimentação"',
    )
  })

  it.each(['=', '+', '-', '@'])(
    'protects description and category starting with %s from spreadsheet formulas',
    (prefix) => {
      const csv = serializeTransactionsToCsv([
        {
          date: '2026-10-06',
          type: 'expense',
          description: `${prefix}2+2`,
          category: `${prefix}categoria`,
          amountInCents: 1000,
        },
      ])

      expect(csv).toContain(
        `"\t${prefix}2+2"`,
      )

      expect(csv).toContain(
        `"\t${prefix}categoria"`,
      )
    },
  )

  it('does not prefix ordinary text with a tab', () => {
    const csv = serializeTransactionsToCsv([
      {
        date: '2026-10-06',
        type: 'expense',
        description: 'Descrição segura',
        category: 'Categoria segura',
        amountInCents: 1000,
      },
    ])

    expect(csv).toContain(
      ',Descrição segura,Categoria segura,10.00',
    )

    expect(csv).not.toContain('\tDescrição segura')
    expect(csv).not.toContain('\tCategoria segura')
  })
})