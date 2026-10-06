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

function TransactionFilters({
  years,
  types,
  categories,
  selectedYear,
  selectedMonth,
  selectedType,
  selectedCategory,
  descriptionQuery,
  onYearChange,
  onMonthChange,
  onTypeChange,
  onCategoryChange,
  onDescriptionChange,
  showAdditionalFilters,
}) {
  return (
    <div className="transaction-filters" aria-label="Filtros de transações">
      <div className="form-field">
        <label htmlFor="transaction-year-filter">Ano</label>

        <select
          id="transaction-year-filter"
          value={selectedYear}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="transaction-month-filter">Mês</label>

        <select
          id="transaction-month-filter"
          value={selectedMonth}
          onChange={(event) => {
            const value = event.target.value

            onMonthChange(value === 'all' ? 'all' : Number(value))
          }}
        >
          <option value="all">Ano inteiro</option>

          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      {showAdditionalFilters && (
        <>
          <div className="form-field">
            <label htmlFor="transaction-type-filter">Tipo</label>

            <select
              id="transaction-type-filter"
              value={selectedType}
              onChange={(event) => onTypeChange(event.target.value)}
            >
              <option value="all">Todos</option>

              {types.map((type) => (
                <option key={type} value={type}>
                  {type === 'income' ? 'Receita' : 'Despesa'}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="transaction-category-filter">Categoria</label>

            <select
              id="transaction-category-filter"
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="all">Todas</option>

              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field transaction-search-filter">
            <label htmlFor="transaction-description-filter">
              Buscar por descrição
            </label>

            <input
              id="transaction-description-filter"
              type="search"
              value={descriptionQuery}
              placeholder="Ex.: mercado"
              onChange={(event) =>
                onDescriptionChange(event.target.value)
              }
            />
          </div>
        </>
      )}
    </div>
  )
}

export default TransactionFilters