import request from '@/lib/api'

export interface Food {
  id: string
  name: string
  price: number
  category: string
}

export type FoodPayload = Omit<Food, 'id'>

export const getFoods = () => request<Food[]>('/api/foods')

export const createFood = (data: FoodPayload) =>
  request<Food>('/api/foods', { method: 'POST', body: JSON.stringify(data) })

export const updateFood = (id: string, data: FoodPayload) =>
  request<Food>(`/api/foods/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteFood = (id: string) =>
  request<void>(`/api/foods/${id}`, { method: 'DELETE' })
