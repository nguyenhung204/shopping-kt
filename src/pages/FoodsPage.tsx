import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFoods, createFood, updateFood, deleteFood, type Food, type FoodPayload } from '@/api/foodApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCart } from '@/context/CartContext'
import { useAuthStore } from '@/store/authStore'
import type { ApiError } from '@/lib/api'
import { ShoppingCart } from 'lucide-react'

interface FoodForm {
  name: string
  price: string
  category: string
}

const emptyForm: FoodForm = { name: '', price: '', category: '' }

function foodToForm(f: Food): FoodForm {
  return { name: f.name, price: String(f.price), category: f.category }
}

export default function FoodsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { items, addFood } = useCart()
  const [foods, setFoods] = useState<Food[]>([])
  const [pageError, setPageError] = useState('')
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Food | null>(null)
  const [form, setForm] = useState<FoodForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null)
  const [deleting, setDeleting] = useState(false)

  function handleApiError(err: unknown, fallback: string): string {
    const apiErr = err as ApiError
    if (apiErr.status === 401) {
      logout()
      navigate('/login', { replace: true })
      return 'Session expired. Please log in again.'
    }
    if (apiErr.status === 404) {
      return 'Foods not found.'
    }
    if (apiErr.status === 500) {
      return 'Server error. Please try again later.'
    }
    return apiErr.message ?? fallback
  }

  async function loadFoods() {
    try {
      setPageError('')
      const data = await getFoods()
      setFoods(data)
    } catch (err: unknown) {
      setPageError(handleApiError(err, 'Failed to load foods.'))
    }
  }

  useEffect(() => {
    void loadFoods()
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setFormError('')
    setEditTarget(null)
    setDialogMode('create')
  }

  function openEdit(food: Food) {
    setForm(foodToForm(food))
    setFormError('')
    setEditTarget(food)
    setDialogMode('edit')
  }

  function closeDialog() {
    setDialogMode(null)
    setEditTarget(null)
    setFormError('')
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(form.price)
    if (isNaN(price) || price < 0) {
      setFormError('Price must be a valid non-negative number.')
      return
    }
    const payload: FoodPayload = { name: form.name.trim(), price, category: form.category.trim() }
    setSaving(true)
    setFormError('')
    try {
      if (dialogMode === 'create') {
        await createFood(payload)
      } else if (editTarget) {
        await updateFood(editTarget.id, payload)
      }
      closeDialog()
      await loadFoods()
    } catch (err: unknown) {
      setFormError(handleApiError(err, 'Failed to save food.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFood(deleteTarget.id)
      setDeleteTarget(null)
      await loadFoods()
    } catch (err: unknown) {
      setPageError(handleApiError(err, 'Failed to delete food.'))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Foods</h1>
        <Button  onClick={openCreate}>Add Food</Button>
      </div>

      {pageError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {foods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No foods found. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              foods.map((food) => (
                <TableRow key={food.id}>
                  <TableCell className="font-medium">{food.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{food.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right">${food.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => openEdit(food)}>
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => addFood(food)}
                        disabled={items.some((item) => item.id === food.id)}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {items.some((item) => item.id === food.id) ? 'Added' : 'Cart'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(food)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Add Food' : 'Edit Food'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="food-name">Name</Label>
              <Input
                id="food-name"
                name="name"
                value={form.name}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-price">Price</Label>
              <Input
                id="food-price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleFormChange}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-category">Category</Label>
              <Input
                id="food-category"
                name="category"
                value={form.category}
                onChange={handleFormChange}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete food</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This action
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
