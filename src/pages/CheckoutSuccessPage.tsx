import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import type { Payment } from '@/api/paymentApi'
import { getOrderById, getOrderId } from '@/api/orderApi'
import type { Order } from '@/api/orderApi'
import { getFoods } from '@/api/foodApi'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface FoodLookup {
  [foodId: string]: {
    name: string
    category: string
    price: number
  }
}

interface CheckoutSuccessState {
  payment?: Payment
  order?: Order
}

function normalizeStatus(status?: string) {
  return (status ?? 'PAID').toUpperCase()
}

function formatDateTime(value?: string) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function CheckoutSuccessPage() {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const state = (location.state ?? {}) as CheckoutSuccessState

  const [order, setOrder] = useState<Order | null>(state.order ?? null)
  const [foodLookup, setFoodLookup] = useState<FoodLookup>({})
  const [loading, setLoading] = useState(!state.order)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // Refs for WebGL Canvas and Interaction
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  const orderId = params.id ?? getOrderId(order ?? ({} as Order))
  const status = normalizeStatus(order?.status)

  function handleApiError(err: unknown, fallback: string): string {
    const apiErr = err as ApiError
    if (apiErr.status === 401) {
      logout()
      navigate('/login', { replace: true })
      return 'Session expired. Please log in again.'
    }
    if (apiErr.status === 404) {
      setNotFound(true)
      return 'Receipt not found.'
    }
    if (apiErr.status === 500) {
      return 'Server error. Please try again later.'
    }
    return apiErr.message ?? fallback
  }

  useEffect(() => {
    let active = true

    async function loadData() {
      if (!orderId) {
        if (active) {
          setNotFound(true)
          setLoading(false)
        }
        return
      }

      try {
        if (active) setError('')
        const [orderData, foods] = await Promise.all([order ?? getOrderById(orderId), getFoods()])
        const map: FoodLookup = {}
        for (const food of foods) {
          map[food.id] = { name: food.name, category: food.category, price: food.price }
        }
        if (active) {
          setFoodLookup(map)
          setOrder(orderData)
        }
      } catch (err: unknown) {
        if (active) setError(handleApiError(err, 'Failed to load receipt.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()
    return () => { active = false }
  }, [orderId])

  const items = useMemo(() => {
    if (!order) return []
    return order.foodIds.map((foodId: string) => {
      const info = foodLookup[foodId]
      return {
        id: foodId,
        name: info?.name ?? foodId,
        category: info?.category ?? 'Unknown',
        price: info?.price ?? 0,
      }
    })
  }, [order, foodLookup])

  const subtotal = order?.totalPrice ?? items.reduce((sum: number, item: any) => sum + item.price, 0)
  const taxRate = 0.08
  const tax = subtotal * taxRate

  // --- WEBGL & PHYSICS LOGIC ---
  useEffect(() => {
    if (loading || notFound || !canvasRef.current) return

    let animationFrameId: number
    const canvas = canvasRef.current
    const indicator = indicatorRef.current
    const gl = canvas.getContext('webgl') as WebGLRenderingContext
    if (!gl) return

    // --- 1. Texture Generation (Dynamic Data) ---
    const texCanvas = document.createElement('canvas')
    texCanvas.width = 1024
    texCanvas.height = 2048
    const ctx = texCanvas.getContext('2d')!
    ctx.scale(2, 2)
    const W = 512
    const H = 1024

    // Background
    ctx.fillStyle = '#f8f8f4'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = '#1a1a1a'
    
    // Header
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('SHOPPING CART', W / 2, 80)
    
    ctx.font = '22px monospace'
    ctx.fillText(`Receipt #${orderId || 'N/A'}`, W / 2, 125)

    // Meta
    ctx.textAlign = 'left'
    ctx.font = '18px monospace'
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    ctx.fillText(`Date: ${dateStr}  ${timeStr}`, 40, 190)
    ctx.fillText(`Payment: ${state.payment?.paymentMethod ?? 'Banking'}`, 40, 220)
    ctx.fillText(`Status: ${status}`, 40, 250)

    ctx.textAlign = 'center'
    ctx.fillText('- - - - - - - - - - - - - - - - - -', W / 2, 300)

    // Items
    let currentY = 350
    const lineH = 35
    ctx.font = '18px monospace'
    if (items.length === 0) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#888'
      ctx.fillText('No items in this receipt.', W / 2, currentY)
      ctx.fillStyle = '#1a1a1a'
      currentY += lineH
    } else {
      items.forEach((item: any) => {
        ctx.textAlign = 'left'
        const itemName = item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name
        ctx.fillText(itemName, 40, currentY)
        ctx.textAlign = 'right'
        ctx.fillText(`$${item.price.toFixed(2)}`, W - 40, currentY)
        currentY += lineH
      })
    }

    currentY += 20
    ctx.textAlign = 'center'
    ctx.fillText('- - - - - - - - - - - - - - - - - -', W / 2, currentY)

    // Subtotal & Tax
    currentY += 40
    ctx.textAlign = 'left'
    ctx.fillText('Subtotal', 40, currentY)
    ctx.textAlign = 'right'
    ctx.fillText(`$${subtotal.toFixed(2)}`, W - 40, currentY)

    currentY += 35
    ctx.textAlign = 'left'
    ctx.fillText('Tax (8%)', 40, currentY)
    ctx.textAlign = 'right'
    ctx.fillText(`$${tax.toFixed(2)}`, W - 40, currentY)

    currentY += 30
    ctx.fillRect(40, currentY, W - 80, 5) // Thick line

    // Total
    currentY += 50
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('TOTAL', 40, currentY)
    ctx.textAlign = 'right'
    ctx.fillText(`$${(subtotal + tax).toFixed(2)}`, W - 40, currentY)

    // Footer
    currentY += 80
    ctx.font = '18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Thank you for your purchase!', W / 2, currentY)
    ctx.fillStyle = '#666'
    ctx.font = '14px monospace'
    ctx.fillText('shopping-app.local', W / 2, currentY + 30)

    // --- 2. WebGL Setup ---
    let aspect = 1
    function resize() {
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      gl.viewport(0, 0, canvas.width, canvas.height)
      aspect = canvas.width / canvas.height
    }
    window.addEventListener('resize', resize)
    // Delay initial resize slightly to ensure layout is complete
    setTimeout(resize, 0)

    const vsSource = `
      attribute vec3 a_pos; attribute vec3 a_norm; attribute vec2 a_uv;
      uniform mat4 u_proj; uniform mat4 u_view;
      varying vec3 v_norm; varying vec2 v_uv;
      void main() {
        v_norm = a_norm; v_uv = a_uv;
        gl_Position = u_proj * u_view * vec4(a_pos, 1.0);
      }
    `
    const fsSource = `
      precision mediump float;
      varying vec3 v_norm; varying vec2 v_uv;
      uniform sampler2D u_tex;
      void main() {
        vec3 norm = normalize(v_norm);
        if (!gl_FrontFacing) norm = -norm;
        vec3 lightDir1 = normalize(vec3(0.4, 0.8, 0.6));
        vec3 lightDir2 = normalize(vec3(-0.5, -0.2, 0.8));
        float diff1 = max(dot(norm, lightDir1), 0.0);
        float diff2 = max(dot(norm, lightDir2), 0.0);
        float ambient = 0.55;
        vec4 texColor = texture2D(u_tex, v_uv);
        vec3 finalColor = texColor.rgb * (ambient + diff1 * 0.4 + diff2 * 0.2);
        gl_FragColor = vec4(finalColor, texColor.a);
      }
    `

    function createShader(type: number, source: string) {
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, source)
      gl.compileShader(s)
      return s
    }

    const program = gl.createProgram()!
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource)!)
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource)!)
    gl.linkProgram(program)
    gl.useProgram(program)

    const aPos = gl.getAttribLocation(program, "a_pos")
    const aNorm = gl.getAttribLocation(program, "a_norm")
    const aUv = gl.getAttribLocation(program, "a_uv")
    const uProj = gl.getUniformLocation(program, "u_proj")
    const uView = gl.getUniformLocation(program, "u_view")
    gl.getUniformLocation(program, "u_tex")

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // --- 3. Physics Setup ---
    const numX = 25, numY = 50
    const numParticles = numX * numY
    const width = 3.0, height = 6.0
    const particles: any[] = []
    const posData = new Float32Array(numParticles * 3)
    const normalData = new Float32Array(numParticles * 3)
    const uvData = new Float32Array(numParticles * 2)

    for (let y = 0; y < numY; y++) {
      for (let x = 0; x < numX; x++) {
        let px = (x / (numX - 1) - 0.5) * width
        let py = -(y / (numY - 1)) * height
        let pz = 0
        let i = y * numX + x
        particles.push({ x: px, y: py, z: pz, ox: px, oy: py, oz: pz })
        uvData[i * 2] = x / (numX - 1)
        uvData[i * 2 + 1] = y / (numY - 1)
      }
    }

    const constraints: any[] = []
    function addC(i1: number, i2: number) {
      let dx = particles[i2].x - particles[i1].x
      let dy = particles[i2].y - particles[i1].y
      let dz = particles[i2].z - particles[i1].z
      constraints.push({ p1: i1, p2: i2, rest: Math.sqrt(dx*dx + dy*dy + dz*dz) })
    }

    for (let y = 0; y < numY; y++) {
      for (let x = 0; x < numX; x++) {
        let i = y * numX + x
        if (x < numX - 1) addC(i, i + 1)
        if (y < numY - 1) addC(i, i + numX)
        if (x < numX - 1 && y < numY - 1) { addC(i, i + numX + 1); addC(i + 1, i + numX) }
        if (x < numX - 2) addC(i, i + 2)
        if (y < numY - 2) addC(i, i + numX * 2)
      }
    }

    const indices: number[] = []
    for (let y = 0; y < numY - 1; y++) {
      for (let x = 0; x < numX - 1; x++) {
        let i = y * numX + x
        indices.push(i, i + 1, i + numX, i + 1, i + numX + 1, i + numX)
      }
    }

    const posBuf = gl.createBuffer()
    const normBuf = gl.createBuffer()
    const uvBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
    gl.bufferData(gl.ARRAY_BUFFER, uvData, gl.STATIC_DRAW)
    const idxBuf = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)

    gl.enable(gl.DEPTH_TEST)

    const projMatrix = new Float32Array(16)
    const viewMatrix = new Float32Array(16)
    const camPos = { x: 0, y: -3.5, z: 8.5 }
    const fov = 45 * Math.PI / 180

    // --- 4. Interaction ---
    let pointerX = 0, pointerY = 0
    let grabbedIndex = -1, grabDepth = 0

    function getRay() {
      let tanFov = Math.tan(fov / 2)
      let dx = pointerX * aspect * tanFov
      let dy = pointerY * tanFov
      let dz = -1
      let len = Math.sqrt(dx*dx + dy*dy + dz*dz)
      return {
        origin: { x: camPos.x, y: camPos.y, z: camPos.z },
        dir: { x: dx/len, y: dy/len, z: dz/len }
      }
    }

    function updatePointer(e: PointerEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onPointerDown = (e: PointerEvent) => {
      updatePointer(e)
      let ray = getRay()
      let minDist = Infinity, bestIdx = -1

      for (let i = 0; i < numParticles; i++) {
        let p = particles[i]
        let vx = p.x - ray.origin.x, vy = p.y - ray.origin.y, vz = p.z - ray.origin.z
        let t = vx * ray.dir.x + vy * ray.dir.y + vz * ray.dir.z
        let px = ray.origin.x + ray.dir.x * t, py = ray.origin.y + ray.dir.y * t, pz = ray.origin.z + ray.dir.z * t
        let dx = p.x - px, dy = p.y - py, dz = p.z - pz
        let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

        if (dist < minDist && dist < 1.0) { minDist = dist; bestIdx = i; grabDepth = t }
      }

      if (bestIdx !== -1) {
        grabbedIndex = bestIdx
        if (indicator) {
          indicator.style.display = 'block'
          indicator.style.left = e.clientX + 'px'
          indicator.style.top = e.clientY + 'px'
        }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e)
      if (grabbedIndex !== -1) {
        let ray = getRay()
        let p = particles[grabbedIndex]
        p.x = ray.origin.x + ray.dir.x * grabDepth
        p.y = ray.origin.y + ray.dir.y * grabDepth
        p.z = ray.origin.z + ray.dir.z * grabDepth
        p.ox = p.x; p.oy = p.y; p.oz = p.z
        if (indicator) {
          indicator.style.left = e.clientX + 'px'
          indicator.style.top = e.clientY + 'px'
        }
      }
    }

    const release = () => {
      grabbedIndex = -1
      if (indicator) indicator.style.display = 'none'
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)

    // --- 5. Main Loop ---
    let time = 0
    function render() {
      time += 0.016
      let windX = Math.sin(time * 1.5) * 0.0015
      let windZ = Math.cos(time * 1.1) * 0.0015

      for (let i = 0; i < numParticles; i++) {
        if (i < numX || i === grabbedIndex) continue
        let p = particles[i]
        let vx = (p.x - p.ox) * 0.985, vy = (p.y - p.oy) * 0.985, vz = (p.z - p.oz) * 0.985
        p.ox = p.x; p.oy = p.y; p.oz = p.z
        let windFactor = (p.y / -height)
        p.x += vx + windX * windFactor
        p.y += vy - 0.007
        p.z += vz + windZ * windFactor
      }

      for (let iter = 0; iter < 15; iter++) {
        for (let i = 0; i < constraints.length; i++) {
          let c = constraints[i]
          let p1 = particles[c.p1], p2 = particles[c.p2]
          let dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z
          let dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
          let w1 = (c.p1 < numX || c.p1 === grabbedIndex) ? 0 : 1
          let w2 = (c.p2 < numX || c.p2 === grabbedIndex) ? 0 : 1
          let wSum = w1 + w2
          if (wSum > 0) {
            let diff = (dist - c.rest) / (dist * wSum)
            let offsetX = dx * diff, offsetY = dy * diff, offsetZ = dz * diff
            if (w1) { p1.x += offsetX; p1.y += offsetY; p1.z += offsetZ }
            if (w2) { p2.x -= offsetX; p2.y -= offsetY; p2.z -= offsetZ }
          }
        }
      }

      normalData.fill(0)
      for (let i = 0; i < numParticles; i++) {
        let p = particles[i]
        posData[i*3] = p.x; posData[i*3+1] = p.y; posData[i*3+2] = p.z
      }

      for (let i = 0; i < indices.length; i += 3) {
        let i1 = indices[i], i2 = indices[i+1], i3 = indices[i+2]
        let v1x = posData[i1*3], v1y = posData[i1*3+1], v1z = posData[i1*3+2]
        let v2x = posData[i2*3], v2y = posData[i2*3+1], v2z = posData[i2*3+2]
        let v3x = posData[i3*3], v3y = posData[i3*3+1], v3z = posData[i3*3+2]
        let dx1 = v2x - v1x, dy1 = v2y - v1y, dz1 = v2z - v1z
        let dx2 = v3x - v1x, dy2 = v3y - v1y, dz2 = v3z - v1z
        let nx = dy1*dz2 - dz1*dy2, ny = dz1*dx2 - dx1*dz2, nz = dx1*dy2 - dy1*dx2
        normalData[i1*3] += nx; normalData[i1*3+1] += ny; normalData[i1*3+2] += nz
        normalData[i2*3] += nx; normalData[i2*3+1] += ny; normalData[i2*3+2] += nz
        normalData[i3*3] += nx; normalData[i3*3+1] += ny; normalData[i3*3+2] += nz
      }

      gl.clearColor(0.898, 0.898, 0.898, 1.0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      let f = 1.0 / Math.tan(fov / 2), nf = 1 / (0.1 - 100.0)
      projMatrix.fill(0)
      projMatrix[0] = f / aspect; projMatrix[5] = f; projMatrix[10] = (100.0 + 0.1) * nf; projMatrix[11] = -1; projMatrix[14] = (2 * 100.0 * 0.1) * nf
      
      viewMatrix.fill(0)
      viewMatrix[0]=1; viewMatrix[5]=1; viewMatrix[10]=1; viewMatrix[15]=1;
      viewMatrix[12]=-camPos.x; viewMatrix[13]=-camPos.y; viewMatrix[14]=-camPos.z

      gl.uniformMatrix4fv(uProj, false, projMatrix)
      gl.uniformMatrix4fv(uView, false, viewMatrix)

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf)
      gl.bufferData(gl.ARRAY_BUFFER, normalData, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(aNorm)
      gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf)
      gl.enableVertexAttribArray(aUv)
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [loading, notFound, items, subtotal, tax, orderId, status, state.payment?.paymentMethod])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#e5e5e5] px-4 py-10">
        <div className="mx-auto flex max-w-4xl items-center justify-center py-20 text-muted-foreground">
          Loading receipt...
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#e5e5e5] px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-bold">Receipt Not Found</h2>
            <p className="mb-6 text-muted-foreground">We could not find the checkout receipt for this order.</p>
            <Button asChild>
              <Link to="/foods">Back to Foods</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex-1 w-full bg-[#e5e5e5] overflow-hidden touch-none font-sans" style={{ minHeight: "calc(100vh - 4rem)" }}>
      {error && (
        <div className="absolute top-4 left-4 right-4 z-50 max-w-md mx-auto">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* WebGL Canvas Background */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full z-10 cursor-grab active:cursor-grabbing"
      />

      {/* Touch Indicator */}
      <div 
        ref={indicatorRef} 
        id="indicator" 
        className="absolute w-8 h-8 bg-black/10 border-2 border-black/25 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden z-50"
      />

      {/* Overlay UI Layer (Buttons & Status) */}
      <div className="absolute bottom-6 left-0 w-full z-20 pointer-events-none px-4 flex flex-col gap-4">
        
        {/* Payment Status Badge */}
        <div className="mx-auto flex items-center justify-center gap-2 text-sm bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm pointer-events-auto">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-gray-800 font-medium">Payment confirmed • {formatDateTime(state.payment?.paymentTime)}</span>
        </div>

        {/* Action Buttons */}
        <div className="mx-auto w-full max-w-md flex flex-col gap-2 sm:flex-row pointer-events-auto bg-white/40 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/50">
          <Button className="flex-1 shadow-sm" asChild>
            <Link to={`/orders/${orderId}`}>View Order</Link>
          </Button>
          <Button variant="outline" className="flex-1 bg-white/80 hover:bg-white shadow-sm" asChild>
            <Link to="/foods">Continue Shopping</Link>
          </Button>
          <Button variant="outline" className="flex-1 bg-white/80 hover:bg-white shadow-sm hidden sm:flex" asChild>
            <Link to="/cart">Cart</Link>
          </Button>
        </div>
        
        <p className="text-center text-gray-500 text-sm font-medium mt-2">Grab and drag the receipt</p>
      </div>
    </main>
  )
}