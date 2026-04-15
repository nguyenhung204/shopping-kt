import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import FoodsPage from '@/pages/FoodsPage'
import UsersPage from '@/pages/UsersPage'
import CartPage from '@/pages/CartPage'
import OrderDetailPage from '@/pages/OrderDetailPage'
import CheckoutSuccessPage from '@/pages/CheckoutSuccessPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/foods" replace />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/checkout/success/:id" element={<CheckoutSuccessPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
