import { useState } from 'react'
import { calculateFinancialOverview } from '../financialOverview'
import { filterTransactionsByPeriod } from '../transactionSelectors'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

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
          </div>
        )}
      </section>
    </main>
  )
}

export default OverviewPage