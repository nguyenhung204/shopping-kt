import request from '@/lib/api'

export interface Payment {
  id: string
  orderId: string
  amount: number
  paymentMethod: string
  paymentTime?: string
  status: string
}

export interface CreatePaymentPayload {
  orderId: string
  amount: number
  paymentMethod: string
}

export const createPayment = (data: CreatePaymentPayload) =>
  request<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(data) })
