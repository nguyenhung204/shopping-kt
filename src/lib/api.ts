import { useAuthStore } from '@/store/authStore'

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'https://api.bancongnghe.tech'

export interface ApiError {
  status: number
  message: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const existingHeaders = options.headers
  if (existingHeaders) {
    const entries =
      existingHeaders instanceof Headers
        ? [...existingHeaders.entries()]
        : Object.entries(existingHeaders as Record<string, string>)
    for (const [k, v] of entries) headers[k] = v
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    const err: ApiError = { status: res.status, message: body.message ?? res.statusText }
    throw err
  }

  // Some endpoints (commonly DELETE) return success with an empty body.
  if (res.status === 204 || res.status === 205 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) {
    return undefined as T
  }

  const text = await res.text()
  if (!text.trim()) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

export default request
