import request from '@/lib/api'
import type { AuthUser } from '@/store/authStore'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  message: string
  token: string
  user: AuthUser
}

export const login = (data: LoginPayload) =>
  request<AuthResponse>('/api/login', { method: 'POST', body: JSON.stringify(data) })

export const register = (data: RegisterPayload) =>
  request<AuthResponse>('/api/register', { method: 'POST', body: JSON.stringify(data) })
