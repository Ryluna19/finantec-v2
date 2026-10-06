import { useState } from 'react'

const currencyFormatter = new Intl.NumberFormat(
  'pt-BR',
  {
    style: 'currency',
    currency: 'BRL',
  },
)

function TransactionImport({
  onPreviewImport,
  onImportTransactions,
}) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const [
    includeDuplicates,
    setIncludeDuplicates,
  ] = useState(false)

  const [isPreviewing, setIsPreviewing] =
    useState(false)

  const [isImporting, setIsImporting] =
    useState(false)

  const [error, setError] = useState('')
  const [resultMessage, setResultMessage] =
    useState('')

  const [inputVersion, setInputVersion] =
    useState(0)

  function handleFileChange(event) {
    const selectedFile =
      event.target.files?.[0] ?? null

    setFile(selectedFile)
    setPreview(null)
    setIncludeDuplicates(false)
    setError('')
    setResultMessage('')
  }

  async function handlePreview() {
    if (!file || isPreviewing) {
      return
    }

    setIsPreviewing(true)
    setError('')
    setResultMessage('')

    try {
      const result =
        await onPreviewImport(file)

      if (result === null) {
        return
      }

      setPreview(result)
    } catch (previewError) {
      setPreview(null)

      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Não foi possível preparar a importação.',
      )
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleImport() {
    if (
      !file ||
      !preview ||
      isImporting
    ) {
      return
    }

    setIsImporting(true)
    setError('')

    try {
      const result =
        await onImportTransactions(
          file,
          includeDuplicates,
        )

      if (result === null) {
        return
      }

      setResultMessage(
        [
          `Importação concluída: ${result.insertedCount} transação(ões) adicionada(s).`,
          result.skippedDuplicateCount > 0
            ? `${result.skippedDuplicateCount} possível(is) duplicata(s) ignorada(s).`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      )

      setFile(null)
      setPreview(null)
      setIncludeDuplicates(false)

      setInputVersion(
        (previous) => previous + 1,
      )
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Não foi possível concluir a importação.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  const canConfirm =
    preview &&
    preview.rejectedCount === 0 &&
    preview.validCount > 0 &&
    (
      preview.defaultImportCount > 0 ||
      (
        includeDuplicates &&
        preview.possibleDuplicateCount > 0
      )
    )

  return (
    <section
      className="panel"
      aria-labelledby="transaction-import-title"
    >
      <h2 id="transaction-import-title">
        Importar transações
      </h2>

      <p className="prototype-notice">
        Envie um arquivo CSV no formato do
        FinanTec para adicionar transações em lote.
      </p>

      <div className="transaction-import-controls">
        <div className="form-field">
          <label htmlFor="transaction-import-file">
            Arquivo CSV
          </label>

          <input
            key={inputVersion}
            id="transaction-import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />
        </div>

        <button
          type="button"
          disabled={
            !file ||
            isPreviewing ||
            isImporting
          }
          onClick={handlePreview}
        >
          {isPreviewing
            ? 'Analisando...'
            : 'Analisar arquivo'}
        </button>
      </div>

      {error && (
        <div
          className="empty-state"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {resultMessage && (
        <div
          className="empty-state"
          role="status"
        >
          <p>{resultMessage}</p>
        </div>
      )}

      {preview && (
        <div className="transaction-import-preview">
          <div className="transaction-summary">
            <div className="summary-card">
              <span className="summary-label">
                Linhas
              </span>

              <strong>
                {preview.totalRows}
              </strong>
            </div>

            <div className="summary-card">
              <span className="summary-label">
                Válidas
              </span>

              <strong className="import-count-valid">
                {preview.validCount}
              </strong>
            </div>

            <div className="summary-card">
              <span className="summary-label">
                Com erro
              </span>

              <strong className="import-count-rejected">
                {preview.rejectedCount}
              </strong>
            </div>

            <div className="summary-card">
              <span className="summary-label">
                Possíveis duplicatas
              </span>

              <strong className="import-count-duplicate">
                {
                  preview.possibleDuplicateCount
                }
              </strong>
            </div>
          </div>

          {preview.validRows.length > 0 && (
            <details>
              <summary>
                Ver linhas válidas
              </summary>

              <div className="transaction-table-container">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.validRows
                      .slice(0, 20)
                      .map((transaction) => (
                        <tr
                          key={
                            transaction.rowNumber
                          }
                        >
                          <td>
                            {
                              transaction.rowNumber
                            }
                          </td>

                          <td>
                            {transaction.date}
                          </td>

                          <td>
                            {transaction.type ===
                            'income'
                              ? 'Receita'
                              : 'Despesa'}
                          </td>

                          <td>
                            {
                              transaction.description
                            }
                          </td>

                          <td>
                            {
                              transaction.category
                            }
                          </td>

                          <td>
                            {currencyFormatter.format(
                              transaction.amountInCents /
                                100,
                            )}
                          </td>

                          <td>
                            {transaction.isPossibleDuplicate ? (
                                <span className="import-status-duplicate">
                                Possível duplicata
                                </span>
                            ) : (
                                'Nova'
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {preview.validRows.length > 20 && (
                <p className="prototype-notice">
                  Exibindo as primeiras 20 de{' '}
                  {preview.validRows.length} linhas
                  válidas.
                </p>
              )}
            </details>
          )}

          {preview.rejectedRows.length > 0 && (
            <details open>
              <summary>
                Ver linhas com erro
              </summary>

              <div className="transaction-table-container">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Descrição</th>
                      <th>Motivos</th>
                    </tr>
                  </thead>

                  <tbody>
                    {preview.rejectedRows
                      .slice(0, 20)
                      .map((transaction) => (
                        <tr
                          key={
                            transaction.rowNumber
                          }
                        >
                          <td>
                            {
                              transaction.rowNumber
                            }
                          </td>

                          <td>
                            {transaction.description ||
                              '—'}
                          </td>

                          <td>
                            {transaction.reasons.join(
                              '; ',
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {preview.possibleDuplicateCount >
            0 && (
            <label className="transaction-import-duplicates">
              <input
                type="checkbox"
                checked={includeDuplicates}
                onChange={(event) =>
                  setIncludeDuplicates(
                    event.target.checked,
                  )
                }
              />

              Importar também as possíveis
              duplicatas
            </label>
          )}

          {preview.rejectedCount > 0 && (
            <p className="form-error">
              Corrija as linhas com erro e envie o
              arquivo novamente antes de confirmar.
            </p>
          )}

          <button
            type="button"
            disabled={
              !canConfirm ||
              isImporting ||
              isPreviewing
            }
            onClick={handleImport}
          >
            {isImporting
              ? 'Importando...'
              : `Confirmar importação (${includeDuplicates ? preview.validCount : preview.defaultImportCount})`}
          </button>
        </div>
      )}
    </section>
  )
}

export default TransactionImport