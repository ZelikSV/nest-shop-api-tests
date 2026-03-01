import axios, { type AxiosInstance } from 'axios'

export const BASE = process.env.API_URL ?? 'http://localhost:3333'

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api/v1`,
  validateStatus: () => true,
})

export const gqlEndpoint = `${BASE}/graphql`

export function authed(token: string): AxiosInstance {
  return axios.create({
    baseURL: `${BASE}/api/v1`,
    validateStatus: () => true,
    headers: { Authorization: `Bearer ${token}` },
  })
}
