import { describe, it, expect, afterAll } from 'vitest'
import { api } from '../helpers/client'

const productIdsToCleanup: string[] = []

afterAll(async () => {
  await Promise.all(productIdsToCleanup.map((id) => api.delete(`/products/${id}`)))
})

describe('Products (no auth required)', () => {
  describe('POST /products', () => {
    it('returns 201 with created product', async () => {
      const res = await api.post('/products', {
        name: 'Test Product',
        description: 'Integration test product',
        price: 9.99,
        stock: 10,
      })
      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('id')
      expect(res.data.name).toBe('Test Product')
      productIdsToCleanup.push(res.data.id as string)
    })
  })

  describe('GET /products', () => {
    it('returns 200 with an array of products', async () => {
      const res = await api.get('/products')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
    })

    it('has at least one item after creation', async () => {
      const res = await api.get('/products')
      expect(res.status).toBe(200)
      expect(res.data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /products/:id', () => {
    it('returns 200 with the product for a known id', async () => {
      const createRes = await api.post('/products', {
        name: 'Get By Id Product',
        price: 5.0,
        stock: 1,
      })
      expect(createRes.status).toBe(201)
      const id = createRes.data.id as string
      productIdsToCleanup.push(id)

      const res = await api.get(`/products/${id}`)
      expect(res.status).toBe(200)
      expect(res.data.id).toBe(id)
    })

    it('returns 404 for unknown uuid', async () => {
      const res = await api.get('/products/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /products/:id', () => {
    it('returns 200 with updated product', async () => {
      const createRes = await api.post('/products', {
        name: 'To Update',
        price: 10.0,
        stock: 5,
      })
      expect(createRes.status).toBe(201)
      const id = createRes.data.id as string
      productIdsToCleanup.push(id)

      const res = await api.put(`/products/${id}`, {
        name: 'Updated Product',
        price: 19.99,
      })
      expect(res.status).toBe(200)
      expect(res.data.name).toBe('Updated Product')
    })
  })

  describe('DELETE /products/:id', () => {
    it('returns 204 when deleting an existing product', async () => {
      const createRes = await api.post('/products', {
        name: 'To Delete',
        price: 1.0,
        stock: 0,
      })
      expect(createRes.status).toBe(201)
      const id = createRes.data.id as string

      const deleteRes = await api.delete(`/products/${id}`)
      expect(deleteRes.status).toBe(204)
    })

    it('returns 404 after deletion', async () => {
      const createRes = await api.post('/products', {
        name: 'To Delete 2',
        price: 1.0,
        stock: 0,
      })
      expect(createRes.status).toBe(201)
      const id = createRes.data.id as string
      await api.delete(`/products/${id}`)

      const getRes = await api.get(`/products/${id}`)
      expect(getRes.status).toBe(404)
    })
  })
})
