import { describe, it, expect, beforeAll } from 'vitest'
import { api, authed } from '../helpers/client'
import { registerAndLogin, decodeUserId } from '../helpers/auth'
import { waitFor } from '../helpers/poll'

let token: string
let userId: string
let productId: string
let zeroStockProductId: string

beforeAll(async () => {
  const { token: t } = await registerAndLogin()
  token = t
  userId = decodeUserId(token)

  // Create a product with stock for ordering
  const productRes = await api.post('/products', {
    name: 'Order Test Product',
    description: 'Used in order tests',
    price: 25.0,
    stock: 100,
  })
  expect(productRes.status).toBe(201)
  productId = productRes.data.id as string

  // Create a product with zero stock for conflict test
  const zeroRes = await api.post('/products', {
    name: 'Out of Stock Product',
    price: 5.0,
    stock: 0,
  })
  expect(zeroRes.status).toBe(201)
  zeroStockProductId = zeroRes.data.id as string
})

describe('Orders', () => {
  describe('POST /orders', () => {
    it('returns 201 with pending order on valid request', async () => {
      const res = await api.post('/orders', {
        userId,
        idempotencyKey: `key-${Date.now()}-1`,
        items: [{ productId, quantity: 1 }],
      })
      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('id')
      expect(res.data.status).toBe('pending')
      expect(res.data.userId).toBe(userId)
    })

    it('returns same order (idempotent) on duplicate idempotencyKey', async () => {
      const key = `idempotent-key-${Date.now()}`
      const payload = {
        userId,
        idempotencyKey: key,
        items: [{ productId, quantity: 1 }],
      }
      const first = await api.post('/orders', payload)
      expect(first.status).toBe(201)
      const second = await api.post('/orders', payload)
      expect(second.status).toBe(201)
      // Idempotency: same order ID returned both times
      expect(second.data.id).toBe(first.data.id)
    })

    it('returns 400 for invalid (non-uuid) productId', async () => {
      const res = await api.post('/orders', {
        userId,
        idempotencyKey: `bad-product-${Date.now()}`,
        items: [{ productId: 'not-a-uuid', quantity: 1 }],
      })
      expect(res.status).toBe(400)
    })

    it('returns 409 when product is out of stock', async () => {
      const res = await api.post('/orders', {
        userId,
        idempotencyKey: `no-stock-${Date.now()}`,
        items: [{ productId: zeroStockProductId, quantity: 1 }],
      })
      expect(res.status).toBe(409)
    })

    it('returns 400 when items array is empty', async () => {
      const res = await api.post('/orders', {
        userId,
        idempotencyKey: `empty-${Date.now()}`,
        items: [],
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /orders/user/:userId', () => {
    it('returns 200 with array of orders for existing user', async () => {
      const res = await api.get(`/orders/user/${userId}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
      expect(res.data.length).toBeGreaterThan(0)
    })

    it('returns 200 with empty array for user with no orders', async () => {
      const { token: t } = await registerAndLogin()
      const newUserId = decodeUserId(t)
      const res = await api.get(`/orders/user/${newUserId}`)
      expect(res.status).toBe(200)
      expect(res.data).toEqual([])
    })

    it('filters by ?status=pending', async () => {
      const res = await api.get(`/orders/user/${userId}?status=pending`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
      for (const order of res.data) {
        expect(order.status).toBe('pending')
      }
    })
  })

  describe('GET /orders/:id/public', () => {
    it('returns 200 without invoiceUrl for existing order', async () => {
      const createRes = await api.post('/orders', {
        userId,
        idempotencyKey: `public-test-${Date.now()}`,
        items: [{ productId, quantity: 1 }],
      })
      expect(createRes.status).toBe(201)
      const orderId = createRes.data.id as string

      const res = await api.get(`/orders/${orderId}/public`)
      expect(res.status).toBe(200)
      expect(res.data.id).toBe(orderId)
      expect(res.data).not.toHaveProperty('invoiceUrl')
    })

    it('returns 404 for unknown order id', async () => {
      const res = await api.get('/orders/00000000-0000-0000-0000-000000000000/public')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /orders/:id (auth required)', () => {
    let orderId: string

    beforeAll(async () => {
      const createRes = await api.post('/orders', {
        userId,
        idempotencyKey: `auth-test-${Date.now()}`,
        items: [{ productId, quantity: 1 }],
      })
      expect(createRes.status).toBe(201)
      orderId = createRes.data.id as string
    })

    it('returns 200 for the order owner', async () => {
      const res = await authed(token).get(`/orders/${orderId}`)
      expect(res.status).toBe(200)
      expect(res.data.id).toBe(orderId)
    })

    it('returns 401 without token', async () => {
      const res = await api.get(`/orders/${orderId}`)
      expect(res.status).toBe(401)
    })

    it('returns 403 for a different user', async () => {
      const { token: otherToken } = await registerAndLogin()
      const res = await authed(otherToken).get(`/orders/${orderId}`)
      expect(res.status).toBe(403)
    })
  })

  describe('Async: order processed by RabbitMQ worker', () => {
    it('order status becomes "processed" within 10 seconds', async () => {
      const createRes = await api.post('/orders', {
        userId,
        idempotencyKey: `async-${Date.now()}`,
        items: [{ productId, quantity: 1 }],
      })
      expect(createRes.status).toBe(201)
      const orderId = createRes.data.id as string
      expect(createRes.data.status).toBe('pending')

      const finalOrder = await waitFor(
        () => api.get(`/orders/${orderId}/public`),
        (res) => res.data?.status === 'processed',
        { timeout: 10000, interval: 500 },
      )

      expect(finalOrder.data.status).toBe('processed')
    })
  })
})
