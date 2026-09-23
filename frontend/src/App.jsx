import { useEffect, useRef, useState } from 'react'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import TransactionFilters from './components/TransactionFilters'
import TransactionSummary from './components/TransactionSummary'
import './App.css'

function App() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [editingTransaction, setEditingTransaction] = useState(null)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedType, setSelectedType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [descriptionQuery, setDescriptionQuery] = useState('')
  const transactionsRef = useRef([])

  const filtersRef = useRef({
    year: currentYear,
    month: currentMonth,
    type: 'all',
    category: 'all',
    description: '',
  })

  useEffect(() => {
    async function loadTransactions() {
      try {
        const response = await fetch('http://localhost:3000/transactions')

        if (!response.ok) {
          throw new Error('Não foi possível carregar as transações.')
        }

        const data = await response.json()
        transactionsRef.current = data
        setTransactions(data)
      } catch (error) {
        console.error(error)
      }
    }

    loadTransactions()
  }, [])

  const availableYears = [
    ...new Set([
      currentYear,
      ...transactions.map((transaction) =>
        Number(transaction.date.slice(0, 4)),
      ),
    ]),
  ].sort((first, second) => second - first)

  const periodTransactions = transactions.filter((transaction) => {
    const transactionYear = Number(transaction.date.slice(0, 4))
    const transactionMonth = Number(transaction.date.slice(5, 7))

    if (transactionYear !== selectedYear) {
      return false
    }

    if (
      selectedMonth !== 'all' &&
      transactionMonth !== selectedMonth
    ) {
      return false
    }

    return true
  })

  const availableTypes = [
    ...new Set(
      periodTransactions.map((transaction) => transaction.type),
    ),
  ].sort()

  const availableCategories = [
    ...new Set(
      periodTransactions.map((transaction) => transaction.category),
    ),
  ].sort((first, second) =>
    first.localeCompare(second, 'pt-BR'),
  )

  const normalizedDescriptionQuery = descriptionQuery
    .trim()
    .toLocaleLowerCase('pt-BR')

  const filteredTransactions = periodTransactions.filter((transaction) => {
    if (
      selectedType !== 'all' &&
      transaction.type !== selectedType
    ) {
      return false
    }

    if (
      selectedCategory !== 'all' &&
      transaction.category !== selectedCategory
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

  const transactionSummary = filteredTransactions.reduce(
    (summary, transaction) => {
      summary.transactionCount += 1

      if (transaction.type === 'income') {
        summary.incomeInCents += transaction.amountInCents
      }

      if (transaction.type === 'expense') {
        summary.expenseInCents += transaction.amountInCents
      }

      return summary
    },
    {
      transactionCount: 0,
      incomeInCents: 0,
      expenseInCents: 0,
    },
  )

  function sortTransactions(transactionList) {
    return [...transactionList].sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        second.id.localeCompare(first.id),
    )
  }
  function updateTransactions(updater) {
    const nextTransactions =
      typeof updater === 'function'
        ? updater(transactionsRef.current)
        : updater

    transactionsRef.current = nextTransactions
    setTransactions(nextTransactions)

    return nextTransactions
  }

  function updateSelectedYear(year) {
    filtersRef.current.year = year
    setSelectedYear(year)
  }

  function updateSelectedMonth(month) {
    filtersRef.current.month = month
    setSelectedMonth(month)
  }

  function updateSelectedType(type) {
    filtersRef.current.type = type
    setSelectedType(type)
  }

  function updateSelectedCategory(category) {
    filtersRef.current.category = category
    setSelectedCategory(category)
  }

  function updateDescriptionQuery(description) {
    filtersRef.current.description = description
    setDescriptionQuery(description)
  }

  function reconcileFilters(nextTransactions) {
    const filters = filtersRef.current

    const nextAvailableYears = [
      ...new Set([
        currentYear,
        ...nextTransactions.map((transaction) =>
          Number(transaction.date.slice(0, 4)),
        ),
      ]),
    ]

    if (!nextAvailableYears.includes(filters.year)) {
      // Volta ao período padrão se o ano selecionado deixar de existir.
      updateSelectedYear(currentYear)
      updateSelectedMonth(currentMonth)
      updateSelectedType('all')
      updateSelectedCategory('all')
      updateDescriptionQuery('')
      return
    }

    const nextPeriodTransactions = nextTransactions.filter((transaction) => {
      const transactionYear = Number(transaction.date.slice(0, 4))
      const transactionMonth = Number(transaction.date.slice(5, 7))

      if (transactionYear !== filters.year) {
        return false
      }

      if (
        filters.month !== 'all' &&
        transactionMonth !== filters.month
      ) {
        return false
      }

      return true
    })

    const nextAvailableTypes = [
      ...new Set(
        nextPeriodTransactions.map((transaction) => transaction.type),
      ),
    ]

    const nextAvailableCategories = [
      ...new Set(
        nextPeriodTransactions.map((transaction) => transaction.category),
      ),
    ]

    if (
      filters.type !== 'all' &&
      !nextAvailableTypes.includes(filters.type)
    ) {
      updateSelectedType('all')
    }

    if (
      filters.category !== 'all' &&
      !nextAvailableCategories.includes(filters.category)
    ) {
      updateSelectedCategory('all')
    }
  }


  function handleYearChange(year) {
    updateSelectedYear(year)
    updateSelectedType('all')
    updateSelectedCategory('all')
    updateDescriptionQuery('')

    if (year === currentYear) {
      updateSelectedMonth(currentMonth)
    } else {
      updateSelectedMonth('all')
    }
  }

  function handleMonthChange(month) {
    updateSelectedMonth(month)
    updateSelectedType('all')
    updateSelectedCategory('all')
    updateDescriptionQuery('')
  }

  async function handleAddTransaction(transactionData) {
    const response = await fetch('http://localhost:3000/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error || 'Não foi possível cadastrar a transação.',
      )
    }

    updateTransactions((previous) =>
      sortTransactions([data, ...previous]),
    )
  }

  async function handleUpdateTransaction(id, transactionData) {
    const response = await fetch(
      `http://localhost:3000/transactions/${id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      },
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error || 'Não foi possível atualizar a transação.',
      )
    }

    const nextTransactions = updateTransactions((previous) =>
      sortTransactions(
        previous.map((transaction) =>
          transaction.id === id ? data : transaction,
        ),
      ),
    )

    reconcileFilters(nextTransactions)
    setEditingTransaction((current) =>
      current?.id === id ? null : current,
    )
  }

  async function handleDeleteTransaction(id) {
    const response = await fetch(
      `http://localhost:3000/transactions/${id}`,
      {
        method: 'DELETE',
      },
    )

    if (!response.ok) {
      let message = 'Não foi possível excluir a transação.'

      try {
        const data = await response.json()
        message = data.error || message
      } catch {
        // Mantém a mensagem padrão se a resposta não possuir JSON válido.
      }

      throw new Error(message)
    }

    const nextTransactions = updateTransactions((previous) =>
      previous.filter((transaction) => transaction.id !== id),
    )

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
    <div
      className={`app-layout${isSidebarCollapsed ? ' sidebar-collapsed' : ''
        }`}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <a
            className="brand"
            href="#transactions"
            aria-label="FinanTec"
          >
            <span className="brand-name">FinanTec</span>
            <span className="brand-short" aria-hidden="true">
              FT
            </span>
          </a>

          <button
            className="sidebar-toggle"
            type="button"
            onClick={() =>
              setIsSidebarCollapsed((previous) => !previous)
            }
            aria-label={
              isSidebarCollapsed
                ? 'Expandir menu'
                : 'Recolher menu'
            }
            aria-expanded={!isSidebarCollapsed}
            aria-controls="sidebar-navigation"
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>

        <nav
          id="sidebar-navigation"
          aria-label="Navegação principal"
        >
          <a
            className="nav-link"
            href="#transactions"
            aria-current="page"
            aria-label="Transações"
            title="Transações"
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
            </svg>

            <span className="nav-label">Transações</span>
          </a>
        </nav>
      </aside>

      <main className="main-content" id="transactions">
        <header className="page-header">
          <h1>Transações</h1>
          <p>Organize suas receitas, despesas e reservas.</p>
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
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onCancelEdit={() => setEditingTransaction(null)}
          />
        </section>

        <section
          className="panel"
          aria-labelledby="transactions-title"
        >
          <h2 id="transactions-title">Movimentações</h2>

          <TransactionFilters
            years={availableYears}
            types={availableTypes}
            categories={availableCategories}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedType={selectedType}
            selectedCategory={selectedCategory}
            descriptionQuery={descriptionQuery}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            onTypeChange={updateSelectedType}
            onCategoryChange={updateSelectedCategory}
            onDescriptionChange={updateDescriptionQuery}
            showAdditionalFilters={periodTransactions.length > 0}
          />

          {periodTransactions.length > 0 && (
            <TransactionSummary
              transactionCount={transactionSummary.transactionCount}
              incomeInCents={transactionSummary.incomeInCents}
              expenseInCents={transactionSummary.expenseInCents}
            />
          )}

          <TransactionList
            transactions={filteredTransactions}
            onEditTransaction={setEditingTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            emptyMessage={emptyTransactionMessage}
          />
        </section>
      </main>
    </div>
  )
}

export default App