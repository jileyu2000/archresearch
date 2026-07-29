import {
  ArrowLeft,
  Check,
  Database,
  Download,
  ExternalLink,
  FileJson,
  LoaderCircle,
  Play,
  ShieldCheck,
  Square,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  createWebApiClient,
  WebApiError,
  type PublicRunStatus,
  type ResearchMode,
  type ResearchRunSnapshot,
  type WebApiClient,
} from './api/client'
import {
  createBrowserHistoryStore,
  type BrowserHistoryStore,
  type BrowserRunRecord,
} from './lib/history'

interface HistoryPort {
  listRuns(): Promise<BrowserRunRecord[]>
  getResults(runId: string): Promise<Array<{
    id: string
    runId: string
    title: string
    facts: Array<{ statement: string; sourceUrl: string; quote: string }>
  }>>
  saveRun(run: BrowserRunRecord): Promise<void>
  saveResult(result: {
    schemaVersion: 1
    id: string
    runId: string
    title: string
    facts: Array<{ statement: string; sourceUrl: string; quote: string }>
  }): Promise<void>
  exportBackup(): Promise<Blob>
  importBackup(file: Blob): Promise<void>
}

interface AppProps {
  client?: WebApiClient
  history?: HistoryPort
  clientSessionId?: string
  verificationToken?: string
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

const modes: Array<{ value: ResearchMode; label: string; detail: string }> = [
  { value: 'quick', label: '快速找方向', detail: '3 个研究问题' },
  { value: 'balanced', label: '形成方案依据', detail: '4 个研究问题' },
  { value: 'deep', label: '做跨案例论证', detail: '6 个研究问题' },
]

const examples = [
  '旧厂房改造成社区文化中心，新旧结构应该脱开还是连接？',
  '高差场地如何用剖面和流线组织连续的公共空间？',
  '社区图书馆如何同时容纳安静阅读与开放活动？',
]

const terminalStatuses = new Set<PublicRunStatus>([
  'completed',
  'partial',
  'blocked',
  'cancelled',
  'failed',
])

const statusLabels: Record<PublicRunStatus, string> = {
  created: '已创建',
  planning: '正在拆解研究问题',
  searching: '正在查找公开建筑案例',
  inspecting: '正在阅读项目正文',
  analyzing: '正在提取空间做法',
  verifying: '正在核对来源',
  gap_check: '正在检查研究覆盖',
  composing: '正在整理设计结论',
  completed: '研究完成',
  partial: '已有部分结果',
  blocked: '当前无法继续',
  cancelled: '已取消',
  failed: '研究失败',
}

const errorMessages: Record<string, string> = {
  human_verification_failed: '人机校验已失效，请重新完成校验。',
  request_limit_reached: '当前设备的研究次数已达上限，请稍后再试。',
  service_paused: '公开研究暂时停用，请稍后再试。',
  invalid_request: '研究问题或请求格式不正确。',
  request_failed: '暂时无法连接研究服务，请稍后重试。',
}

function createSessionId() {
  const key = 'archresearch.web.clientSessionId'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = `web-${crypto.randomUUID()}`
  window.localStorage.setItem(key, created)
  return created
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
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

  return <div ref={container} className="turnstile-slot" aria-label="人机校验" />
}

function statusFromSnapshot(snapshot: ResearchRunSnapshot) {
  return snapshot.checkpointStage && snapshot.status === 'searching'
    ? snapshot.checkpointStage as PublicRunStatus
    : snapshot.status
}

export function App({
  client: suppliedClient,
  history: suppliedHistory,
  clientSessionId: suppliedClientSessionId,
  verificationToken,
}: AppProps) {
  const client = useMemo(
    () => suppliedClient ?? createWebApiClient(),
    [suppliedClient],
  )
  const history = useMemo<HistoryPort>(
    () => suppliedHistory ?? createBrowserHistoryStore({ indexedDB }),
    [suppliedHistory],
  )
  const clientSessionId = useMemo(
    () => suppliedClientSessionId ?? createSessionId(),
    [suppliedClientSessionId],
  )
  const [runs, setRuns] = useState<BrowserRunRecord[]>([])
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<ResearchMode>('balanced')
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('')
  const [verifiedToken, setVerifiedToken] = useState<string | null>(
    verificationToken ?? null,
  )
  const [activeRun, setActiveRun] = useState<ResearchRunSnapshot | null>(null)
  const [activeQuestion, setActiveQuestion] = useState('')
  const [activeMode, setActiveMode] = useState<ResearchMode>('balanced')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [dataOpen, setDataOpen] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void history.listRuns().then((records) => {
      if (active) setRuns(records)
    })
    void client.getConfig()
      .then((config) => {
        if (active) {
          setTurnstileSiteKey(config.turnstileSiteKey)
          if (config.mockVerificationToken) setVerifiedToken(config.mockVerificationToken)
        }
      })
      .catch(() => {
        if (active) setError(errorMessages.request_failed)
      })
    return () => {
      active = false
    }
  }, [client, history])

  useEffect(() => {
    if (!activeRun || terminalStatuses.has(activeRun.status)) return
    const timer = window.setInterval(() => {
      void client.getRun(activeRun.runId)
        .then(async (snapshot) => {
          setActiveRun(snapshot)
          const now = new Date().toISOString()
          await history.saveRun({
            schemaVersion: 1,
            id: snapshot.runId,
            question: activeQuestion,
            mode: activeMode,
            status: snapshot.status,
            checkpointStage: snapshot.checkpointStage ?? null,
            createdAt: runs.find((run) => run.id === snapshot.runId)?.createdAt ?? now,
            updatedAt: now,
          })
          if (terminalStatuses.has(snapshot.status)) {
            for (const [index, section] of (snapshot.sections ?? []).entries()) {
              await history.saveResult({
                schemaVersion: 1,
                id: `${snapshot.runId}:${section.id || index}`,
                runId: snapshot.runId,
                title: section.title,
                facts: section.facts,
              })
            }
            setRuns(await history.listRuns())
          }
        })
        .catch(() => setError(errorMessages.request_failed))
    }, 1800)
    return () => window.clearInterval(timer)
  }, [activeMode, activeQuestion, activeRun, client, history, runs])

  const startResearch = async () => {
    const normalizedQuestion = question.trim()
    if (normalizedQuestion.length < 8 || !verifiedToken) return
    setSubmitting(true)
    setError('')
    try {
      const created = await client.startResearch({
        question: normalizedQuestion,
        mode,
        clientSessionId,
        turnstileToken: verifiedToken,
      })
      const now = new Date().toISOString()
      await history.saveRun({
        schemaVersion: 1,
        id: created.runId,
        question: normalizedQuestion,
        mode,
        status: 'created',
        checkpointStage: null,
        createdAt: now,
        updatedAt: now,
      })
      setActiveQuestion(normalizedQuestion)
      setActiveMode(mode)
      setActiveRun({ runId: created.runId, status: 'created' })
      setVerifiedToken(verificationToken ?? null)
      setRuns(await history.listRuns())
    } catch (caught) {
      const code = caught instanceof WebApiError ? caught.code : 'request_failed'
      setError(errorMessages[code] ?? errorMessages.request_failed)
    } finally {
      setSubmitting(false)
    }
  }

  const openHistoryRun = async (run: BrowserRunRecord) => {
    const results = await history.getResults(run.id)
    setActiveQuestion(run.question)
    setActiveMode(run.mode)
    setActiveRun({
      runId: run.id,
      status: run.status,
      checkpointStage: run.checkpointStage,
      sections: results.map((result) => ({
        id: result.id,
        title: result.title,
        facts: result.facts,
      })),
    })
  }

  const cancelRun = async () => {
    if (!activeRun) return
    await client.cancelRun(activeRun.runId)
    setActiveRun({ ...activeRun, status: 'cancelled' })
  }

  const exportData = async () => {
    const backup = await history.exportBackup()
    const url = URL.createObjectURL(backup)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `archresearch-web-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file: File | null) => {
    if (!file) return
    try {
      await history.importBackup(file)
      setRuns(await history.listRuns())
      setError('')
    } catch {
      setError('无法导入这个备份文件。')
    }
  }

  if (activeRun) {
    const visibleStatus = statusFromSnapshot(activeRun)
    const isActive = !terminalStatuses.has(activeRun.status)
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="icon-button" type="button" onClick={() => setActiveRun(null)}>
            <ArrowLeft aria-hidden="true" />
            <span>返回工作台</span>
          </button>
          <div className="edition-mark">Web Edition</div>
        </header>
        <main className="run-document">
          <div className="run-heading">
            <p className="eyebrow">本次研究任务</p>
            <h1>{activeQuestion}</h1>
            <p>{modes.find((item) => item.value === activeMode)?.label}</p>
          </div>

          <section className={`status-band status-${activeRun.status}`} aria-live="polite">
            <div>
              {isActive
                ? <LoaderCircle className="spin" aria-hidden="true" />
                : <Check aria-hidden="true" />}
              <strong>{statusLabels[visibleStatus]}</strong>
            </div>
            {isActive && (
              <button type="button" className="secondary-button" onClick={() => void cancelRun()}>
                <Square aria-hidden="true" />
                取消研究
              </button>
            )}
          </section>

          {error && <p className="error-message" role="alert">{error}</p>}

          {activeRun.summary && (
            <section className="research-summary">
              <p className="eyebrow">研究结论</p>
              <h2>{activeRun.summary}</h2>
            </section>
          )}

          {(activeRun.sections ?? []).map((section, sectionIndex) => (
            <section className="result-section" key={section.id || sectionIndex}>
              <div className="section-index">{String(sectionIndex + 1).padStart(2, '0')}</div>
              <div>
                <h2>{section.title}</h2>
                <div className="fact-list">
                  {section.facts.map((fact, factIndex) => (
                    <article className="fact-row" key={`${fact.sourceUrl}:${factIndex}`}>
                      <p>{fact.statement}</p>
                      <a href={fact.sourceUrl} target="_blank" rel="noreferrer">
                        出处
                        <ExternalLink aria-hidden="true" />
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ))}

          {!isActive && !(activeRun.sections?.length) && (
            <div className="empty-result">
              <FileJson aria-hidden="true" />
              <p>{activeRun.status === 'cancelled' ? '这次研究已取消。' : '这次研究没有形成可用结果。'}</p>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="registration-mark" aria-hidden="true" />
          <div>
            <strong>ArchResearch</strong>
            <span>建筑设计研究 Agent</span>
          </div>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-expanded={dataOpen}
          onClick={() => setDataOpen((current) => !current)}
        >
          <Database aria-hidden="true" />
          <span>本机记录</span>
        </button>
      </header>

      {dataOpen && (
        <section className="data-strip">
          <div>
            <strong>记录保存在此浏览器</strong>
            <span>清除站点数据、无痕模式或更换设备会失去未导出的记录。</span>
          </div>
          <div className="data-actions">
            <button type="button" onClick={() => void exportData()}>
              <Download aria-hidden="true" />
              导出备份
            </button>
            <button type="button" onClick={() => importInput.current?.click()}>
              <Upload aria-hidden="true" />
              导入备份
            </button>
            <input
              ref={importInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => void importData(event.target.files?.[0] ?? null)}
            />
          </div>
        </section>
      )}

      <main className="workspace">
        <section className="composer">
          <div className="composer-heading">
            <div>
              <p className="eyebrow">Evidence-Grounded Research</p>
              <h1>ArchResearch</h1>
              <p>把一个建筑问题拆开研究，再用可核对的公开案例回答。</p>
            </div>
            <figure className="plan-preview">
              <img src="/demo/bungalow-plan.jpg" alt="建筑平面研究图样" />
              <figcaption>平面 · 剖面 · 流线 · 结构</figcaption>
            </figure>
          </div>

          <label className="question-field">
            <span>研究问题</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="例如：高差场地如何用剖面和流线组织连续的公共空间？"
            />
          </label>

          <fieldset className="mode-selector">
            <legend>研究方式</legend>
            <div>
              {modes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={mode === item.value ? 'selected' : ''}
                  aria-pressed={mode === item.value}
                  onClick={() => setMode(item.value)}
                >
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="verification-row">
            <div>
              <ShieldCheck aria-hidden="true" />
              <span>{verifiedToken ? '已完成人机校验' : '开始前完成人机校验'}</span>
            </div>
            {!verificationToken && turnstileSiteKey && (
              <Turnstile siteKey={turnstileSiteKey} onToken={setVerifiedToken} />
            )}
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}

          <button
            className="primary-button"
            type="button"
            disabled={question.trim().length < 8 || !verifiedToken || submitting}
            onClick={() => void startResearch()}
          >
            {submitting
              ? <LoaderCircle className="spin" aria-hidden="true" />
              : <Play aria-hidden="true" />}
            {submitting ? '正在创建研究…' : '开始实时研究'}
          </button>
        </section>

        <aside className="workspace-side">
          <section className="starter-section">
            <div className="section-heading">
              <h2>常见问题起点</h2>
              <span>点击填入</span>
            </div>
            <div className="starter-list">
              {examples.map((example, index) => (
                <button type="button" key={example} onClick={() => setQuestion(example)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {example}
                </button>
              ))}
            </div>
          </section>

          <section className="history-section">
            <div className="section-heading">
              <h2>最近研究</h2>
              <span>记录保存在此浏览器</span>
            </div>
            {runs.length ? (
              <div className="history-list" tabIndex={0} aria-label="最近研究记录">
                {runs.map((run) => (
                  <button type="button" key={run.id} onClick={() => void openHistoryRun(run)}>
                    <strong>{run.question}</strong>
                    <span>
                      {modes.find((item) => item.value === run.mode)?.label}
                      {' · '}
                      {statusLabels[run.status]}
                      {' · '}
                      {formatDate(run.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-history">
                <Database aria-hidden="true" />
                <p>完成第一次研究后，记录会出现在这里。</p>
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}

export type { BrowserHistoryStore }
