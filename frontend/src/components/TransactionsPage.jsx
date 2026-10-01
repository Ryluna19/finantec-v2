import { useEffect, useRef, useState } from 'react'
import TransactionForm from './TransactionForm'
import TransactionFilters from './TransactionFilters'
import TransactionList from './TransactionList'
import TransactionSummary from './TransactionSummary'
import useTransactionFilters from '../hooks/useTransactionFilters'
import { filterTransactionsByPeriod } from '../transactionSelectors'

function sortTransactions(transactionList) {
  return [...transactionList].sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      second.id.localeCompare(first.id),
  )
}

function TransactionsPage({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
  onLogout,
}) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const [transactions, setTransactions] = useState([])
  const [editingTransaction, setEditingTransaction] =
    useState(null)

  const [isLoadingTransactions, setIsLoadingTransactions] =
    useState(true)

  const [transactionsLoadError, setTransactionsLoadError] =
    useState(null)

  const transactionsRef = useRef([])
  const mutationVersionRef = useRef(0)

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

  useEffect(() => {
    let isActive = true

    async function loadTransactions() {
      const authGenerationAtStart =
        captureAuthGeneration()

      const mutationVersionAtStart =
        mutationVersionRef.current

      setIsLoadingTransactions(true)
      setTransactionsLoadError(null)

      try {
        const response = await fetch(
          'http://localhost:3000/transactions',
          {
            credentials: 'include',
          },
        )

        if (
          !isActive ||
          !isCurrentAuthGeneration(
            authGenerationAtStart,
          )
        ) {
          return
        }

        if (response.status === 401) {
          expireSession(authGenerationAtStart)
          return
        }

        if (!response.ok) {
          throw new Error(
            'Não foi possível carregar as transações.',
          )
        }

        const data = await response.json()

        if (
          !isActive ||
          !isCurrentAuthGeneration(
            authGenerationAtStart,
          ) ||
          mutationVersionRef.current !==
            mutationVersionAtStart
        ) {
          return
        }

        transactionsRef.current = data
        setTransactions(data)
      } catch (error) {
        if (
          !isActive ||
          !isCurrentAuthGeneration(
            authGenerationAtStart,
          ) ||
          mutationVersionRef.current !==
            mutationVersionAtStart
        ) {
          return
        }

        console.error(error)

        setTransactionsLoadError(
          'Não foi possível carregar as transações.',
        )
      } finally {
        if (
          isActive &&
          isCurrentAuthGeneration(
            authGenerationAtStart,
          )
        ) {
          setIsLoadingTransactions(false)
        }
      }
    }

    loadTransactions()

    return () => {
      isActive = false
    }
  }, [
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireSession,
  ])

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

  function updateTransactions(updater) {
    const nextTransactions =
      typeof updater === 'function'
        ? updater(transactionsRef.current)
        : updater

    transactionsRef.current = nextTransactions
    mutationVersionRef.current += 1

    setTransactions(nextTransactions)

    return nextTransactions
  }

  async function handleAddTransaction(
    transactionData,
  ) {
    const authGenerationAtStart =
      captureAuthGeneration()

    try {
      const response = await fetch(
        'http://localhost:3000/transactions',
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
        },
      )

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      if (response.status === 401) {
        expireSession(authGenerationAtStart)
        return
      }

      const data = await response.json()

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Não foi possível cadastrar a transação.',
        )
      }

      updateTransactions((previous) =>
        sortTransactions([data, ...previous]),
      )
    } catch (error) {
      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      throw error
    }
  }

  async function handleUpdateTransaction(
    id,
    transactionData,
  ) {
    const authGenerationAtStart =
      captureAuthGeneration()

    try {
      const response = await fetch(
        `http://localhost:3000/transactions/${id}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
        },
      )

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      if (response.status === 401) {
        expireSession(authGenerationAtStart)
        return
      }

      const data = await response.json()

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Não foi possível atualizar a transação.',
        )
      }

      const nextTransactions =
        updateTransactions((previous) =>
          sortTransactions(
            previous.map((transaction) =>
              transaction.id === id
                ? data
                : transaction,
            ),
          ),
        )

      reconcileFilters(nextTransactions)

      setEditingTransaction((current) =>
        current?.id === id ? null : current,
      )
    } catch (error) {
      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      throw error
    }
  }

  async function handleDeleteTransaction(id) {
    const authGenerationAtStart =
      captureAuthGeneration()

    try {
      const response = await fetch(
        `http://localhost:3000/transactions/${id}`,
        {
          credentials: 'include',
          method: 'DELETE',
        },
      )

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      if (response.status === 401) {
        expireSession(authGenerationAtStart)
        return
      }

      if (!response.ok) {
        let message =
          'Não foi possível excluir a transação.'

        try {
          const data = await response.json()

          if (
            !isCurrentAuthGeneration(
              authGenerationAtStart,
            )
          ) {
            return
          }

          message = data.error || message
        } catch {
          if (
            !isCurrentAuthGeneration(
              authGenerationAtStart,
            )
          ) {
            return
          }

          // Mantém a mensagem padrão se a resposta não possuir JSON válido.
        }

        throw new Error(message)
      }

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      const nextTransactions =
        updateTransactions((previous) =>
          previous.filter(
            (transaction) =>
              transaction.id !== id,
          ),
        )

      reconcileFilters(nextTransactions)

      setEditingTransaction((current) =>
        current?.id === id ? null : current,
      )
    } catch (error) {
      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return
      }

      throw error
    }
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
          onAddTransaction={
            handleAddTransaction
          }
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