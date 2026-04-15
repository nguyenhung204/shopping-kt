import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Food } from '@/api/foodApi'

interface CartContextValue {
  items: Food[]
  addFood: (food: Food) => void
  removeFood: (foodId: string) => void
  clearCart: () => void
  totalPrice: number
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Food[]>([])

  function addFood(food: Food) {
    setItems((prev) => {
      if (prev.some((item) => item.id === food.id)) {
        return prev
      }
      return [...prev, food]
    })
  }

  function removeFood(foodId: string) {
    setItems((prev) => prev.filter((item) => item.id !== foodId))
  }

  function clearCart() {
    setItems([])
  }

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  )

  const value = useMemo(
    () => ({ items, addFood, removeFood, clearCart, totalPrice }),
    [items, totalPrice]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used inside CartProvider')
  }
  return context
}
