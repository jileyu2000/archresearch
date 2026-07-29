import { useEffect, useMemo, useRef, useState } from 'react'

import BoardApp from '../../board/src/App'
import {
  configureApiClient,
  type ApiClient,
} from '../../board/src/api/client'
import { createPublicApiClient } from './api/publicClient'

interface AppProps {
  client?: ApiClient
  clientSessionId?: string
  verificationToken?: string
}

interface PublicConfig {
  turnstileSiteKey: string
  mockVerificationToken?: string
}

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      action: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

function createSessionId() {
  const key = 'archresearch.web.clientSessionId'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `web-${crypto.randomUUID()}`
  window.localStorage.setItem(key, created)
  return created
}

function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string | null) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let widgetId: string | null = null

    const renderWidget = () => {
      if (cancelled || !container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        action: 'start_research',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-archresearch-turnstile]',
    )
    if (window.turnstile) {
      renderWidget()
    } else if (existing) {
      existing.addEventListener('load', renderWidget, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.archresearchTurnstile = 'true'
      script.addEventListener('load', renderWidget, { once: true })
      document.head.append(script)
    }

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken, siteKey])

  return <div ref={container} className="turnstile-slot" />
}

export function App({
  client: suppliedClient,
  clientSessionId: suppliedClientSessionId,
  verificationToken,
}: AppProps) {
  const [verifiedToken, setVerifiedToken] = useState<string | null>(
    verificationToken ?? null,
  )
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('')
  const [verificationGeneration, setVerificationGeneration] = useState(0)
  const [configError, setConfigError] = useState('')
  const clientSessionId = useMemo(
    () => suppliedClientSessionId ?? createSessionId(),
    [suppliedClientSessionId],
  )
  const publicClient = useMemo(() => suppliedClient
    ? null
    : createPublicApiClient({
        indexedDB,
        clientSessionId,
        initialVerificationToken: verificationToken ?? null,
        onVerificationConsumed: () => {
          setVerifiedToken(null)
          setVerificationGeneration((current) => current + 1)
        },
      }), [clientSessionId, suppliedClient, verificationToken])
  const client: ApiClient = suppliedClient ?? publicClient!

  configureApiClient(client)

  useEffect(() => {
    publicClient?.setVerificationToken(verifiedToken)
  }, [publicClient, verifiedToken])

  useEffect(() => {
    if (suppliedClient || verificationToken) return
    let active = true
    void fetch('/api/config', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('config_failed')
        return await response.json() as PublicConfig
      })
      .then((config) => {
        if (!active) return
        setTurnstileSiteKey(config.turnstileSiteKey)
        if (config.mockVerificationToken) setVerifiedToken(config.mockVerificationToken)
      })
      .catch(() => {
        if (active) setConfigError('人机校验暂时不可用，请稍后刷新页面。')
      })
    return () => {
      active = false
    }
  }, [suppliedClient, verificationToken])

  const verificationControl = verificationToken
    ? null
    : verifiedToken
      ? null
      : turnstileSiteKey
        ? (
            <Turnstile
              key={verificationGeneration}
              siteKey={turnstileSiteKey}
              onToken={setVerifiedToken}
            />
          )
        : configError
          ? <p className="research-submit-error" role="alert">{configError}</p>
          : <span>正在载入校验…</span>

  return (
    <BoardApp
      edition="public"
      verificationControl={verificationControl}
      verificationReady={Boolean(verifiedToken)}
    />
  )
}

export type { ApiClient }
