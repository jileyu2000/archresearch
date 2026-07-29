import { describe, expect, it, vi } from 'vitest'

import {
  requestBrowserBridge,
  requestXiaohongshuSearch,
  resolveBrowserEndpoint,
} from './browserBridge'

describe('Board extension bridge client', () => {
  it('uses the API port selected by the local launcher', () => {
    expect(resolveBrowserEndpoint('ws://127.0.0.1:8007/v1/browser')).toBe(
      'ws://127.0.0.1:8007/v1/browser',
    )
  })

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

  it('accepts only a correlated, bounded Xiaohongshu visual-source response', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
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
              sources: [{
                source_url: 'https://www.xiaohongshu.com/explore/note-1',
                title: '蓝色轴测图',
                image_url: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
                adjacent_text: '蓝色轴测图，细线和编号。',
              }],
            },
          },
        }))
      })
    })

    await expect(requestXiaohongshuSearch('社区图书馆 蓝色轴测图')).resolves.toEqual([{
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      adjacentText: '蓝色轴测图，细线和编号。',
    }])
    expect(window.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'xiaohongshu_search',
        payload: { query: '社区图书馆 蓝色轴测图' },
      }),
      window.location.origin,
    )
  })
})
