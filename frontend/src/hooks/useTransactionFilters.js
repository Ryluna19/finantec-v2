import {
  useCallback,
  useRef,
  useState,
} from 'react'
import { filterTransactionsByPeriod } from '../transactionSelectors'

function useTransactionFilters({
  currentYear,
  currentMonth,
}) {
  const [selectedYear, setSelectedYear] =
    useState(currentYear)

  const [selectedMonth, setSelectedMonth] =
    useState(currentMonth)

  const [selectedType, setSelectedType] =
    useState('all')

  const [selectedCategory, setSelectedCategory] =
    useState('all')

  const [descriptionQuery, setDescriptionQuery] =
    useState('')

  const filtersRef = useRef({
    year: currentYear,
    month: currentMonth,
    type: 'all',
    category: 'all',
    description: '',
  })

  const updateSelectedYear = useCallback((year) => {
    filtersRef.current.year = year
    setSelectedYear(year)
  }, [])

  const updateSelectedMonth = useCallback((month) => {
    filtersRef.current.month = month
    setSelectedMonth(month)
  }, [])

  const updateSelectedType = useCallback((type) => {
    filtersRef.current.type = type
    setSelectedType(type)
  }, [])

  const updateSelectedCategory = useCallback(
    (category) => {
      filtersRef.current.category = category
      setSelectedCategory(category)
    },
    [],
  )

  const updateDescriptionQuery = useCallback(
    (description) => {
      filtersRef.current.description = description
      setDescriptionQuery(description)
    },
    [],
  )

  const resetFilters = useCallback((year, month) => {
    filtersRef.current = {
      year,
      month,
      type: 'all',
      category: 'all',
      description: '',
    }

    setSelectedYear(year)
    setSelectedMonth(month)
    setSelectedType('all')
    setSelectedCategory('all')
    setDescriptionQuery('')
  }, [])

  const reconcileFilters = useCallback(
    (nextTransactions) => {
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
        resetFilters(currentYear, currentMonth)
        return
      }

      const nextPeriodTransactions =
        filterTransactionsByPeriod(
          nextTransactions,
          filters.year,
          filters.month,
        )

      const nextAvailableTypes = [
        ...new Set(
          nextPeriodTransactions.map(
            (transaction) => transaction.type,
          ),
        ),
      ]

      const nextAvailableCategories = [
        ...new Set(
          nextPeriodTransactions.map(
            (transaction) => transaction.category,
          ),
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
        !nextAvailableCategories.includes(
          filters.category,
        )
      ) {
        updateSelectedCategory('all')
      }
    },
    [
      currentYear,
      currentMonth,
      resetFilters,
      updateSelectedType,
      updateSelectedCategory,
    ],
  )

  const handleYearChange = useCallback(
    (year) => {
      updateSelectedYear(year)
      updateSelectedType('all')
      updateSelectedCategory('all')
      updateDescriptionQuery('')

      if (year === currentYear) {
        updateSelectedMonth(currentMonth)
      } else {
        updateSelectedMonth('all')
      }
    },
    [
      currentYear,
      currentMonth,
      updateSelectedYear,
      updateSelectedMonth,
      updateSelectedType,
      updateSelectedCategory,
      updateDescriptionQuery,
    ],
  )

  const handleMonthChange = useCallback(
    (month) => {
      updateSelectedMonth(month)
      updateSelectedType('all')
      updateSelectedCategory('all')
      updateDescriptionQuery('')
    },
    [
      updateSelectedMonth,
      updateSelectedType,
      updateSelectedCategory,
      updateDescriptionQuery,
    ],
  )

  return {
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
    resetFilters,
    reconcileFilters,
  }
}

export default useTransactionFilters