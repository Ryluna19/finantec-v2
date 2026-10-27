import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import TransactionImport from '../src/features/transactions/TransactionImport'

afterEach(() => {
  cleanup()
})

it('keeps the selected CSV paired with its preview while requests are pending', async () => {
  let resolvePreview
  let resolveImport

  const pendingPreview = new Promise((resolve) => {
    resolvePreview = resolve
  })

  const pendingImport = new Promise((resolve) => {
    resolveImport = resolve
  })

  const onPreviewImport = vi.fn(() => pendingPreview)
  const onImportTransactions = vi.fn(() => pendingImport)

  const fileA = new File(['arquivo A'], 'a.csv', { type: 'text/csv' })
  const fileB = new File(['arquivo B'], 'b.csv', { type: 'text/csv' })

  render(
    <TransactionImport
      onPreviewImport={onPreviewImport}
      onImportTransactions={onImportTransactions}
    />,
  )

  const fileInput = screen.getByLabelText('Arquivo CSV')

  fireEvent.change(fileInput, { target: { files: [fileA] } })
  fireEvent.click(screen.getByRole('button', { name: 'Analisar arquivo' }))

  expect(onPreviewImport).toHaveBeenCalledWith(fileA)
  expect(fileInput.disabled).toBe(true)

  fireEvent.change(fileInput, { target: { files: [fileB] } })

  await act(async () => {
    resolvePreview({
      totalRows: 1,
      validCount: 1,
      rejectedCount: 0,
      possibleDuplicateCount: 0,
      defaultImportCount: 1,
      validRows: [{
        rowNumber: 2,
        date: '2026-10-15',
        type: 'income',
        description: 'Transação do arquivo A',
        category: 'Trabalho',
        amountInCents: 10000,
        isPossibleDuplicate: false,
      }],
      rejectedRows: [],
      canConfirm: true,
    })
    await pendingPreview
  })

  expect(screen.getByText('Transação do arquivo A')).toBeTruthy()
  expect(fileInput.disabled).toBe(false)

  const confirmButton = screen.getByRole('button', {
    name: 'Confirmar importação (1)',
  })

  expect(confirmButton.disabled).toBe(false)
  fireEvent.click(confirmButton)

  expect(onImportTransactions).toHaveBeenCalledExactlyOnceWith(fileA, false)
  expect(fileInput.disabled).toBe(true)

  fireEvent.change(fileInput, { target: { files: [fileB] } })

  await act(async () => {
    resolveImport({ insertedCount: 1, skippedDuplicateCount: 0 })
    await pendingImport
  })

  expect(screen.getByText(
    'Importação concluída: 1 transação(ões) adicionada(s).',
  )).toBeTruthy()

  const nextFileInput = screen.getByLabelText('Arquivo CSV')

  expect(nextFileInput.disabled).toBe(false)
  fireEvent.change(nextFileInput, { target: { files: [fileB] } })
  expect(screen.getByRole('button', { name: 'Analisar arquivo' }).disabled).toBe(false)
  expect(screen.queryByText('Transação do arquivo A')).toBeNull()
})
