import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOrder, getOrderId, type CreateOrderPayload } from '@/api/orderApi'
import { getFoods, type Food } from '@/api/foodApi'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/store/authStore'
import { useCart } from '@/context/CartContext'
import type { ApiError } from '@/lib/api'

const LAST_ORDER_ID_KEY = 'last-order-id'

export default function CartPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { items, addFood, removeFood, clearCart, totalPrice } = useCart()

  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleApiError(err: unknown, fallback: string): string {
    const apiErr = err as ApiError
    if (apiErr.status === 401) {
      logout()
      navigate('/login', { replace: true })
      return 'Session expired. Please log in again.'
    }
    if (apiErr.status === 404) {
      return 'Resource not found.'
    }
    if (apiErr.status === 500) {
      return 'Server error. Please try again later.'
    }
    return apiErr.message ?? fallback
  }

  async function loadFoods() {
    try {
      setError('')
      const data = await getFoods()
      setFoods(data)
    } catch (err: unknown) {
      setError(handleApiError(err, 'Failed to load foods.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFoods()
  }, [])

  async function handleSubmitOrder() {
    if (items.length === 0) {
      setError('Please add at least one food item before submitting the order.')
      return
    }

    const foodIds = items
      .map((item) => (item as { id?: string; _id?: string }).id ?? (item as { _id?: string })._id)
      .filter((id): id is string => Boolean(id))

    const payload: CreateOrderPayload = foodIds

    setSubmitting(true)
    setError('')
    try {
      const order = await createOrder(payload)

      const createdOrderId = getOrderId(order)

      if (!createdOrderId) {
        throw new Error('Order created but order id is missing in the response.')
      }

      localStorage.setItem(LAST_ORDER_ID_KEY, createdOrderId)
      clearCart()
      navigate(`/orders/${createdOrderId}`)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : handleApiError(err, 'Failed to submit order. Please try again.')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Cart / Order</h1>
        <Button variant="outline" onClick={() => navigate('/foods')}>
          Back to Foods
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Available Foods</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading foods...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-[110px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foods.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No foods found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      foods.map((food) => {
                        const inCart = items.some((item) => item.id === food.id)
                        return (
                          <TableRow key={food.id}>
                            <TableCell className="font-medium">{food.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{food.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right">${food.price.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={inCart ? 'outline' : 'default'}
                                onClick={() => addFood(food)}
                                disabled={inCart}
                              >
                                {inCart ? 'Added' : 'Add'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Cart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-[110px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Cart is empty.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="destructive" onClick={() => removeFood(item.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3 text-sm">
              <span className="font-medium">Total price</span>
              <span className="font-semibold">${totalPrice.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={clearCart} disabled={items.length === 0 || submitting}>
                Clear Cart
              </Button>
              <Button onClick={handleSubmitOrder} disabled={submitting || items.length === 0}>
                {submitting ? 'Submitting Order...' : 'Submit Order'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
