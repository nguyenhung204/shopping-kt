import request from '@/lib/api'

export interface User {
  id: string
  name: string
  email: string
}

export interface UsersResponse {
  users: User[]
}

export const getUsers = () =>
  request<UsersResponse>('/api/users').then((res) => res.users)
