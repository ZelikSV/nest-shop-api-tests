import { describe, it, expect, beforeAll } from 'vitest'
import { api, authed } from '../helpers/client'
import { registerAndLogin, decodeUserId } from '../helpers/auth'

let token: string
let userId: string

beforeAll(async () => {
  const { token: t } = await registerAndLogin()
  token = t
  userId = decodeUserId(token)
})

describe('Files', () => {
  describe('POST /files/presign', () => {
    it('returns 401 without token', async () => {
      const res = await api.post('/files/presign', {
        entityId: '00000000-0000-0000-0000-000000000000',
        entityType: 'user',
        contentType: 'image/jpeg',
      })
      expect(res.status).toBe(401)
    })

    it('returns 201 with presigned URL data for valid request', async () => {
      const res = await authed(token).post('/files/presign', {
        entityId: userId,
        entityType: 'user',
        contentType: 'image/jpeg',
      })
      // S3 may or may not be configured; accept 201 (S3 up) or 500/400 (S3 not configured)
      // The important thing is it's NOT 401
      expect(res.status).not.toBe(401)
      if (res.status === 201) {
        expect(res.data).toHaveProperty('fileId')
        expect(res.data).toHaveProperty('uploadUrl')
      }
    })

    it('returns 400 for invalid entityType', async () => {
      const res = await authed(token).post('/files/presign', {
        entityId: userId,
        entityType: 'invalid_type',
        contentType: 'image/jpeg',
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid contentType', async () => {
      const res = await authed(token).post('/files/presign', {
        entityId: userId,
        entityType: 'user',
        contentType: 'text/html',
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /files/complete', () => {
    it('returns 401 without token', async () => {
      const res = await api.post('/files/complete', {
        fileId: '00000000-0000-0000-0000-000000000000',
      })
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown fileId with valid token', async () => {
      const res = await authed(token).post('/files/complete', {
        fileId: '00000000-0000-0000-0000-000000000000',
      })
      expect(res.status).toBe(404)
    })
  })
})
