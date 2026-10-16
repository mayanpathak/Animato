import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure TypeScript units (plan 15.3). Browser behaviour is covered by Playwright.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
