import { describe, it, expect } from 'vitest'
import { api, authed } from '../helpers/client'
import { uniqueEmail, register, login } from '../helpers/auth'

describe('Auth', () => {
  describe('POST /auth/register', () => {
    it('returns 201 with accessToken on valid data', async () => {
      const email = uniqueEmail()
      const res = await register({ email })
      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('accessToken')
      expect(typeof res.data.accessToken).toBe('string')
    })

    it('returns 400 when required fields are missing', async () => {
      const res = await api.post('/auth/register', {})
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid email format', async () => {
      const res = await register({ email: 'not-an-email' })
      expect(res.status).toBe(400)
    })

    it('returns 400 for password shorter than 6 characters', async () => {
      const res = await register({ password: '123' })
      expect(res.status).toBe(400)
    })

    it('returns 409 when email already registered', async () => {
      const email = uniqueEmail()
      await register({ email })
      const res = await register({ email })
      expect(res.status).toBe(409)
    })
  })

  describe('POST /auth/login', () => {
    it('returns 201 with accessToken on valid credentials', async () => {
      const email = uniqueEmail()
      await register({ email })
      const res = await login(email)
      expect(res.status).toBe(201)
      expect(res.data).toHaveProperty('accessToken')
      expect(typeof res.data.accessToken).toBe('string')
    })

    it('returns 401 on wrong password', async () => {
      const email = uniqueEmail()
      await register({ email })
      const res = await login(email, 'wrongpassword')
      expect(res.status).toBe(401)
    })

    it('returns 401 for unknown user', async () => {
      const res = await login('nonexistent@example.com')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /auth/profile', () => {
    it('returns 200 with user data for valid token', async () => {
      const email = uniqueEmail()
      const registerRes = await register({ email })
      const token = registerRes.data.accessToken as string

      const res = await authed(token).get('/auth/profile')
      expect(res.status).toBe(200)
      expect(res.data).toHaveProperty('email', email)
    })

    it('returns 401 when no token provided', async () => {
      const res = await api.get('/auth/profile')
      expect(res.status).toBe(401)
    })

    it('returns 401 for invalid token', async () => {
      const res = await authed('invalid.token.here').get('/auth/profile')
      expect(res.status).toBe(401)
    })
  })
})
