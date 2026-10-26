
import { useState } from 'react'
import useBudgets from './useBudgets'
import BudgetForm from './BudgetForm'
import BudgetRuleActions from './BudgetRuleActions'
import { calculateMonthlyBudgetTracking } from './budgetCalculations'

const currencyFormatter = new Intl.NumberFormat(
  'pt-BR',
  {
    style: 'currency',
    currency: 'BRL',
  },
)

const percentageFormatter = new Intl.NumberFormat(
  'pt-BR',
  {
    maximumFractionDigits: 1,
  },
)

const monthFormatter = new Intl.DateTimeFormat(
  'pt-BR',
  {
    month: 'long',
    year: 'numeric',
  },
)

function formatCurrency(valueInCents) {
  return currencyFormatter.format(valueInCents / 100)
}

function formatPercentage(value) {
  return `${percentageFormatter.format(value)}%`
}

function formatMonth(period) {
  const [year, month] = period.split('-').map(Number)

  return monthFormatter.format(
    new Date(year, month - 1, 1),
  )
}

function formatValidity(budget) {
  const start = formatMonth(budget.startPeriod)

  if (budget.endPeriod === null) {
    return `Contínuo desde ${start}`
  }

  if (budget.endPeriod === budget.startPeriod) {
    return `Somente em ${start}`
  }

  return `De ${start} até ${formatMonth(budget.endPeriod)}`
}

function getBudgetStatus(item) {
  if (item.status === 'over_limit') {
    return 'Limite ultrapassado'
  }

  if (item.status === 'near_limit') {
    return item.usagePercentage >= 100
      ? 'Limite atingido'
      : 'Próximo do limite'
  }

  return 'Dentro do limite'
}

function getCurrentPeriod() {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
  ].join('-')
}

