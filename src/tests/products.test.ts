import { describe, it, expect, beforeAll } from 'vitest'
import { api } from '../helpers/client'

let createdProductId: string

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
      createdProductId = res.data.id as string
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
      const res = await api.get(`/products/${createdProductId}`)
      expect(res.status).toBe(200)
      expect(res.data.id).toBe(createdProductId)
    })

    it('returns 404 for unknown uuid', async () => {
      const res = await api.get('/products/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /products/:id', () => {
    it('returns 200 with updated product', async () => {
      const res = await api.put(`/products/${createdProductId}`, {
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
      const id = createRes.data.id as string
      await api.delete(`/products/${id}`)

      const getRes = await api.get(`/products/${id}`)
      expect(getRes.status).toBe(404)
    })
  })
})
