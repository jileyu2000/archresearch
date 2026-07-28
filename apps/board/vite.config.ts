import { env as processEnvironment } from 'node:process'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

type DevEnvironment = Record<string, string | undefined>

export function createViteConfig(environment: DevEnvironment = processEnvironment) {
  const requestedPort = Number(environment.ARCHRESEARCH_BOARD_PORT ?? 5173)

  return defineConfig({
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: Number.isInteger(requestedPort) ? requestedPort : 5173,
      proxy: {
        '/v1': environment.ARCHRESEARCH_API_ORIGIN ?? 'http://127.0.0.1:8000',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
        reporter: ['text', 'json-summary'],
        reportsDirectory: '../../.artifacts/coverage/board',
        thresholds: {
          statements: 78.17,
          branches: 72.39,
          functions: 80.5,
          lines: 81.78,
        },
      },
    },
  })
}

export default createViteConfig()