function BudgetsPage({
  transactions,
  isLoadingTransactions,
  transactionsLoadError,
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
  onBudgetSavingChange,
}) {

  const [selectedPeriod, setSelectedPeriod] =
    useState(getCurrentPeriod)

  const [isFormOpen, setIsFormOpen] =
    useState(false)

  const [editingBudget, setEditingBudget] =
    useState(null)

  const [isBudgetSaving, setIsBudgetSaving] =
    useState(false)

  const {
    budgets,
    isLoadingBudgets,
    budgetsLoadError,
    addBudget,
    updateBudget,
    deleteBudget,
    splitBudget,
  } = useBudgets({
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireSession,
  })

  function closeBudgetForm() {
    setIsFormOpen(false)
    setEditingBudget(null)
  }

  function openCreateForm() {
    setEditingBudget(null)
    setIsFormOpen(true)
  }

  function openEditForm(budget) {
    setEditingBudget(budget)
    setIsFormOpen(true)
  }

  async function saveBudget(operation) {
    setIsBudgetSaving(true)
    onBudgetSavingChange(true)

    try {
      return await operation()
    } finally {
      setIsBudgetSaving(false)
      onBudgetSavingChange(false)
    }
  }

  async function handleCreateBudget(budgetData) {
    return saveBudget(async () => {
      const created = await addBudget(budgetData)

      if (created !== null) {
        setSelectedPeriod(created.startPeriod)
        closeBudgetForm()
      }

      return created
    })
  }

  async function handleEditBudget(id, budgetData) {
    return saveBudget(async () => {
      const payload = {
        category: budgetData.category,
        plannedAmountInCents:
          budgetData.plannedAmountInCents,
        endPeriod: budgetData.endPeriod,
      }

      const isInheritedPeriod =
        selectedPeriod > editingBudget.startPeriod

      const result = isInheritedPeriod
        ? await splitBudget(id, {
          ...payload,
          splitPeriod: selectedPeriod,
        })
        : await updateBudget(id, payload)

      if (result !== null) {
        closeBudgetForm()
      }

      return result
    })
  }

  function handleEndBudget(budget, endPeriod) {
    return saveBudget(() =>
      updateBudget(budget.id, {
        category: budget.category,
        plannedAmountInCents:
          budget.plannedAmountInCents,
        endPeriod,
      }),
    )
  }

  function handleDeleteBudget(id) {
    return saveBudget(() => deleteBudget(id))
  }
  const isLoading =
    isLoadingTransactions || isLoadingBudgets

  const loadError =
    budgetsLoadError || transactionsLoadError

  const { items, summary } =
    calculateMonthlyBudgetTracking({
      transactions,
      budgets,
      period: selectedPeriod,
    })

  return (
    <main className="main-content" id="budgets">
      <header className="page-header">
        <h1>Orçamento</h1>
        <p>
          Acompanhe os limites mensais de gastos
          por categoria.
        </p>
      </header>

      <section
        className="budget-period-bar"
        aria-label="Período do orçamento"
      >
        <div className="form-field">
          <label htmlFor="budget-period">
            Mês de referência
          </label>

          <input
            id="budget-period"
            type="month"
            value={selectedPeriod}
            onChange={(event) =>
              setSelectedPeriod(event.target.value)
            }
            disabled={isFormOpen || isBudgetSaving}
          />
        </div>
      </section>

      {isLoading ? (
        <div className="empty-state" role="status">
          <p>Carregando orçamentos...</p>
        </div>
      ) : loadError ? (
        <div className="empty-state" role="alert">
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <div className="budget-actions">
            <button
              className="submit-button"
              type="button"
              onClick={openCreateForm}
              disabled={isFormOpen || isBudgetSaving}
            >
              Novo limite
            </button>
          </div>

          {isFormOpen && (
            <section
              className="panel budget-form-panel"
              aria-labelledby="budget-form-title"
            >
              <h2 id="budget-form-title">
                {editingBudget
                  ? selectedPeriod >
                    editingBudget.startPeriod
                    ? 'Alterar a partir deste mês'
                    : 'Editar limite'
                  : 'Novo limite'}
              </h2>

              <BudgetForm
                key={
                  editingBudget
                    ? `${editingBudget.id}-${selectedPeriod}`
                    : `new-${selectedPeriod}`
                }
                selectedPeriod={selectedPeriod}
                transactions={transactions}
                budget={editingBudget}
                onCreateBudget={handleCreateBudget}
                onEditBudget={handleEditBudget}
                onCancel={closeBudgetForm}
              />
            </section>
          )}

          <section
            className="panel budget-summary-panel"
            aria-labelledby="budget-summary-title"
          >
            <h2 id="budget-summary-title">
              Resumo do mês
            </h2>

            <div className="budget-summary-grid">
              <div className="budget-summary-item">
                <span>Planejado</span>
                <strong>
                  {formatCurrency(
                    summary.totalPlannedInCents,
                  )}
                </strong>
              </div>

              <div className="budget-summary-item">
                <span>Gasto</span>
                <strong>
                  {formatCurrency(
                    summary.totalSpentInCents,
                  )}
                </strong>
              </div>

              <div className="budget-summary-item">
                <span>Disponível</span>
                <strong
                  className={
                    summary.totalRemainingInCents < 0
                      ? 'transaction-expense'
                      : ''
                  }
                >
                  {formatCurrency(
                    summary.totalRemainingInCents,
                  )}
                </strong>
              </div>

              <div className="budget-summary-item">
                <span>Acima do limite</span>
                <strong
                  className={
                    summary.categoriesOverLimit > 0
                      ? 'transaction-expense'
                      : ''
                  }
                >
                  {summary.categoriesOverLimit}
                </strong>
              </div>
            </div>
          </section>

          <section
            className="panel budget-category-panel"
            aria-labelledby="budget-category-title"
          >
            <h2 id="budget-category-title">
              Limites por categoria
            </h2>

            {items.length === 0 ? (
              <div className="empty-state">
                <p>
                  Nenhum orçamento vigente para o
                  mês selecionado.
                </p>
              </div>
            ) : (
              <ul className="budget-category-list">
                {items.map((item) => {
                  const progress = Math.min(
                    100,
                    Math.max(
                      0,
                      item.usagePercentage,
                    ),
                  )

                  return (
                    <li
                      className="budget-category-item"
                      key={item.id}
                    >
                      <div className="budget-category-header">
                        <div>
                          <h3>{item.category}</h3>
                          <p>{formatValidity(item)}</p>
                        </div>

                        <span
                          className={
                            `budget-status budget-status-${item.status}`
                          }
                        >
                          {getBudgetStatus(item)}
                        </span>
                      </div>

                      <div className="budget-category-values">
                        <strong>
                          {formatCurrency(
                            item.spentInCents,
                          )}
                          {' de '}
                          {formatCurrency(
                            item.plannedAmountInCents,
                          )}
                        </strong>

                        <span>
                          {formatPercentage(
                            item.usagePercentage,
                          )}
                        </span>
                      </div>

                      <div
                        className="budget-progress-track"
                        role="progressbar"
                        aria-label={
                          `${item.category}: progresso de consumo`
                        }
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        aria-valuetext={
                          `${formatPercentage(
                            item.usagePercentage,
                          )} do limite utilizado`
                        }
                      >
                        <div
                          className={
                            `budget-progress-fill budget-progress-${item.status}`
                          }
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>

                      <p className="budget-remaining">
                        {item.remainingInCents >= 0
                          ? 'Disponível: '
                          : 'Ultrapassado em: '}

                        <strong>
                          {formatCurrency(
                            Math.abs(
                              item.remainingInCents,
                            ),
                          )}
                        </strong>
                      </p>
                      <BudgetRuleActions
                        budget={item}
                        selectedPeriod={selectedPeriod}
                        disabled={isFormOpen || isBudgetSaving}
                        onEdit={() => openEditForm(item)}
                        onEnd={(endPeriod) =>
                          handleEndBudget(item, endPeriod)
                        }
                        onDelete={() =>
                          handleDeleteBudget(item.id)
                        }
                      />

                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default BudgetsPage
