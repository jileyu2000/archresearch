import type { FormEvent, RefObject } from 'react'
import {
  ArrowUp,
  Check,
  CircleDashed,
  Eye,
  ExternalLink,
  LayoutGrid,
  MonitorUp,
  Paperclip,
  RefreshCw,
  Search,
} from 'lucide-react'

import type {
  ResearchGoal,
  ResearchMode,
  ResearchRun,
} from '../api/client'
import {
  goalPlaceholders,
  modeLabels,
  researchDepthOptions,
} from '../lib/labels'
import { retryActionLabel } from '../lib/run'
import { ClickSpark } from './ClickSpark'

type ResearchComposerProps = {
  questionInputRef: RefObject<HTMLTextAreaElement | null>
  goal: ResearchGoal
  mode: ResearchMode
  question: string
  files: File[]
  referenceUrl: string
  demoMode: boolean
  activeWorkspaceId: string
  briefReviewLoading: boolean
  researchStarting: boolean
  isRunActive: boolean
  loading: boolean
  researchOptionsOpen: boolean
  composerError: string
  researchEnvironmentReady: boolean
  researchEnvironmentTitle: string
  researchEnvironmentDetail: string
  showBrowserConnectAction: boolean
  showXiaohongshuLoginAction: boolean
  browserConnecting: boolean
  browserReadinessLoading: boolean
  browserReadinessError: string
  browserPairingStatus: string
  activeRun: ResearchRun | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onGoalChange: (goal: ResearchGoal) => void
  onQuestionChange: (question: string) => void
  onModeChange: (mode: ResearchMode) => void
  onToggleOptions: () => void
  onFilesChange: (files: File[]) => void
  onReferenceUrlChange: (url: string) => void
  onConnectBrowser: () => void | Promise<void>
  onRefreshBrowserReadiness: () => void | Promise<void>
  onCancel: () => void | Promise<void>
  onRetry: () => void | Promise<void>
}

