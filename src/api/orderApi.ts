import request from '@/lib/api'

export type OrderStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'SUCCESS'
  | 'PROCESSING'
  | 'FAILED'
  | 'CANCELLED'

export interface Order {
  id?: string
  orderId?: string
  userId: string
  foodIds: string[]
  totalPrice: number
  status?: OrderStatus | string
  createdAt?: string
  updatedAt?: string
}

export type CreateOrderPayload = string[]

export interface UpdateOrderStatusPayload {
  status: OrderStatus | string
}

export const createOrder = (data: CreateOrderPayload) =>
  request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) })

export const getOrderById = (id: string) =>
  request<Order>(`/api/orders/${id}`)

export const updateOrderStatus = (id: string, data: UpdateOrderStatusPayload) =>
  request<Order>(`/api/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export function getOrderId(order: Order): string {
  return order.orderId ?? order.id ?? ''
}
