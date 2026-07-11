import { describe, expect, it } from 'vitest'

import config, { createViteConfig } from './vite.config'

describe('board development server', () => {
  it('proxies the local API on the shared loopback port', () => {
    expect(config.server?.proxy).toMatchObject({
      '/v1': 'http://127.0.0.1:8000',
    })
  })

  it('accepts the ports selected by the Windows start script', () => {
    const selected = createViteConfig({
      ARCHRESEARCH_API_ORIGIN: 'http://127.0.0.1:8011',
      ARCHRESEARCH_BOARD_PORT: '5184',
    })

    expect(selected.server?.port).toBe(5184)
    expect(selected.server?.proxy).toMatchObject({
      '/v1': 'http://127.0.0.1:8011',
    })
  })
})
