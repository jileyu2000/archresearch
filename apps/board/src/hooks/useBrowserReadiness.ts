import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '../api/client'
import {
  BrowserBridgeError,
  requestBrowserBridge,
  requestPublicBrowserBridgeStatus,
  resolveBrowserEndpoint,
  type BrowserBridgeStatus,
} from '../browserBridge'

type UseBrowserReadinessOptions = {
  demoMode: boolean
  publicEdition?: boolean
  onAnnouncement: (message: string) => void
  onError: (message: string) => void
}

function apiMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '操作未完成，请重试；若反复失败，请重启 ArchResearch。'
}

export function useBrowserReadiness({
  demoMode,
  publicEdition = false,
  onAnnouncement,
  onError,
}: UseBrowserReadinessOptions) {
  const [browserConnected, setBrowserConnected] = useState<boolean | null>(
    publicEdition ? true : null,
  )
  const [xiaohongshuSearchAvailable, setXiaohongshuSearchAvailable] = useState(false)
  const [browserReadinessLoading, setBrowserReadinessLoading] = useState(!demoMode)
  const [browserReadinessError, setBrowserReadinessError] = useState('')
  const [preflightBridgeStatus, setPreflightBridgeStatus] =
    useState<BrowserBridgeStatus | null>(null)
  const [browserPairingStatus, setBrowserPairingStatus] = useState('')
  const [browserConnecting, setBrowserConnecting] = useState(false)
  const readinessRequestRef = useRef(0)
  const chromeConnectAttemptedRef = useRef(false)
  const chromeConnectRequested = useMemo(
    () => new URLSearchParams(window.location.search).get('connect') === 'chrome',
    [],
  )

  const loadBrowserReadiness = useCallback(async (
    shouldApply: () => boolean = () => true,
  ) => {
    if (demoMode) return
    const requestId = readinessRequestRef.current + 1
    readinessRequestRef.current = requestId
    if (publicEdition) {
      try {
        const status = await requestPublicBrowserBridgeStatus()
        if (readinessRequestRef.current !== requestId || !shouldApply()) return
        setBrowserReadinessError('')
        setPreflightBridgeStatus(status)
        setBrowserConnected(status.connection === 'connected')
      } catch {
        if (readinessRequestRef.current !== requestId || !shouldApply()) return
        setBrowserReadinessError('')
        setPreflightBridgeStatus(null)
        setBrowserConnected(false)
      }
      setXiaohongshuSearchAvailable(false)
      setBrowserReadinessLoading(false)
      return
    }
    const [apiResult, bridgeResult] = await Promise.allSettled([
      apiClient.getBrowserStatus(),
      requestBrowserBridge({ type: 'status' }),
    ])
    if (readinessRequestRef.current !== requestId || !shouldApply()) return
    if (apiResult.status === 'fulfilled') {
      setBrowserReadinessError('')
      setBrowserConnected(apiResult.value.connected)
      setXiaohongshuSearchAvailable(apiResult.value.xiaohongshu_search_available)
    } else {
      setBrowserReadinessError(apiMessage(apiResult.reason))
      setBrowserConnected(null)
      setXiaohongshuSearchAvailable(false)
    }
    setPreflightBridgeStatus(
      bridgeResult.status === 'fulfilled' ? bridgeResult.value : null,
    )
    setBrowserReadinessLoading(false)
  }, [demoMode, publicEdition])

  const refreshBrowserReadiness = useCallback(async () => {
    if (demoMode) return
    setBrowserReadinessLoading(true)
    setBrowserReadinessError('')
    await loadBrowserReadiness()
  }, [demoMode, loadBrowserReadiness])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      void loadBrowserReadiness(() => active)
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [loadBrowserReadiness])

  const refreshBrowserConnection = useCallback(async () => {
    const requestId = readinessRequestRef.current + 1
    readinessRequestRef.current = requestId
    setBrowserPairingStatus('正在检查连接…')
    try {
      const status = await apiClient.getBrowserStatus()
      if (readinessRequestRef.current !== requestId) return
      setBrowserConnected(status.connected)
      setBrowserPairingStatus(status.connected ? '图纸提取扩展已连接' : '扩展尚未连接')
    } catch (error) {
      if (readinessRequestRef.current !== requestId) return
      setBrowserConnected(null)
      setBrowserPairingStatus(apiMessage(error))
    }
  }, [])

  const handleConnectBrowser = useCallback(async (launchChromeOnUnavailable = true) => {
    const requestId = readinessRequestRef.current + 1
    readinessRequestRef.current = requestId
    setBrowserConnecting(true)
    setBrowserPairingStatus('正在检查当前页面的 Chrome 扩展…')
    if (publicEdition) {
      try {
        const status = await requestPublicBrowserBridgeStatus()
        if (readinessRequestRef.current !== requestId) return
        setPreflightBridgeStatus(status)
        setBrowserConnected(status.connection === 'connected')
        setBrowserPairingStatus(
          status.researchPermission
            ? 'Chrome 扩展已连接，可以读取小红书公开笔记'
            : '扩展已安装；请在浏览器工具栏打开 ArchResearch，允许网页读取',
        )
      } catch {
        if (readinessRequestRef.current !== requestId) return
        setBrowserConnected(false)
        setPreflightBridgeStatus(null)
        setBrowserPairingStatus('尚未检测到扩展。安装后请在浏览器工具栏打开 ArchResearch，选择“连接当前 ArchResearch 网页”。')
      } finally {
        setBrowserConnecting(false)
      }
      return
    }
    try {
      const bridgeStatus = await requestBrowserBridge({ type: 'status' })
      if (readinessRequestRef.current !== requestId) return
      setPreflightBridgeStatus(bridgeStatus)
      if (bridgeStatus.connection === 'connected') {
        const status = await apiClient.getBrowserStatus()
        if (readinessRequestRef.current !== requestId) return
        if (status.connected) {
          setBrowserConnected(true)
          setBrowserPairingStatus('图纸提取扩展已连接')
          return
        }
      }
      const pairing = await apiClient.createBrowserPairingCode()
      if (readinessRequestRef.current !== requestId) return
      const pairedStatus = await requestBrowserBridge({
        type: 'pair',
        endpoint: resolveBrowserEndpoint(),
        token: pairing.code,
      })
      if (readinessRequestRef.current !== requestId) return
      setPreflightBridgeStatus(pairedStatus)
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const status = await apiClient.getBrowserStatus()
        if (readinessRequestRef.current !== requestId) return
        if (status.connected) {
          setBrowserConnected(true)
          setBrowserPairingStatus('图纸提取扩展已连接')
          onAnnouncement('图纸提取扩展已连接')
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }
      throw new BrowserBridgeError('rejected', 'Pairing authentication timed out')
    } catch (error) {
      if (readinessRequestRef.current !== requestId) return
      setBrowserConnected(false)
      setPreflightBridgeStatus(null)
      if (
        error instanceof BrowserBridgeError
        && error.code === 'unavailable'
        && launchChromeOnUnavailable
      ) {
        try {
          await apiClient.openChromeBoard()
          if (readinessRequestRef.current !== requestId) return
          setBrowserPairingStatus('已在 Chrome 打开本页；新页面会自动连接扩展。当前公开网页研究不受影响。')
        } catch (launchError) {
          if (readinessRequestRef.current !== requestId) return
          setBrowserPairingStatus(`无法自动打开 Chrome：${apiMessage(launchError)}`)
        }
      } else {
        setBrowserPairingStatus(
          error instanceof BrowserBridgeError && error.code === 'unavailable'
            ? '当前 Chrome 页面没有检测到 ArchResearch 扩展；公开网页研究仍可继续。'
            : '与 Chrome 的连接没有完成。请点击“连接 Chrome 读取高清图纸”重新连接。',
        )
      }
    } finally {
      setBrowserConnecting(false)
    }
  }, [onAnnouncement, publicEdition])

  useEffect(() => {
    if (
      demoMode
      || !chromeConnectRequested
      || browserConnected !== false
      || browserConnecting
      || chromeConnectAttemptedRef.current
    ) return
    chromeConnectAttemptedRef.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('connect')
    url.searchParams.delete('attempt')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void handleConnectBrowser(false)
  }, [
    browserConnected,
    browserConnecting,
    chromeConnectRequested,
    demoMode,
    handleConnectBrowser,
  ])

  const ensureBrowserResearchAccess = useCallback(async (requireConnected = false) => {
    if (publicEdition) {
      if (!requireConnected) return true
      try {
        const status = await requestPublicBrowserBridgeStatus()
        setPreflightBridgeStatus(status)
        setBrowserConnected(status.connection === 'connected')
        if (status.connection === 'connected' && status.researchPermission) return true
        onError('小红书研究需要 Chrome 扩展的网页读取权限。请打开浏览器工具栏中的 ArchResearch，连接当前网页并允许读取。')
      } catch {
        setPreflightBridgeStatus(null)
        setBrowserConnected(false)
        onError('小红书研究需要安装 ArchResearch Chrome 扩展。安装后连接当前网页，再开始研究。')
      }
      return false
    }
    if (requireConnected && xiaohongshuSearchAvailable) {
      setBrowserPairingStatus('')
      return true
    }
    if (browserConnected !== true) {
      if (requireConnected) {
        onError('小红书研究需要已登录的小红书账号。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
        return false
      }
      return true
    }
    const requestId = readinessRequestRef.current + 1
    readinessRequestRef.current = requestId
    try {
      const status = await requestBrowserBridge({ type: 'status' })
      if (readinessRequestRef.current !== requestId) return false
      setPreflightBridgeStatus(status)
      if (status.researchPermission) {
        setBrowserPairingStatus('')
        return true
      }
    } catch (error) {
      if (readinessRequestRef.current !== requestId) return false
      if (error instanceof BrowserBridgeError && error.code === 'unavailable') {
        setBrowserConnected(false)
        setPreflightBridgeStatus(null)
        if (requireConnected) {
          onError('小红书研究需要已登录的小红书账号。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
          return false
        }
        setBrowserPairingStatus('当前页面未检测到 Chrome 扩展；本次将继续研究公开网页，并跳过登录页面和当前页面的高清图纸读取。')
        return true
      }
      onError('无法向扩展确认网页读取权限。请在已安装扩展的 Chrome 中打开本页。')
      return false
    }
    onError('Chrome 首次使用需要你确认网页读取权限。连接会自动完成，无需输入任何代码；请点击浏览器工具栏的 ArchResearch，选择“允许网页读取”，再回来开始研究。授权后不会每次重复询问。')
    return false
  }, [browserConnected, onError, publicEdition, xiaohongshuSearchAvailable])

  const extensionDetected = preflightBridgeStatus !== null
  const browserBridgeAvailable = preflightBridgeStatus?.connection === 'connected'
    || (preflightBridgeStatus?.paired === true && preflightBridgeStatus.connection === 'connecting')
  const browserReadinessState = browserReadinessLoading
    ? 'loading'
    : browserReadinessError
      ? 'unknown'
      : browserConnected !== true
        ? 'disconnected'
        : !preflightBridgeStatus
          ? 'surface-missing'
          : !browserBridgeAvailable
            ? 'surface-disconnected'
            : preflightBridgeStatus.researchPermission
              ? 'ready'
              : 'permission'
  const researchEnvironmentReady = publicEdition
    ? browserReadinessState === 'ready'
    : xiaohongshuSearchAvailable || browserReadinessState === 'ready'
  const researchEnvironmentTitle = publicEdition
    ? researchEnvironmentReady
      ? '小红书图纸检索已就绪'
      : extensionDetected
        ? '扩展还需要网页读取权限'
        : '需要 Chrome 扩展'
    : browserReadinessState === 'loading'
    ? '正在检查研究环境'
    : researchEnvironmentReady
      ? '研究环境已就绪'
      : browserReadinessState === 'unknown'
        ? '研究环境状态未知'
        : '研究环境待连接'
  const researchEnvironmentDetail = publicEdition
    ? researchEnvironmentReady
      ? '使用你已登录的小红书查找公开笔记 · Cookie 和账号不会上传'
      : extensionDetected
        ? '打开浏览器工具栏的 ArchResearch，连接当前网页并允许读取'
        : '安装扩展后，使用你已登录的小红书读取公开笔记'
    : xiaohongshuSearchAvailable
    ? browserReadinessState === 'ready'
      ? '小红书负责查找灵感 · Chrome 可读取当前页面高清图'
      : browserReadinessState === 'permission'
        ? '小红书负责查找灵感 · Chrome 读取当前页面需授权'
        : browserReadinessState === 'loading'
          ? '小红书负责查找灵感 · 正在检查 Chrome 页面读取'
          : '小红书负责查找灵感 · 连接 Chrome 可读取当前页面高清图'
    : {
    loading: '正在检查 Chrome 与网页权限',
    unknown: '连接状态未读取，请稍后刷新',
    disconnected: '连接 Chrome 后可搜索小红书，并读取当前页面高清图',
    'surface-missing': '当前页面未检测到扩展',
    'surface-disconnected': '当前页面扩展未连通',
    permission: 'Chrome 读取当前页面需授权：点击浏览器工具栏的 ArchResearch，选择“允许网页读取”，再点“刷新”',
    ready: 'Chrome 可读取当前页面高清图 · 登录小红书后可搜索笔记',
  }[browserReadinessState]
  const showBrowserConnectAction = !browserReadinessLoading
    && (publicEdition
      ? browserReadinessState !== 'ready'
      : browserConnected !== true || !browserBridgeAvailable)

  return {
    browserConnected,
    browserConnecting,
    browserPairingStatus,
    browserReadinessError,
    browserReadinessLoading,
    browserReadinessState,
    extensionDetected,
    ensureBrowserResearchAccess,
    handleConnectBrowser,
    loadBrowserReadiness,
    refreshBrowserConnection,
    refreshBrowserReadiness,
    researchEnvironmentDetail,
    researchEnvironmentReady,
    researchEnvironmentTitle,
    showBrowserConnectAction,
    xiaohongshuSearchAvailable,
  }
}
