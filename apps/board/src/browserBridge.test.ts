import { describe, expect, it, vi } from 'vitest'

import {
  requestBrowserBridge,
  requestPublicBrowserBridgeStatus,
  requestXiaohongshuResearch,
  requestXiaohongshuSearch,
  resolveBrowserEndpoint,
  subscribePublicBrowserBridgeReady,
} from './browserBridge'

describe('Board extension bridge client', () => {
  it('uses the API port selected by the local launcher', () => {
    expect(resolveBrowserEndpoint('ws://127.0.0.1:8007/v1/browser')).toBe(
      'ws://127.0.0.1:8007/v1/browser',
    )
  })

  it('derives the local browser endpoint from the installed page origin', () => {
    expect(resolveBrowserEndpoint(
      undefined,
      'http://127.0.0.1:49152/projects',
    )).toBe('ws://127.0.0.1:49152/v1/browser')
    expect(resolveBrowserEndpoint(
      undefined,
      'https://public.example/projects',
    )).toBe('ws://127.0.0.1:8000/v1/browser')
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

  it('uses public protocol v2 for planned directions and deeply inspected images', async () => {
    const timeout = vi.spyOn(window, 'setTimeout')
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      const request = message as { id: string; action: string }
      queueMicrotask(() => {
        window.dispatchEvent(new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: request.action === 'status'
            ? {
                channel: 'archresearch.extension',
                protocol_version: 2,
                id: request.id,
                ok: true,
                result: {
                  paired: true,
                  connection: 'connected',
                  research_permission: true,
                  visual_protocol: 2,
                },
              }
            : {
                channel: 'archresearch.extension',
                protocol_version: 2,
                id: request.id,
                ok: true,
                result: {
                  sources: [{
                    direction_id: 'linework',
                    source_url: 'https://www.xiaohongshu.com/explore/note-1',
                    title: '蓝色轴测图',
                    image_url: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
                    preview_data_url: 'data:image/png;base64,aW1hZ2U=',
                    adjacent_text: '蓝色轴测图，细线和编号。',
                  }],
                  budget: {
                    image_count: 1,
                    preview_bytes: 30,
                    exhausted: false,
                  },
                },
              },
        }))
      })
    })

    await expect(requestPublicBrowserBridgeStatus()).resolves.toMatchObject({
      paired: true,
      connection: 'connected',
      researchPermission: true,
      visualProtocol: 2,
    })
    await expect(requestXiaohongshuResearch([{
      id: 'linework',
      query: '社区图书馆 精细线稿 轴测图',
    }])).resolves.toEqual([{
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
      adjacentText: '蓝色轴测图，细线和编号。',
    }])
    expect(window.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        protocol_version: 2,
        action: 'xiaohongshu_research',
        payload: {
          directions: [{
            id: 'linework',
            query: '社区图书馆 精细线稿 轴测图',
          }],
        },
      }),
      window.location.origin,
    )
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 8 * 60 * 1_000)
  })

  it('announces only a same-page public bridge activation', () => {
    const onReady = vi.fn()
    const unsubscribe = subscribePublicBrowserBridgeReady(onReady)

    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      origin: window.location.origin,
      data: {
        channel: 'archresearch.extension',
        protocol_version: 2,
        action: 'ready',
        extra: true,
      },
    }))
    window.dispatchEvent(new MessageEvent('message', {
      source: window,
      origin: window.location.origin,
      data: {
        channel: 'archresearch.extension',
        protocol_version: 2,
        action: 'ready',
      },
    }))

    expect(onReady).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('rejects visual observations that are not bound to a requested direction', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      const request = message as { id: string }
      queueMicrotask(() => {
        window.dispatchEvent(new MessageEvent('message', {
          source: window,
          origin: window.location.origin,
          data: {
            channel: 'archresearch.extension',
            protocol_version: 2,
            id: request.id,
            ok: true,
            result: {
              sources: [{
                direction_id: 'unrequested',
                source_url: 'https://www.xiaohongshu.com/explore/note-1',
                title: '蓝色轴测图',
                image_url: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
                preview_data_url: 'data:image/png;base64,aW1hZ2U=',
                adjacent_text: '蓝色轴测图，细线和编号。',
              }],
              budget: {
                image_count: 1,
                preview_bytes: 30,
                exhausted: false,
              },
            },
          },
        }))
      })
    })

    await expect(requestXiaohongshuResearch([{
      id: 'linework',
      query: '社区图书馆 精细线稿 轴测图',
    }])).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
