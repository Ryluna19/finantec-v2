import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidBudgetPeriod,
  normalizeBudgetCategoryKey,
  validateBudgetInput,
} from '../src/budgetValidation.js'

test('validates and normalizes a continuous budget', () => {
  const result = validateBudgetInput({
    startPeriod: '2026-01',
    endPeriod: null,
    category:
      '  ALIMENTAÇÃO   Mensal  ',
    plannedAmountInCents: 100000,
  })

  assert.deepEqual(result, {
    budget: {
      startPeriod: '2026-01',
      endPeriod: null,
      category: 'ALIMENTAÇÃO Mensal',
      categoryKey:
        'alimentacao mensal',
      plannedAmountInCents: 100000,
    },
  })
})

test('normalizes category keys ignoring case and diacritics', () => {
  assert.equal(
    normalizeBudgetCategoryKey(
      '  Alimentação  ',
    ),
    'alimentacao',
  )

  assert.equal(
    normalizeBudgetCategoryKey(
      'ALIMENTACAO',
    ),
    'alimentacao',
  )
})

test('rejects invalid periods and an end before the start', () => {
  assert.equal(
    isValidBudgetPeriod('2026-13'),
    false,
  )

  assert.deepEqual(
    validateBudgetInput({
      startPeriod: '2026-13',
      category: 'Casa',
      plannedAmountInCents: 1000,
    }),
    {
      error:
        'Informe um mês inicial válido.',
    },
  )

  assert.deepEqual(
    validateBudgetInput({
      startPeriod: '2026-05',
      endPeriod: '2026-04',
      category: 'Casa',
      plannedAmountInCents: 1000,
    }),
    {
      error:
        'O mês final não pode ser anterior ao mês inicial.',
    },
  )
})

test('rejects Reserva after category normalization', () => {
  assert.deepEqual(
    validateBudgetInput({
      startPeriod: '2026-01',
      category: '  RÉSERVA  ',
      plannedAmountInCents: 1000,
    }),
    {
      error:
        'A categoria Reserva não pode ter orçamento.',
    },
  )
})

test('rejects invalid planned amounts', () => {
  for (const plannedAmountInCents of [
    0,
    -1,
    10.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.deepEqual(
      validateBudgetInput({
        startPeriod: '2026-01',
        category: 'Casa',
        plannedAmountInCents,
      }),
      {
        error:
          'Informe um valor positivo dentro do limite permitido.',
      },
    )
  }
})