
import { useState } from 'react'

function getPreviousPeriod(period) {
  const [year, month] = period.split('-').map(Number)

  if (month === 1) {
    return `${String(year - 1).padStart(4, '0')}-12`
  }

  return [
    String(year).padStart(4, '0'),
    String(month - 1).padStart(2, '0'),
  ].join('-')
}

function BudgetRuleActions({
  budget,
  selectedPeriod,
  disabled,
  onEdit,
  onEnd,
  onDelete,
}) {
  const [confirmation, setConfirmation] =
    useState(null)

  const [error, setError] = useState('')

  const canEnd =
    selectedPeriod > budget.startPeriod

  function requestConfirmation(action) {
    setError('')
    setConfirmation(action)
  }

  function cancelConfirmation() {
    setConfirmation(null)
    setError('')
  }

  async function handleConfirm() {
    if (!confirmation || disabled) {
      return
    }

    try {
      const result =
        confirmation === 'end'
          ? await onEnd(
              getPreviousPeriod(selectedPeriod),
            )
          : await onDelete()

      if (result !== null) {
        cancelConfirmation()
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          'Não foi possível concluir a operação.',
      )
    }
  }

  return (
    <div className="budget-rule-actions">
      <div className="budget-category-actions">
        <button
          className="budget-secondary-action"
          type="button"
          disabled={disabled}
          onClick={() => {
            cancelConfirmation()
            onEdit()
          }}
          aria-label={
            `Editar limite de ${budget.category}`
          }
        >
          Editar limite
        </button>

        {canEnd && (
          <button
            className="budget-secondary-action"
            type="button"
            disabled={disabled}
            onClick={() =>
              requestConfirmation('end')
            }
            aria-label={
              `Encerrar limite de ${budget.category} a partir de ${selectedPeriod}`
            }
          >
            Encerrar a partir deste mês
          </button>
        )}

        <button
          className="budget-secondary-action budget-delete-action"
          type="button"
          disabled={disabled}
          onClick={() =>
            requestConfirmation('delete')
          }
          aria-label={
            `Excluir regra de ${budget.category}`
          }
        >
          Excluir regra
        </button>
      </div>

      {confirmation && (
        <div
          className="budget-rule-confirmation"
          role="group"
          aria-label={
            `Confirmar ${
              confirmation === 'end'
                ? 'encerramento'
                : 'exclusão'
            } de ${budget.category}`
          }
        >
          {confirmation === 'end' ? (
            <p>
              Este limite deixará de valer a
              partir de {selectedPeriod}.
              A regra terminará em{' '}
              {getPreviousPeriod(selectedPeriod)}.
              Os meses anteriores serão preservados.
            </p>
          ) : (
            <p>
              Excluir definitivamente esta regra
              de {budget.category}?
              Isso removerá seu histórico de
              limites, mas não apagará transações.
            </p>
          )}

          <div className="budget-confirmation-actions">
            <button
              className="budget-secondary-action"
              type="button"
              disabled={disabled}
              onClick={handleConfirm}
            >
              {confirmation === 'end'
                ? 'Confirmar encerramento'
                : 'Confirmar exclusão'}
            </button>

            <button
              className="budget-secondary-action"
              type="button"
              disabled={disabled}
              onClick={cancelConfirmation}
            >
              Cancelar
            </button>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default BudgetRuleActions