export function ResearchComposer({
  questionInputRef,
  goal,
  mode,
  question,
  files,
  referenceUrl,
  demoMode,
  activeWorkspaceId,
  briefReviewLoading,
  researchStarting,
  isRunActive,
  loading,
  researchOptionsOpen,
  composerError,
  researchEnvironmentReady,
  researchEnvironmentTitle,
  researchEnvironmentDetail,
  showBrowserConnectAction,
  showXiaohongshuLoginAction,
  browserConnecting,
  browserReadinessLoading,
  browserReadinessError,
  browserPairingStatus,
  activeRun,
  onSubmit,
  onGoalChange,
  onQuestionChange,
  onModeChange,
  onToggleOptions,
  onFilesChange,
  onReferenceUrlChange,
  onConnectBrowser,
  onRefreshBrowserReadiness,
  onCancel,
  onRetry,
}: ResearchComposerProps) {
  return (
    <section className="research-composer" aria-label="新建研究">
      <header>
        <div>
          <h1>{goal === 'visual_reference_search' ? '找图纸视觉方向' : '从一个卡住你的地方开始'}</h1>
          <p>{goal === 'visual_reference_search'
            ? '剖面图、爆炸图等图纸类型，与分割、构图、线型、配色或版式等视觉方向。'
            : '空间、流线、剖面或表达，说具体一点就够了。也可以直接附上草图、图纸、PDF 或网页。'}</p>
        </div>
      </header>
      <form className="research-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="research-entry-switch" role="group" aria-label="功能入口">
          <button
            type="button"
            aria-pressed={goal !== 'visual_reference_search'}
            onClick={() => onGoalChange('precedent_research')}
          >
            <LayoutGrid aria-hidden="true" />
            <span><strong>建筑设计研究</strong><small>项目案例与设计策略</small></span>
          </button>
          <button
            type="button"
            aria-pressed={goal === 'visual_reference_search'}
            onClick={() => onGoalChange('visual_reference_search')}
          >
            <Eye aria-hidden="true" />
            <span><strong>图纸灵感</strong><small>配色、线型、版式与分析图</small></span>
          </button>
        </div>
        <div className="research-prompt">
          <Search className="research-prompt-icon" aria-hidden="true" />
          <label htmlFor="research-question">研究问题</label>
          <textarea
            id="research-question"
            ref={questionInputRef}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder={goalPlaceholders[goal]}
            required
          />
        </div>
        {goal === 'precedent_research' && (
          <div className="research-method">
            <fieldset className="segmented-control research-depth-options">
              <legend>研究方式</legend>
              <p className="research-source-note">案例来自 ArchDaily、Dezeen、Designboom 等建筑媒体，只收录文章内容完整的项目。</p>
              {(Object.keys(modeLabels) as ResearchMode[]).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => onModeChange(value)}
                  />
                  <strong>{modeLabels[value]}</strong>
                  <span>{researchDepthOptions[value].target}</span>
                </label>
              ))}
            </fieldset>
          </div>
        )}
        <div className="research-form-footer">
          <div className="research-quick-actions">
            {goal === 'precedent_research' && (
              <button
                type="button"
                aria-expanded={researchOptionsOpen}
                onClick={onToggleOptions}
              >
                <Paperclip aria-hidden="true" />添加任务书或案例页（可选）
              </button>
            )}
            {goal !== 'visual_reference_search' && files.length > 0 && (
              <ul className="research-pending-files" aria-label="待上传文件">
                {files.map((file, index) => (
                  <li key={`${file.name}:${file.size}:${file.lastModified}:${index}`} title={file.name}>
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
            <ClickSpark className="research-submit-spark" duration={300} sparkRadius={12} sparkSize={6}>
              <button
                className="research-submit"
                type="submit"
                disabled={briefReviewLoading || researchStarting || isRunActive || loading || (!demoMode && !activeWorkspaceId)}
              >
                {isRunActive
                  ? '研究进行中…'
                  : briefReviewLoading
                    ? '正在准备研究…'
                  : researchStarting
                    ? '正在创建研究…'
                  : <><span>{goal === 'visual_reference_search'
                    ? '查找灵感'
                    : '开始研究'}</span><ArrowUp aria-hidden="true" /></>}
              </button>
            </ClickSpark>
          </div>
          {composerError && <p className="research-submit-error" role="alert">{composerError}</p>}
        </div>
        {goal === 'precedent_research' && researchOptionsOpen && (
          <section className="research-options" aria-label="可选项目资料">
            <p className="research-options-intro">
              任务书用于收束研究范围，案例页用于补充参考线索；都不填也可以继续。
            </p>
            <div className="research-field">
              <label htmlFor="project-brief-files">项目任务书（PDF）</label>
              <p className="research-field-help" id="project-brief-files-help">
                系统会先读取场地、功能与限制，把它们作为问题拆解和案例检索的边界。
              </p>
              <input
                id="project-brief-files"
                type="file"
                aria-describedby="project-brief-files-help"
                accept=".pdf,application/pdf"
                onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
              />
            </div>
            <div className="research-field">
              <label htmlFor="project-reference-url">指定案例或项目网页</label>
              <p className="research-field-help" id="project-reference-url-help">
                把已有页面作为研究线索；系统仍会继续检索其他案例。
              </p>
              <input
                id="project-reference-url"
                type="url"
                aria-describedby="project-reference-url-help"
                value={referenceUrl}
                onChange={(event) => onReferenceUrlChange(event.target.value)}
                placeholder="https://"
              />
            </div>
          </section>
        )}
        {!demoMode && goal === 'visual_reference_search' && (
          <section className="research-preflight" aria-label="研究环境">
            <header className="research-preflight-header">
              <div className="research-preflight-title">
                {researchEnvironmentReady ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                <div>
                  <strong>{researchEnvironmentTitle}</strong>
                  <span aria-live="polite">{researchEnvironmentDetail}</span>
                </div>
              </div>
              <div className="research-preflight-actions">
                {showXiaohongshuLoginAction && (
                  <a
                    className="research-preflight-login"
                    href="https://www.xiaohongshu.com/explore"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink aria-hidden="true" />打开小红书登录
                  </a>
                )}
                {showBrowserConnectAction && (
                  <button type="button" disabled={browserConnecting} onClick={() => void onConnectBrowser()}>
                    <MonitorUp aria-hidden="true" />{browserConnecting ? '正在连接 Chrome…' : '连接 Chrome 读取高清图纸'}
                  </button>
                )}
                <button
                  className="research-preflight-refresh"
                  type="button"
                  aria-label="重新检测"
                  disabled={browserReadinessLoading}
                  onClick={() => void onRefreshBrowserReadiness()}
                >
                  <RefreshCw aria-hidden="true" /><span aria-hidden="true">{browserReadinessLoading ? '检查中…' : '重新检测'}</span>
                </button>
              </div>
            </header>
            {(browserReadinessError || browserPairingStatus) && (
              <p className="research-preflight-message" aria-live="polite">
                {browserReadinessError ? '连接状态没有读取到。请点“刷新”重试；如果反复失败，请关闭并重新打开 ArchResearch。' : browserPairingStatus}
              </p>
            )}
          </section>
        )}
        <div className="research-run-actions">
          {isRunActive && <button className="research-cancel" type="button" onClick={() => void onCancel()}>取消研究</button>}
          {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
            <button className="research-retry" type="button" onClick={() => void onRetry()}>{retryActionLabel(activeRun)}</button>
          )}
        </div>
      </form>
    </section>
  )
}
