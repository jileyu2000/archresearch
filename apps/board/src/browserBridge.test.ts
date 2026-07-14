import { describe, expect, it, vi } from 'vitest'

import { requestBrowserBridge } from './browserBridge'

describe('Board extension bridge client', () => {
  it('sends one correlated pairing request and validates the extension status', async () => {
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      const request = message as { id: string }
      queueMicrotask(() => {
        window.dispatchEvent(new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: {
            channel: 'archresearch.extension',
            protocol_version: 1,
            id: request.id,
            ok: true,
            result: {
              paired: true,
              connection: 'connecting',
              research_permission: false,
            },
          },
        }))
      })
    })

    await expect(requestBrowserBridge({
      type: 'pair',
      endpoint: 'ws://127.0.0.1:8000/v1/browser',
      token: 'one-time-code',
    })).resolves.toEqual({
      paired: true,
      connection: 'connecting',
      researchPermission: false,
    })
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'archresearch.board',
        protocol_version: 1,
        action: 'pair',
        payload: {
          endpoint: 'ws://127.0.0.1:8000/v1/browser',
          token: 'one-time-code',
        },
      }),
      window.location.origin,
    )
  })
})
