const configuredBaseUrl =
  import.meta.env.VITE_API_BASE_URL

const defaultBaseUrl = import.meta.env.PROD
  ? ''
  : 'http://localhost:3000'

const baseUrl = (
  configuredBaseUrl ?? defaultBaseUrl
).replace(/\/+$/, '')

export function apiUrl(path) {
  return `${baseUrl}${path}`
}
