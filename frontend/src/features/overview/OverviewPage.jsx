import { useState } from 'react'
import { calculateFinancialOverview } from './financialOverview'
import { filterTransactionsByPeriod } from '../transactions/transactionSelectors'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const percentageFormatter = new Intl.NumberFormat(
  'pt-BR',
  {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
)

const months = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

function formatCurrency(amountInCents) {
  return currencyFormatter.format(
    amountInCents / 100,
  )
}

function formatPercentage(value) {
  return `${percentageFormatter.format(value)}%`
}

function OverviewPage({
  transactions,
  isLoadingTransactions,
  transactionsLoadError,
}) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const [selectedYear, setSelectedYear] =
    useState(currentYear)

  const [selectedMonth, setSelectedMonth] =
    useState(currentMonth)

  const availableYears = [
    ...new Set([
      currentYear,
      ...transactions.map((transaction) =>
        Number(transaction.date.slice(0, 4)),
      ),
    ]),
  ].sort((first, second) => second - first)

  const periodTransactions =
    filterTransactionsByPeriod(
      transactions,
      selectedYear,
      selectedMonth,
    )

  const overview =
    calculateFinancialOverview(
      periodTransactions,
    )

  const monthlyEvolutionMaximumInCents =
    Math.max(
      0,
      ...overview.monthlyEvolution.flatMap(
        (month) => [
          month.incomeInCents,
          month.expenseInCents,
        ],
      ),
    )

  const largestCategoryAmountInCents =
    overview.expenseCategories[0]
      ?.amountInCents ?? 0

  function handleYearChange(year) {
    setSelectedYear(year)

    setSelectedMonth(
      year === currentYear
        ? currentMonth
        : 'all',
    )
  }

  const balanceClass =
    overview.balanceInCents > 0
      ? 'transaction-income'
      : overview.balanceInCents < 0
        ? 'transaction-expense'
        : ''

  let financialInsight = ''

  if (overview.incomeInCents > 0) {
    const consumptionPercentage =
      formatPercentage(
        overview.consumptionPercentage,
      )

    const reservePercentage =
      formatPercentage(
        overview.reservePercentage,
      )

    if (overview.balanceInCents > 0) {
      financialInsight =
        `O consumo ficou em ${consumptionPercentage} da renda ` +
        `e a reserva em ${reservePercentage}. ` +
        `Sobra de ${formatCurrency(
          overview.balanceInCents,
        )} no período.`
    } else if (overview.balanceInCents < 0) {
      financialInsight =
        `O consumo ficou em ${consumptionPercentage} da renda ` +
        `e a reserva em ${reservePercentage}. ` +
        `Déficit de ${formatCurrency(
          Math.abs(overview.balanceInCents),
        )} no período.`
    } else {
      financialInsight =
        `O consumo ficou em ${consumptionPercentage} da renda ` +
        `e a reserva em ${reservePercentage}. ` +
        'O período fechou sem sobra financeira.'
    }
  } else if (overview.totalExpenseInCents > 0) {
    financialInsight =
      'Não houve receitas no período. ' +
      `As despesas totalizaram ${formatCurrency(
        overview.totalExpenseInCents,
      )}.`
  }

  return (
    <main
      className="main-content"
      id="overview"
    >
      <header className="page-header">
        <div>
          <h1>Visão geral</h1>

          <p>
            Acompanhe sua situação financeira no
            período selecionado.
          </p>
        </div>
      </header>

      <section
        className="overview-period-bar"
        aria-labelledby="overview-period-title"
      >
        <h2 id="overview-period-title">
          Período analisado
        </h2>

        <div
          className="overview-period-filters"
          aria-label="Período da visão geral"
        >
          <div className="form-field">
            <label htmlFor="overview-year">
              Ano
            </label>

            <select
              id="overview-year"
              value={selectedYear}
              onChange={(event) =>
                handleYearChange(
                  Number(event.target.value),
                )
              }
            >
              {availableYears.map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="overview-month">
              Mês
            </label>

            <select
              id="overview-month"
              value={selectedMonth}
              onChange={(event) => {
                const value = event.target.value

                setSelectedMonth(
                  value === 'all'
                    ? 'all'
                    : Number(value),
                )
              }}
            >
              <option value="all">
                Ano inteiro
              </option>

              {months.map((month) => (
                <option
                  key={month.value}
                  value={month.value}
                >
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

       <div className="overview-primary-panels">
        <section
          className="panel overview-financial-panel"
          aria-labelledby="overview-summary-title"
        >
        <h2 id="overview-summary-title">
          Resumo financeiro
        </h2>

        {isLoadingTransactions ? (
          <div
            className="empty-state"
            role="status"
          >
            <p>Carregando visão geral...</p>
          </div>
        ) : transactionsLoadError ? (
          <div
            className="empty-state"
            role="alert"
          >
            <p>{transactionsLoadError}</p>
          </div>
        ) : periodTransactions.length === 0 ? (
          <div className="empty-state">
            <p>
              Não há transações registradas para o
              período selecionado.
            </p>
          </div>
        ) : (
          <div
            className="overview-financial-content"
            aria-label="Resumo financeiro do período"
          >
            <div className="overview-balance">
              <span className="overview-balance-label">
                Saldo do período
              </span>

              <strong
                className={`overview-balance-value ${balanceClass}`}
              >
                {formatCurrency(
                  overview.balanceInCents,
                )}
              </strong>
            </div>

            {financialInsight && (
              <p
                className={`overview-financial-insight ${
                  overview.balanceInCents < 0
                    ? 'overview-financial-insight-negative'
                    : ''
                }`}
              >
                {financialInsight}
              </p>
            )}

            <div className="overview-support-grid">
              <div className="overview-support-item">
                <span className="summary-label">
                  Receitas
                </span>

                <strong className="transaction-income">
                  {formatCurrency(
                    overview.incomeInCents,
                  )}
                </strong>
              </div>

              <div className="overview-support-item">
                <span className="summary-label">
                  Consumo
                </span>

                <strong className="transaction-expense">
                  {formatCurrency(
                    overview.consumptionInCents,
                  )}
                </strong>
              </div>

              <div className="overview-support-item">
                <span className="summary-label">
                  Reserva
                </span>

                <strong>
                  {formatCurrency(
                    overview.reserveInCents,
                  )}
                </strong>
              </div>
            </div>

            <div
              className="overview-indicators"
              aria-label="Indicadores do período"
            >
              <div className="overview-indicator-item">
                <span className="summary-label">
                  Transações
                </span>

                <strong>
                  {overview.transactionCount}
                </strong>
              </div>

              <div className="overview-indicator-item">
                <span className="summary-label">
                  Gasto médio
                </span>

                <strong>
                  {formatCurrency(
                    overview.averageExpenseInCents,
                  )}
                </strong>
              </div>

              <div className="overview-indicator-item">
                <span className="summary-label">
                  Renda reservada
                </span>

                <strong>
                  {formatPercentage(
                    overview.reservePercentage,
                  )}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {!isLoadingTransactions &&
        !transactionsLoadError &&
        periodTransactions.length > 0 &&
        selectedMonth === 'all' && (
          <section
            className="panel"
            aria-labelledby="overview-evolution-title"
          >
            <h2 id="overview-evolution-title">
              Evolução mensal
            </h2>

            <p className="overview-section-description overview-evolution-legend">
              <span className="overview-evolution-legend-item">
                <span
                  className="overview-evolution-legend-swatch overview-evolution-income"
                  aria-hidden="true"
                />
                Receitas
              </span>

              <span className="overview-evolution-legend-item">
                <span
                  className="overview-evolution-legend-swatch overview-evolution-expense"
                  aria-hidden="true"
                />
                Despesas (inclui Reserva)
              </span>
            </p>

            <ol
              className="overview-evolution-chart"
              aria-label="Evolução mensal de receitas e despesas"
            >
              {overview.monthlyEvolution.map(
                ({
                  month,
                  incomeInCents,
                  expenseInCents,
                }) => {
                  const monthLabel =
                    months[month - 1]?.label ??
                    String(month)

                  const incomeHeight =
                    monthlyEvolutionMaximumInCents >
                    0
                      ? (incomeInCents /
                          monthlyEvolutionMaximumInCents) *
                        100
                      : 0

                  const expenseHeight =
                    monthlyEvolutionMaximumInCents >
                    0
                      ? (expenseInCents /
                          monthlyEvolutionMaximumInCents) *
                        100
                      : 0

                  const accessibleLabel =
                    `${monthLabel}: ` +
                    `Receitas ${formatCurrency(
                      incomeInCents,
                    )}; ` +
                    `Despesas ${formatCurrency(
                      expenseInCents,
                    )}`

                  return (
                    <li
                      className="overview-evolution-month"
                      key={month}
                      aria-label={accessibleLabel}
                      title={accessibleLabel}
                    >
                      <div
                        className="overview-evolution-bars"
                        aria-hidden="true"
                      >
                        <span
                          className="overview-evolution-bar overview-evolution-income"
                          style={{
                            height: `${incomeHeight}%`,
                          }}
                        />

                        <span
                          className="overview-evolution-bar overview-evolution-expense"
                          style={{
                            height: `${expenseHeight}%`,
                          }}
                        />
                      </div>

                      <span
                        className="summary-label"
                        aria-hidden="true"
                      >
                        {monthLabel.slice(0, 3)}
                      </span>
                    </li>
                  )
                },
              )}
            </ol>
         </section>
        )}
      </div>

      {!isLoadingTransactions &&
        !transactionsLoadError &&
        overview.expenseCategories.length > 0 && (
          <section
            className="panel overview-categories-panel"
            aria-labelledby="overview-categories-title"
          >
            <h2 id="overview-categories-title">
              Gastos por categoria
            </h2>

            <p className="overview-section-description">
              Distribuição do consumo no período,
              sem considerar a reserva.
            </p>

            <div className="overview-category-list">
              {overview.expenseCategories.map(
                ({ category, amountInCents }) => {
                  const widthPercentage =
                    largestCategoryAmountInCents > 0
                      ? (amountInCents /
                          largestCategoryAmountInCents) *
                        100
                      : 0

                  return (
                    <div
                      className="overview-category-item"
                      key={category}
                    >
                      <div className="overview-category-header">
                        <span>{category}</span>

                        <strong>
                          {formatCurrency(
                            amountInCents,
                          )}
                        </strong>
                      </div>

                      <div
                        className="overview-category-track"
                        aria-hidden="true"
                      >
                        <div
                          className="overview-category-bar"
                          style={{
                            width: `${widthPercentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </section>
        )}
    </main>
  )
}

export default OverviewPage