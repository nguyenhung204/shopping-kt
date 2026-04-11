import { useAuthStore } from '@/store/authStore'

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:8080'

interface ApiError {
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
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export default request
