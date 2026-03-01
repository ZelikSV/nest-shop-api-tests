import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 30000,
    pool: 'forks',
    sequence: {
      concurrent: false,
    },
    setupFiles: ['./src/setup.ts'],
  },
})
