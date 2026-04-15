import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrderById, getOrderId, updateOrderStatus, type Order } from '@/api/orderApi'
import { createPayment, type Payment } from '@/api/paymentApi'
import { getFoods } from '@/api/foodApi'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/store/authStore'
import type { ApiError } from '@/lib/api'

interface FoodLookup {
  [foodId: string]: {
    name: string
    category: string
    price: number
  }
}

function normalizeStatus(status?: string) {
  return (status ?? 'PENDING').toUpperCase()
}

export default function OrderDetailPage() {
  const navigate = useNavigate()
  const params = useParams()
  const logout = useAuthStore((s) => s.logout)

  const [order, setOrder] = useState<Order | null>(null)
  const [foodLookup, setFoodLookup] = useState<FoodLookup>({})
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const orderId = params.id ?? ''
  const status = normalizeStatus(order?.status)
  const isPaid = status === 'PAID' || status === 'SUCCESS'

  function handleApiError(err: unknown, fallback: string): string {
    const apiErr = err as ApiError
    if (apiErr.status === 401) {
      logout()
      navigate('/login', { replace: true })
      return 'Session expired. Please log in again.'
    }
    if (apiErr.status === 404) {
      setNotFound(true)
      return 'Order not found.'
    }
    if (apiErr.status === 500) {
      return 'Server error. Please try again later.'
    }
    return apiErr.message ?? fallback
  }

  useEffect(() => {
    let active = true

    async function loadOrder() {
      if (!orderId) {
        if (active) {
          setNotFound(true)
          setLoading(false)
        }
        return
      }

      try {
        if (active) {
          setError('')
          setNotFound(false)
        }
        const [orderData, foods] = await Promise.all([getOrderById(orderId), getFoods()])
        const map: FoodLookup = {}
        for (const food of foods) {
          map[food.id] = {
            name: food.name,
            category: food.category,
            price: food.price,
          }
        }
        if (active) {
          setFoodLookup(map)
          setOrder(orderData)
        }
      } catch (err: unknown) {
        if (active) {
          setError(handleApiError(err, 'Failed to load order details.'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      active = false
    }
  }, [orderId])

  const foodsInOrder = useMemo(() => {
    if (!order) {
      return []
    }

    return order.foodIds.map((id) => {
      const info = foodLookup[id]
      return {
        id,
        name: info?.name ?? id,
        category: info?.category ?? 'Unknown',
        price: info?.price ?? 0,
      }
    })
  }, [order, foodLookup])

  async function handleMarkAsPaid() {
    if (!order) {
      return
    }

    const id = getOrderId(order)
    if (!id) {
      setError('Cannot mark this order as paid because order id is missing.')
      return
    }

    setPaying(true)
    setError('')
    try {
      const createdPayment = await createPayment({
        orderId: id,
        amount: order.totalPrice,
        paymentMethod: 'Banking',
      })
      setPayment(createdPayment)

      const updatedOrder = await updateOrderStatus(id, { status: 'PAID' })
      setOrder(updatedOrder)
      navigate(`/checkout/success/${id}`, {
        replace: true,
        state: {
          payment: createdPayment,
          order: updatedOrder,
        },
      })
    } catch (err: unknown) {
      setError(handleApiError(err, 'Failed to process payment.'))
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <main className="container py-8">
        <p className="text-muted-foreground">Loading order details...</p>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The requested order does not exist or is no longer available.
            </p>
            <Button onClick={() => navigate('/cart')}>Back to Cart</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>Order data is missing.</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Order Detail</h1>
        <Button variant="outline" onClick={() => navigate('/cart')}>
          Back to Cart
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>Order #{getOrderId(order) || orderId}</span>
            <Badge variant={isPaid ? 'default' : 'secondary'}>{status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="font-medium">User ID:</span> {order.userId}
            </p>
            <p>
              <span className="font-medium">Total:</span> ${order.totalPrice.toFixed(2)}
            </p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Food</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foodsInOrder.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No items found in this order.
                    </TableCell>
                  </TableRow>
                ) : (
                  foodsInOrder.map((food) => (
                    <TableRow key={food.id}>
                      <TableCell className="font-medium">{food.name}</TableCell>
                      <TableCell>{food.category}</TableCell>
                      <TableCell className="text-right">${food.price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleMarkAsPaid} disabled={isPaid || paying}>
              {isPaid ? 'Paid' : paying ? 'Processing Payment...' : 'Mark as Paid'}
            </Button>
            {payment && (
              <p className="text-sm text-muted-foreground">
                Payment success. Method: {payment.paymentMethod}, status: {payment.status}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
