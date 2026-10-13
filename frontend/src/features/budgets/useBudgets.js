
import { useEffect, useRef, useState } from 'react'

async function requestBudget(
  path,
  options,
  authGeneration,
  isCurrentAuthGeneration,
  expireSession,
) {
  const response = await fetch(
    `http://localhost:3000${path}`,
    {
      credentials: 'include',
      ...options,
    },
  )

  if (!isCurrentAuthGeneration(authGeneration)) {
    return null
  }

  if (response.status === 401) {
    expireSession(authGeneration)
    return null
  }

  if (!response.ok) {
    let message =
      'Não foi possível concluir a operação de orçamento.'

    try {
      const data = await response.json()
      message = data?.error || message
    } catch {
      // Mantém a mensagem padrão se o servidor não retornar JSON.
    }

    if (!isCurrentAuthGeneration(authGeneration)) {
      return null
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return true
  }

  const data = await response.json()

  if (!isCurrentAuthGeneration(authGeneration)) {
    return null
  }

  return data
}

function useBudgets({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
}) {
  const [budgets, setBudgets] = useState([])

  const [isLoadingBudgets, setIsLoadingBudgets] =
    useState(true)

  const [budgetsLoadError, setBudgetsLoadError] =
    useState(null)

  const budgetsRef = useRef([])
  const mutationVersionRef = useRef(0)
  const isMountedRef = useRef(false)

  useEffect(() => {
    let isActive = true
    isMountedRef.current = true

    const authGenerationAtStart =
      captureAuthGeneration()

    const mutationVersionAtStart =
      mutationVersionRef.current

    async function loadBudgets() {
      setIsLoadingBudgets(true)
      setBudgetsLoadError(null)

      try {
        const data = await requestBudget(
          '/budgets',
          {},
          authGenerationAtStart,
          isCurrentAuthGeneration,
          expireSession,
        )

        if (
          !isActive ||
          data === null ||
          !isCurrentAuthGeneration(
            authGenerationAtStart,
          ) ||
          mutationVersionRef.current !==
            mutationVersionAtStart
        ) {
          return
        }

        budgetsRef.current = data
        setBudgets(data)
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

        setBudgetsLoadError(
          'Não foi possível carregar os orçamentos.',
        )
      } finally {
        if (
          isActive &&
          isCurrentAuthGeneration(
            authGenerationAtStart,
          )
        ) {
          setIsLoadingBudgets(false)
        }
      }
    }

    loadBudgets()

    return () => {
      isActive = false
      isMountedRef.current = false
    }
  }, [
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireSession,
  ])

  function updateBudgetList(updater) {
    const nextBudgets = updater(budgetsRef.current)

    budgetsRef.current = nextBudgets
    mutationVersionRef.current += 1

    setBudgets(nextBudgets)
    setBudgetsLoadError(null)

    return nextBudgets
  }

  async function mutateBudget(
    path,
    method,
    payload,
    updater,
  ) {
    const authGenerationAtStart =
      captureAuthGeneration()

    const options = { method }

    if (payload !== undefined) {
      options.headers = {
        'Content-Type': 'application/json',
      }

      options.body = JSON.stringify(payload)
    }

    try {
      const data = await requestBudget(
        path,
        options,
        authGenerationAtStart,
        isCurrentAuthGeneration,
        expireSession,
      )

      if (
        data === null ||
        !isMountedRef.current ||
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return null
      }

      updateBudgetList((previous) =>
        updater(previous, data),
      )

      return data
    } catch (error) {
      if (
        !isMountedRef.current ||
        !isCurrentAuthGeneration(
          authGenerationAtStart,
        )
      ) {
        return null
      }

      throw error
    }
  }

  function addBudget(budgetData) {
    return mutateBudget(
      '/budgets',
      'POST',
      budgetData,
      (previous, created) => [
        created,
        ...previous,
      ],
    )
  }

  function updateBudget(id, budgetData) {
    return mutateBudget(
      `/budgets/${id}`,
      'PUT',
      budgetData,
      (previous, updated) =>
        previous.map((budget) =>
          budget.id === id ? updated : budget,
        ),
    )
  }

  function deleteBudget(id) {
    return mutateBudget(
      `/budgets/${id}`,
      'DELETE',
      undefined,
      (previous) =>
        previous.filter(
          (budget) => budget.id !== id,
        ),
    )
  }

  function splitBudget(id, budgetData) {
    return mutateBudget(
      `/budgets/${id}/split`,
      'POST',
      budgetData,
      (previous, result) => [
        result.createdBudget,
        ...previous.map((budget) =>
          budget.id === id
            ? result.previousBudget
            : budget,
        ),
      ],
    )
  }

  return {
    budgets,
    isLoadingBudgets,
    budgetsLoadError,
    addBudget,
    updateBudget,
    deleteBudget,
    splitBudget,
  }
}

export default useBudgets
