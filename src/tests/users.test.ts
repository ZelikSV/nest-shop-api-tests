import { describe, it, expect, beforeAll } from 'vitest'
import { api, authed } from '../helpers/client'
import { adminLogin, registerAndLogin, uniqueEmail } from '../helpers/auth'

let adminToken: string
let customerToken: string
let createdUserId: string

beforeAll(async () => {
  const token = await adminLogin()
  if (!token) throw new Error('Admin login failed — seed data missing?')
  adminToken = token

  const { token: ct } = await registerAndLogin()
  customerToken = ct
})

describe('Users (admin only)', () => {
  describe('GET /users', () => {
    it('returns 401 without token', async () => {
      const res = await api.get('/users')
      expect(res.status).toBe(401)
    })

    it('returns 403 with customer token', async () => {
      const res = await authed(customerToken).get('/users')
      expect(res.status).toBe(403)
    })

    it('returns 200 with admin token', async () => {
      const res = await authed(adminToken).get('/users')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)
    })
  })

  describe('POST /users/new', () => {
    it('returns 201 with created user (admin)', async () => {
      const email = uniqueEmail()
      const res = await authed(adminToken).post('/users/new', {
        firstName: 'Admin',
        lastName: 'Created',
        age: 30,
        email,
      })
      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('id')
      expect(res.data.email).toBe(email)
      createdUserId = res.data.id as string
    })

    it('returns 401 without token', async () => {
      const res = await api.post('/users/new', {
        firstName: 'X',
        lastName: 'Y',
        age: 20,
        email: uniqueEmail(),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /users/:id', () => {
    it('returns 200 for existing user (admin)', async () => {
      const res = await authed(adminToken).get(`/users/${createdUserId}`)
      expect(res.status).toBe(200)
      expect(res.data.id).toBe(createdUserId)
    })

    it('returns 404 for unknown uuid', async () => {
      const res = await authed(adminToken).get('/users/00000000-0000-0000-0000-000000000000')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /users/:id', () => {
    it('returns 200 with updated user (admin)', async () => {
      const res = await authed(adminToken).put(`/users/${createdUserId}`, {
        firstName: 'Updated',
        lastName: 'Name',
        age: 35,
      })
      expect(res.status).toBe(200)
      expect(res.data.firstName).toBe('Updated')
    })
  })

  describe('DELETE /users/:id', () => {
    it('returns 204 when deleting (admin)', async () => {
      const email = uniqueEmail()
      const createRes = await authed(adminToken).post('/users/new', {
        firstName: 'Delete',
        lastName: 'Me',
        age: 25,
        email,
      })
      expect(createRes.status).toBe(201)
      const id = createRes.data.id as string

      const deleteRes = await authed(adminToken).delete(`/users/${id}`)
      expect(deleteRes.status).toBe(204)
    })

    it('returns 404 after deletion', async () => {
      const email = uniqueEmail()
      const createRes = await authed(adminToken).post('/users/new', {
        firstName: 'Delete',
        lastName: 'Me2',
        age: 25,
        email,
      })
      const id = createRes.data.id as string
      await authed(adminToken).delete(`/users/${id}`)

      const getRes = await authed(adminToken).get(`/users/${id}`)
      expect(getRes.status).toBe(404)
    })
  })
})
