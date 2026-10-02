import { useState } from 'react'
import TransactionForm from './TransactionForm'
import TransactionFilters from './TransactionFilters'
import TransactionList from './TransactionList'
import TransactionSummary from './TransactionSummary'
import useTransactionFilters from '../hooks/useTransactionFilters'
import useTransactions from '../hooks/useTransactions'
import { filterTransactionsByPeriod } from '../transactionSelectors'

function TransactionsPage({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
  onLogout,
}) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const [editingTransaction, setEditingTransaction] =
    useState(null)

  const {
    transactions,
    isLoadingTransactions,
    transactionsLoadError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions({
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireSession,
  })

  const {
    selectedYear,
    selectedMonth,
    selectedType,
    selectedCategory,
    descriptionQuery,
    updateSelectedType,
    updateSelectedCategory,
    updateDescriptionQuery,
    handleYearChange,
    handleMonthChange,
    reconcileFilters,
  } = useTransactionFilters({
    currentYear,
    currentMonth,
  })

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

  const availableTypes = [
    ...new Set(
      periodTransactions.map(
        (transaction) => transaction.type,
      ),
    ),
  ].sort()

  const availableCategories = [
    ...new Set(
      periodTransactions.map(
        (transaction) => transaction.category,
      ),
    ),
  ].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  )

  const normalizedDescriptionQuery =
    descriptionQuery
      .trim()
      .toLocaleLowerCase('pt-BR')

  const filteredTransactions =
    periodTransactions.filter((transaction) => {
      if (
        selectedType !== 'all' &&
        transaction.type !== selectedType
      ) {
        return false
      }

      if (
        selectedCategory !== 'all' &&
        transaction.category !==
          selectedCategory
      ) {
        return false
      }

      if (
        normalizedDescriptionQuery &&
        !transaction.description
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedDescriptionQuery)
      ) {
        return false
      }

      return true
    })

  const transactionSummary =
    filteredTransactions.reduce(
      (summary, transaction) => {
        summary.transactionCount += 1

        if (transaction.type === 'income') {
          summary.incomeInCents +=
            transaction.amountInCents
        }

        if (transaction.type === 'expense') {
          summary.expenseInCents +=
            transaction.amountInCents
        }

        return summary
      },
      {
        transactionCount: 0,
        incomeInCents: 0,
        expenseInCents: 0,
      },
    )

  async function handleUpdateTransaction(
    id,
    transactionData,
  ) {
    const nextTransactions =
      await updateTransaction(
        id,
        transactionData,
      )

    if (nextTransactions === null) {
      return
    }

    reconcileFilters(nextTransactions)

    setEditingTransaction((current) =>
      current?.id === id ? null : current,
    )
  }

  async function handleDeleteTransaction(id) {
    const nextTransactions =
      await deleteTransaction(id)

    if (nextTransactions === null) {
      return
    }

    reconcileFilters(nextTransactions)

    setEditingTransaction((current) =>
      current?.id === id ? null : current,
    )
  }

  const emptyTransactionMessage =
    periodTransactions.length === 0
      ? 'Nenhuma transação encontrada para o período selecionado.'
      : 'Nenhuma transação corresponde aos filtros selecionados.'

  return (
    <main
      className="main-content"
      id="transactions"
    >
      <header className="page-header">
        <div>
          <h1>Transações</h1>
          <p>
            Organize suas receitas, despesas e reservas.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
        >
          Sair
        </button>
      </header>

      <section
        className="panel"
        aria-labelledby="new-transaction-title"
      >
        <h2 id="new-transaction-title">
          {editingTransaction
            ? 'Editar transação'
            : 'Nova transação'}
        </h2>

        <p className="prototype-notice">
          Ambiente em desenvolvimento com persistência local.
        </p>

        <TransactionForm
          key={editingTransaction?.id ?? 'new'}
          transaction={editingTransaction}
          onAddTransaction={addTransaction}
          onUpdateTransaction={
            handleUpdateTransaction
          }
          onCancelEdit={() =>
            setEditingTransaction(null)
          }
        />
      </section>

      <section
        className="panel"
        aria-labelledby="transactions-title"
      >
        <h2 id="transactions-title">
          Movimentações
        </h2>

        {isLoadingTransactions ? (
          <div
            className="empty-state"
            role="status"
          >
            <p>Carregando transações...</p>
          </div>
        ) : (
          <>
            {transactionsLoadError && (
              <div
                className="empty-state"
                role="alert"
              >
                <p>{transactionsLoadError}</p>
              </div>
            )}

            {(!transactionsLoadError ||
              transactions.length > 0) && (
                <>
                  <TransactionFilters
                    years={availableYears}
                    types={availableTypes}
                    categories={
                      availableCategories
                    }
                    selectedYear={selectedYear}
                    selectedMonth={
                      selectedMonth
                    }
                    selectedType={selectedType}
                    selectedCategory={
                      selectedCategory
                    }
                    descriptionQuery={
                      descriptionQuery
                    }
                    onYearChange={
                      handleYearChange
                    }
                    onMonthChange={
                      handleMonthChange
                    }
                    onTypeChange={
                      updateSelectedType
                    }
                    onCategoryChange={
                      updateSelectedCategory
                    }
                    onDescriptionChange={
                      updateDescriptionQuery
                    }
                    showAdditionalFilters={
                      periodTransactions.length >
                      0
                    }
                  />

                  {periodTransactions.length >
                    0 && (
                    <TransactionSummary
                      transactionCount={
                        transactionSummary.transactionCount
                      }
                      incomeInCents={
                        transactionSummary.incomeInCents
                      }
                      expenseInCents={
                        transactionSummary.expenseInCents
                      }
                    />
                  )}

                  <TransactionList
                    transactions={
                      filteredTransactions
                    }
                    onEditTransaction={
                      setEditingTransaction
                    }
                    onDeleteTransaction={
                      handleDeleteTransaction
                    }
                    emptyMessage={
                      emptyTransactionMessage
                    }
                  />
                </>
              )}
          </>
        )}
      </section>
    </main>
  )
}

export default TransactionsPage