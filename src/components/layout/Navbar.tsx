import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'

const AUTH_PATHS = ['/login', '/register']

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  if (AUTH_PATHS.includes(pathname)) return null

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="container flex h-14 items-center gap-6">
        <span className="font-semibold tracking-tight">Shopping</span>
        <nav className="flex gap-4">
          <Link
            to="/foods"
            className={`text-sm font-medium transition-colors hover:text-primary ${pathname === '/foods' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            Foods
          </Link>
          <Link
            to="/cart"
            className={`text-sm font-medium transition-colors hover:text-primary ${pathname === '/cart' || pathname.startsWith('/orders/') ? 'text-primary' : 'text-muted-foreground'}`}
          >
            Cart
          </Link>
          <Link
            to="/users"
            className={`text-sm font-medium transition-colors hover:text-primary ${pathname === '/users' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            Users
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <span className="text-sm text-muted-foreground hidden sm:block">{user.name}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
