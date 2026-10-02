import {
  useEffect,
  useRef,
  useState,
} from 'react'

function sortTransactions(transactionList) {
  return [...transactionList].sort(
    (first, second) =>
      second.date.localeCompare(first.date) ||
      second.id.localeCompare(first.id),
  )
}

function useTransactions({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
}) {
  const [transactions, setTransactions] = useState([])

  const [isLoadingTransactions, setIsLoadingTransactions] =
    useState(true)

  const [transactionsLoadError, setTransactionsLoadError] =
    useState(null)

  const transactionsRef = useRef([])
  const mutationVersionRef = useRef(0)

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

  async function addTransaction(transactionData) {
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

  async function updateTransaction(
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
        return null
      }

      if (response.status === 401) {
        expireSession(authGenerationAtStart)
        return null
      }

      const data = await response.json()

      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return null
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Não foi possível atualizar a transação.',
        )
      }

      return updateTransactions((previous) =>
        sortTransactions(
          previous.map((transaction) =>
            transaction.id === id
              ? data
              : transaction,
          ),
        ),
      )
    } catch (error) {
      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return null
      }

      throw error
    }
  }

  async function deleteTransaction(id) {
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
        return null
      }

      if (response.status === 401) {
        expireSession(authGenerationAtStart)
        return null
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
            return null
          }

          message = data.error || message
        } catch {
          if (
            !isCurrentAuthGeneration(
              authGenerationAtStart,
            )
          ) {
            return null
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
        return null
      }

      return updateTransactions((previous) =>
        previous.filter(
          (transaction) =>
            transaction.id !== id,
        ),
      )
    } catch (error) {
      if (
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return null
      }

      throw error
    }
  }

  return {
    transactions,
    isLoadingTransactions,
    transactionsLoadError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  }
}

export default useTransactions