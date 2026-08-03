import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    env: { TZ: 'America/Mexico_City' },
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
