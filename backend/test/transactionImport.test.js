import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseCanonicalTransactionCsv,
  splitTransactionsByDuplicateMatch,
} from '../src/transactionImport.js'

test('parses and normalizes a valid canonical CSV', () => {
  const csv = [
    '\uFEFF DATA , TIPO , DESCRIÇÃO , CATEGORIA , VALOR',
    '2026-10-05, Receita ," Bolsa, estágio ", Trabalho ,1600.005',
    '2027-01-10,despesa,Mercado,Alimentação,200.00',
  ].join('\n')

  const result =
    parseCanonicalTransactionCsv(csv)

  assert.equal(result.totalRows, 2)
  assert.equal(result.rejectedRows.length, 0)

  assert.deepEqual(result.validRows, [
    {
      rowNumber: 2,
      date: '2026-10-05',
      type: 'income',
      description: 'Bolsa, estágio',
      category: 'Trabalho',
      amountInCents: 160001,
    },
    {
      rowNumber: 3,
      date: '2027-01-10',
      type: 'expense',
      description: 'Mercado',
      category: 'Alimentação',
      amountInCents: 20000,
    },
  ])
})

test('collects multiple rejection reasons for an invalid row', () => {
  const csv = [
    'data,tipo,descricao,categoria,valor',
    'data-invalida,,   ,,abc',
  ].join('\n')

  const result =
    parseCanonicalTransactionCsv(csv)

  assert.equal(result.totalRows, 1)
  assert.equal(result.validRows.length, 0)
  assert.equal(result.rejectedRows.length, 1)

  assert.deepEqual(
    result.rejectedRows[0].reasons,
    [
      'data invalida ou vazia',
      'descricao vazia',
      'categoria vazia',
      'tipo vazio',
      'valor invalido ou vazio',
    ],
  )
})

test('matches duplicate occurrences as a multiset', () => {
  const transaction = {
    rowNumber: 2,
    date: '2026-10-05',
    type: 'expense',
    description: 'Mercado',
    category: 'Alimentação',
    amountInCents: 20000,
  }

  const importedTransactions = [
    transaction,
    {
      ...transaction,
      rowNumber: 3,
    },
  ]

  const existingTransactions = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      date: '2026-10-05',
      type: 'expense',
      description: 'Mercado',
      category: 'Alimentação',
      amountInCents: 20000,
    },
  ]

  const result =
    splitTransactionsByDuplicateMatch(
      importedTransactions,
      existingTransactions,
    )

  assert.equal(
    result.matchingTransactions.length,
    1,
  )

  assert.equal(
    result.matchingTransactions[0].rowNumber,
    2,
  )

  assert.equal(
    result.newTransactions.length,
    1,
  )

  assert.equal(
    result.newTransactions[0].rowNumber,
    3,
  )
})