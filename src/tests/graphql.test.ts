import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import axios from 'axios'
import { gqlEndpoint, api } from '../helpers/client'
import { adminLogin, registerAndLogin, decodeUserId } from '../helpers/auth'
import { authed } from '../helpers/client'

const gql = axios.create({ baseURL: gqlEndpoint, validateStatus: () => true })

async function query(body: object) {
  return gql.post('', body, { headers: { 'Content-Type': 'application/json' } })
}

let userId: string
let productId: string

// Extra users created inside individual tests
const extraUserIds: string[] = []

beforeAll(async () => {
  const { token } = await registerAndLogin()
  userId = decodeUserId(token)

  const productRes = await api.post('/products', {
    name: 'GraphQL Test Product',
    price: 15.0,
    stock: 50,
  })
  expect(productRes.status).toBe(201)
  productId = productRes.data.id as string

  const orderRes = await api.post('/orders', {
    userId,
    idempotencyKey: `gql-test-${Date.now()}`,
    items: [{ productId, quantity: 1 }],
  })
  expect(orderRes.status).toBe(201)
})

afterAll(async () => {
  const adminToken = await adminLogin()
  if (!adminToken) return
  const client = authed(adminToken)

  // Delete extra users (no orders, safe to delete directly)
  await Promise.all(extraUserIds.map((id) => client.delete(`/users/${id}`)))

  // Delete main user — cascades the order created in beforeAll
  if (userId) await client.delete(`/users/${userId}`)

  // Delete product after user/orders are gone
  if (productId) await api.delete(`/products/${productId}`)
})

describe('GraphQL', () => {
  describe('query orders', () => {
    it('returns HTTP 200 and an array of orders with expected fields', async () => {
      const res = await query({
        query: `
          query {
            orders(userId: "${userId}") {
              id
              userId
              status
              totalPrice
              createdAt
            }
          }
        `,
      })

      expect(res.status).toBe(200)
      expect(res.data.errors).toBeUndefined()
      expect(Array.isArray(res.data.data.orders)).toBe(true)
      expect(res.data.data.orders.length).toBeGreaterThan(0)

      const order = res.data.data.orders[0]
      expect(order).toHaveProperty('id')
      expect(order).toHaveProperty('userId')
      expect(order).toHaveProperty('status')
      expect(order).toHaveProperty('totalPrice')
    })

    it('filters by status PENDING — only pending orders returned', async () => {
      const res = await query({
        query: `
          query {
            orders(userId: "${userId}", filter: { status: PENDING }) {
              id
              status
            }
          }
        `,
      })

      expect(res.status).toBe(200)
      expect(res.data.errors).toBeUndefined()
      for (const order of res.data.data.orders) {
        expect(order.status).toBe('PENDING')
      }
    })

    it('pagination limit:1 returns at most 1 result', async () => {
      const res = await query({
        query: `
          query {
            orders(userId: "${userId}", pagination: { limit: 1 }) {
              id
            }
          }
        `,
      })

      expect(res.status).toBe(200)
      expect(res.data.errors).toBeUndefined()
      expect(res.data.data.orders.length).toBeLessThanOrEqual(1)
    })

    it('returns errors array for unknown field in query', async () => {
      const res = await query({
        query: `
          query {
            orders(userId: "${userId}") {
              id
              unknownField
            }
          }
        `,
      })

      expect(res.status).toBe(400)
      expect(res.data).toHaveProperty('errors')
      expect(Array.isArray(res.data.errors)).toBe(true)
    })

    it('returns empty array for user with no orders', async () => {
      const { token } = await registerAndLogin()
      const newUserId = decodeUserId(token)
      extraUserIds.push(newUserId)

      const res = await query({
        query: `
          query {
            orders(userId: "${newUserId}") {
              id
            }
          }
        `,
      })

      expect(res.status).toBe(200)
      expect(res.data.errors).toBeUndefined()
      expect(res.data.data.orders).toEqual([])
    })
  })
})
