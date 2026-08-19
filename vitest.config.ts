import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { loadEnv } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    env: { TZ: 'America/Mexico_City', ...loadEnv('test', process.cwd(), '') },
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
