import { api } from './client'

let counter = 0

export function uniqueEmail(): string {
  counter++
  return `test_${Date.now()}_${counter}_${Math.random().toString(36).slice(2)}@example.com`
}

export interface RegisterPayload {
  firstName?: string
  lastName?: string
  age?: number
  email?: string
  password?: string
}

export async function register(overrides: RegisterPayload = {}): Promise<any> {
  const payload = {
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    age: overrides.age ?? 25,
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? 'password123',
  }
  return api.post('/auth/register', payload)
}

export async function login(email: string, password = 'password123'): Promise<any> {
  return api.post('/auth/login', { email, password })
}

export async function registerAndLogin(
  overrides: RegisterPayload = {},
): Promise<{ token: string; email: string }> {
  const email = overrides.email ?? uniqueEmail()
  const password = overrides.password ?? 'password123'

  const res = await register({ ...overrides, email, password })
  if (res.status !== 201) {
    throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.data)}`)
  }

  return { token: res.data.accessToken as string, email }
}

export async function adminLogin(): Promise<string | null> {
  const email = process.env.ADMIN_EMAIL ?? 'mike.johnson@example.com'
  const password = process.env.ADMIN_PASSWORD ?? 'password123'

  const res = await login(email, password)
  if (res.status !== 201) return null
  return res.data.accessToken as string
}

export function decodeUserId(token: string): string {
  const payload = token.split('.')[1]
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  return decoded.sub as string
}
