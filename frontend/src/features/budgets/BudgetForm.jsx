
import { useRef, useState } from 'react'

const DEFAULT_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Contas',
  'Assinaturas',
  'Compras',
  'Outros',
]

function normalizeCategoryKey(category) {
  return category
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

function getCategorySuggestions(transactions) {
  const suggestions = new Map()

  for (const category of DEFAULT_CATEGORIES) {
    suggestions.set(
      normalizeCategoryKey(category),
      category,
    )
  }

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') {
      continue
    }

    const category = String(
      transaction.category ?? '',
    ).trim().replace(/\s+/gu, ' ')

    const key = normalizeCategoryKey(category)

    if (!key || key === 'reserva') {
      continue
    }

    if (!suggestions.has(key)) {
      suggestions.set(key, category)
    }
  }

  return [...suggestions.values()].sort(
    (first, second) =>
      first.localeCompare(second, 'pt-BR'),
  )
}

function formatAmountForInput(amountInCents) {
  const whole = Math.floor(amountInCents / 100)
  const fraction = String(
    amountInCents % 100,
  ).padStart(2, '0')

  return `${whole},${fraction}`
}

function BudgetForm({
  selectedPeriod,
  transactions,
  budget = null,
  onCreateBudget,
  onEditBudget,
  onCancel,
}) {
  const isEditing = budget !== null

  const isInheritedPeriod =
    isEditing &&
    selectedPeriod > budget.startPeriod

  const [startPeriod, setStartPeriod] =
    useState(
      budget?.startPeriod ?? selectedPeriod,
    )

  const [duration, setDuration] =
    useState(
      budget?.endPeriod == null
        ? 'continuous'
        : 'temporary',
    )

  const effectiveStartPeriod =
    isInheritedPeriod
      ? selectedPeriod
      : startPeriod

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const submittingRef = useRef(false)

  const categorySuggestions =
    getCategorySuggestions(transactions)

  async function handleSubmit(event) {
    event.preventDefault()

    if (submittingRef.current) {
      return
    }

    const formData = new FormData(
      event.currentTarget,
    )

    const category = String(
      formData.get('category') ?? '',
    ).trim().replace(/\s+/gu, ' ')

    const amount = String(
      formData.get('amount') ?? '',
    ).trim()

    const endPeriod =
      duration === 'temporary'
        ? String(formData.get('endPeriod') ?? '')
        : null

    if (!startPeriod) {
      setError('Informe o mês inicial.')
      return
    }

    if (!category) {
      setError('Informe uma categoria.')
      return
    }

    if (Array.from(category).length > 100) {
      setError(
        'A categoria deve ter no máximo 100 caracteres.',
      )
      return
    }

    if (
      duration === 'temporary' &&
      (
        !endPeriod ||
        endPeriod < effectiveStartPeriod
      )
    ) {
      setError(
        isEditing
          ? 'O mês final não pode ser anterior ao início da alteração.'
          : 'O mês final não pode ser anterior ao mês inicial.',
      )
      return
    }

    if (!/^\d+([,.]\d{1,2})?$/.test(amount)) {
      setError(
        'Informe um valor como 500,00, sem separador de milhares.',
      )
      return
    }

    // Converte para centavos sem multiplicar um decimal.
    const [whole, fraction = ''] =
      amount.replace(',', '.').split('.')

    const plannedAmountInCents =
      Number(whole) * 100 +
      Number(fraction.padEnd(2, '0'))

    if (
      !Number.isSafeInteger(
        plannedAmountInCents,
      ) ||
      plannedAmountInCents <= 0
    ) {
      setError(
        'Informe um valor positivo dentro do limite permitido.',
      )
      return
    }

    const budgetData = {
      startPeriod,
      endPeriod,
      category,
      plannedAmountInCents,
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setError('')

    try {
      if (isEditing) {
        await onEditBudget(
          budget.id,
          budgetData,
        )
      } else {
        await onCreateBudget(
          budgetData,
        )
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          'Não foi possível salvar o limite.',
      )
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className="budget-form"
      onSubmit={handleSubmit}
      onChange={() => setError('')}
      aria-busy={isSubmitting}
    >
      {isEditing && (
        <p className="budget-edit-notice">
          {isInheritedPeriod
            ? `A alteração valerá a partir de ${selectedPeriod}. Os meses anteriores serão preservados.`
            : 'A alteração atualizará a regra desde seu mês inicial.'}
        </p>
      )}

      <div className="form-field">
        <label htmlFor="budget-category-input">
          Categoria do orçamento
        </label>

        <input
          id="budget-category-input"
          name="category"
          type="text"
          list="budget-category-suggestions"
          defaultValue={budget?.category ?? ''}
          placeholder="Ex.: Alimentação"
          maxLength={100}
          disabled={isSubmitting}
          required
        />

        <datalist id="budget-category-suggestions">
          {categorySuggestions.map((category) => (
            <option
              key={category}
              value={category}
            />
          ))}
        </datalist>

        <small>
          Selecione uma sugestão ou digite uma categoria.
        </small>
      </div>

      <div className="form-field">
        <label htmlFor="budget-amount-input">
          Valor mensal (R$)
        </label>

        <input
          id="budget-amount-input"
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={
            budget
              ? formatAmountForInput(
                  budget.plannedAmountInCents,
                )
              : ''
          }
          placeholder="500,00"
          maxLength={16}
          disabled={isSubmitting}
          required
        />

        <small>
          Sem separador de milhares. Exemplo: 1500,50.
        </small>
      </div>

      <div className="form-field">
        <label htmlFor="budget-start-input">
          {isEditing
            ? 'Mês inicial da regra'
            : 'Mês inicial'}
        </label>

        <input
          id="budget-start-input"
          type="month"
          name="startPeriod"
          value={startPeriod}
          onChange={(event) =>
            setStartPeriod(event.target.value)
          }
          disabled={isSubmitting || isEditing}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="budget-duration-input">
          Vigência
        </label>

        <select
          id="budget-duration-input"
          value={duration}
          onChange={(event) =>
            setDuration(event.target.value)
          }
          disabled={isSubmitting}
        >
          <option value="continuous">
            Contínuo
          </option>
          <option value="temporary">
            Temporário
          </option>
        </select>

        <small>
          {duration === 'continuous'
            ? 'Contínuo: válido desde o mês inicial, sem data final.'
            : 'Temporário: válido até o mês final, inclusive.'}
        </small>
      </div>

      {duration === 'temporary' && (
        <div className="form-field">
          <label htmlFor="budget-end-input">
            Mês final
          </label>

          <input
            id="budget-end-input"
            type="month"
            name="endPeriod"
            min={effectiveStartPeriod}
            defaultValue={
              budget?.endPeriod ?? ''
            }
            disabled={isSubmitting}
            required
          />
        </div>
      )}

      {error && (
        <p
          className="form-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="budget-form-actions">
        <button
          className="submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Salvando...'
            : isEditing
              ? 'Salvar alterações'
              : 'Cadastrar limite'}
        </button>

        <button
          className="budget-secondary-action"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default BudgetForm
