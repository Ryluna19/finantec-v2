export function normalizeCategoryKey(category) {
  return String(category ?? '')
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

export function formatCategoryLabel(category) {
  const label = category.trim()

  const formattedLabel =
    label.charAt(0).toLocaleUpperCase('pt-BR') +
    label.slice(1)

  if (
    normalizeCategoryKey(formattedLabel) !==
    normalizeCategoryKey(label)
  ) {
    return label
  }

  return formattedLabel
}