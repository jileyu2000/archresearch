import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient, type BrowserStatus } from '../api/client'
import { requestBrowserBridge, type BrowserBridgeStatus } from '../browserBridge'
import { useBrowserReadiness } from './useBrowserReadiness'

vi.mock('../browserBridge', async (importOriginal) => ({
  ...await importOriginal<typeof import('../browserBridge')>(),
  requestBrowserBridge: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, reject, resolve }
}

const readyBridge: BrowserBridgeStatus = {
  paired: true,
  connection: 'connected',
  researchPermission: true,
}

function renderReadiness() {
  return renderHook(() => useBrowserReadiness({
    demoMode: false,
    onAnnouncement: vi.fn(),
    onError: vi.fn(),
  }))
}

describe('useBrowserReadiness', () => {
  beforeEach(() => {
    vi.mocked(requestBrowserBridge).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('combines local service and current-page permission into the initial environment state', async () => {
    vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: true,
      xiaohongshu_search_available: false,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'connected',
      researchPermission: false,
    })

    const { result } = renderReadiness()

    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))
    expect(result.current.browserConnected).toBe(true)
    expect(result.current.xiaohongshuSearchAvailable).toBe(false)
    expect(result.current.browserReadinessState).toBe('permission')
    expect(result.current.researchEnvironmentTitle).toBe('研究环境待连接')
    expect(result.current.researchEnvironmentDetail).toContain('Chrome 读取当前页面需授权')
    expect(result.current.showBrowserConnectAction).toBe(false)
  })

  it('keeps the newest readiness check when an older request resolves last', async () => {
    vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: false,
      xiaohongshu_search_available: false,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: false,
      connection: 'disconnected',
      researchPermission: false,
    })
    const { result } = renderReadiness()
    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))

    const olderApi = deferred<BrowserStatus>()
    const newerApi = deferred<BrowserStatus>()
    const olderBridge = deferred<BrowserBridgeStatus>()
    const newerBridge = deferred<BrowserBridgeStatus>()
    vi.spyOn(apiClient, 'getBrowserStatus')
      .mockImplementationOnce(() => olderApi.promise)
      .mockImplementationOnce(() => newerApi.promise)
    vi.mocked(requestBrowserBridge)
      .mockImplementationOnce(() => olderBridge.promise)
      .mockImplementationOnce(() => newerBridge.promise)

    let olderRefresh!: Promise<void>
    let newerRefresh!: Promise<void>
    act(() => {
      olderRefresh = result.current.refreshBrowserReadiness()
      newerRefresh = result.current.refreshBrowserReadiness()
    })

    await act(async () => {
      newerApi.resolve({ connected: false, xiaohongshu_search_available: false })
      newerBridge.resolve({
        paired: false,
        connection: 'disconnected',
        researchPermission: false,
      })
      await newerRefresh
    })
    await act(async () => {
      olderApi.resolve({ connected: true, xiaohongshu_search_available: true })
      olderBridge.resolve(readyBridge)
      await olderRefresh
    })

    expect(result.current.browserConnected).toBe(false)
    expect(result.current.xiaohongshuSearchAvailable).toBe(false)
    expect(result.current.browserReadinessState).toBe('disconnected')
  })

  it('finishes loading with an honest unknown state when the service check fails', async () => {
    vi.spyOn(apiClient, 'getBrowserStatus').mockRejectedValue(new Error('status offline'))
    vi.mocked(requestBrowserBridge).mockResolvedValue(readyBridge)

    const { result } = renderReadiness()

    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))
    expect(result.current.browserConnected).toBeNull()
    expect(result.current.xiaohongshuSearchAvailable).toBe(false)
    expect(result.current.browserReadinessError).toBe('status offline')
    expect(result.current.browserReadinessState).toBe('unknown')
    expect(result.current.researchEnvironmentTitle).toBe('研究环境状态未知')
    expect(result.current.researchEnvironmentDetail).toBe('连接状态未读取，请稍后刷新')
  })

  it('refreshes the service connection message for connected, disconnected, and failed checks', async () => {
    const status = vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: false,
      xiaohongshu_search_available: false,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue(readyBridge)
    const { result } = renderReadiness()
    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))

    status.mockResolvedValueOnce({
      connected: true,
      xiaohongshu_search_available: false,
    })
    await act(() => result.current.refreshBrowserConnection())
    expect(result.current.browserConnected).toBe(true)
    expect(result.current.browserPairingStatus).toBe('图纸提取扩展已连接')

    status.mockResolvedValueOnce({
      connected: false,
      xiaohongshu_search_available: false,
    })
    await act(() => result.current.refreshBrowserConnection())
    expect(result.current.browserConnected).toBe(false)
    expect(result.current.browserPairingStatus).toBe('扩展尚未连接')

    status.mockRejectedValueOnce(new Error('service unavailable'))
    await act(() => result.current.refreshBrowserConnection())
    expect(result.current.browserConnected).toBeNull()
    expect(result.current.browserPairingStatus).toBe('service unavailable')
  })

  it('uses an available Xiaohongshu search session without another permission request', async () => {
    vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: true,
      xiaohongshu_search_available: true,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue(readyBridge)
    const session = vi.spyOn(apiClient, 'checkXiaohongshuSession').mockResolvedValue({
      status: 'logged_in',
      channel: 'local_search',
    })
    const { result } = renderReadiness()
    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))

    await expect(result.current.ensureBrowserResearchAccess(true)).resolves.toBe(true)
    expect(requestBrowserBridge).toHaveBeenCalledOnce()
    expect(session).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(result.current.researchEnvironmentTitle).toBe('研究环境已就绪')
    })
    expect(result.current.researchEnvironmentDetail).toBe(
      '小红书负责查找灵感 · Chrome 可读取当前页面高清图',
    )
  })

  it('allows public-page research when optional Chrome access is disconnected', async () => {
    vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: false,
      xiaohongshu_search_available: false,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: false,
      connection: 'disconnected',
      researchPermission: false,
    })
    const { result } = renderReadiness()
    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))

    await expect(result.current.ensureBrowserResearchAccess(false)).resolves.toBe(true)
    expect(requestBrowserBridge).toHaveBeenCalledOnce()
  })

  it('blocks Xiaohongshu research until the current page grants research permission', async () => {
    const onError = vi.fn()
    vi.spyOn(apiClient, 'getBrowserStatus').mockResolvedValue({
      connected: true,
      xiaohongshu_search_available: false,
    })
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'connected',
      researchPermission: false,
    })
    const { result } = renderHook(() => useBrowserReadiness({
      demoMode: false,
      onAnnouncement: vi.fn(),
      onError,
    }))
    await waitFor(() => expect(result.current.browserReadinessLoading).toBe(false))

    await expect(result.current.ensureBrowserResearchAccess(true)).resolves.toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('允许网页读取'))
  })

  it('does not check live browser services in demo mode', async () => {
    const status = vi.spyOn(apiClient, 'getBrowserStatus')
    const { result } = renderHook(() => useBrowserReadiness({
      demoMode: true,
      onAnnouncement: vi.fn(),
      onError: vi.fn(),
    }))

    await act(() => result.current.refreshBrowserReadiness())

    expect(result.current.browserReadinessLoading).toBe(false)
    expect(status).not.toHaveBeenCalled()
    expect(requestBrowserBridge).not.toHaveBeenCalled()
  })
})
