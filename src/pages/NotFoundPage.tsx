import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The page you requested does not exist.
          </p>
          <Button onClick={() => navigate('/foods')}>Go to Foods</Button>
        </CardContent>
      </Card>
    </main>
  )
}
