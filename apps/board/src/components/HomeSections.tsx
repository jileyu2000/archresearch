import type { FormEvent } from 'react'
import {
  ArrowRight,
  FolderPlus,
  Plus,
  X,
} from 'lucide-react'

import type { ResearchGoal, ResearchRun } from '../api/client'
import { goalLabels, modeLabels } from '../lib/labels'
import {
  announcementExplanations,
  recentRunAnnouncement,
} from '../lib/run'

const problemStarters: Array<{
  label: string
  prompt: string
  goal: ResearchGoal
}> = [
  {
    label: '旧建更新',
    prompt: '原有结构不动，怎样植入新的公共功能？',
    goal: 'precedent_research',
  },
  {
    label: '流线组织',
    prompt: '人车在入口冲突，如何重组落客和步行路径？',
    goal: 'precedent_research',
  },
  {
    label: '剖面空间',
    prompt: '层高固定，怎样建立连续的空间层次？',
    goal: 'precedent_research',
  },
  {
    label: '图纸表达',
    prompt: '如何统一整套图纸的线型、配色和版式？',
    goal: 'visual_reference_search',
  },
]

function formatRunDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
}

function retentionDays(value?: string | null) {
  if (!value) return null
  const expiry = new Date(value)
  if (Number.isNaN(expiry.getTime())) return null
  return Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86_400_000))
}

function retentionDate(value?: string | null) {
  if (!value) return ''
  const expiry = new Date(value)
  if (Number.isNaN(expiry.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(expiry)
}

function RunHistoryList({
  runs,
  onOpen,
  onRetentionChange,
  retentionUpdatingId,
}: {
  runs: ResearchRun[]
  onOpen: (run: ResearchRun) => void
  onRetentionChange?: (run: ResearchRun) => void
  retentionUpdatingId?: string
}) {
  return (
    <ul className="recent-list">
      {runs.map((run) => {
        const recordTitle = run.title?.trim() || run.question
        const runDate = formatRunDate(run.updatedAt ?? run.createdAt)
        const usableAssets = run.coverageReport?.usable_assets
        const daysRemaining = retentionDays(run.retentionExpiresAt)
        const expiryDate = retentionDate(run.retentionExpiresAt)
        const expiryUrgent = daysRemaining !== null && daysRemaining <= 14
        const retentionStatus = run.keepForever
          ? '永久保留'
          : expiryDate
            ? `${expiryUrgent ? '即将到期 · ' : '保留至 '}${expiryDate}${expiryUrgent ? '删除' : ''}`
            : '保留期未读取'
        const announcement = recentRunAnnouncement(run)
        return (
          <li key={run.id}>
            <div className="recent-run-row">
              <button className="recent-open" type="button" aria-label={`打开研究：${recordTitle}`} onClick={() => onOpen(run)}>
                <span className="recent-question">{recordTitle}</span>
                <span className="recent-meta">
                  {[
                    goalLabels[run.goal] ?? '研究任务',
                    run.goal === 'visual_reference_search' ? null : modeLabels[run.mode],
                    usableAssets === undefined ? null : `${usableAssets} 张参考`,
                    runDate || null,
                  ].filter(Boolean).join(' · ')}
                </span>
                <span className="recent-status" title={announcementExplanations[announcement]}>{announcement}</span>
                <ArrowRight aria-hidden="true" />
              </button>
              {onRetentionChange && (
                <div className="retention-control">
                  <span data-urgent={expiryUrgent || undefined}>{retentionStatus}</span>
                  <button
                    type="button"
                    aria-label={`${run.keepForever ? '取消永久保留' : '永久保留'}：${recordTitle}`}
                    title={run.keepForever
                      ? '取消后从今天起保留 180 天，到期自动删除'
                      : '设为永久后，这条记录不再自动删除'}
                    disabled={retentionUpdatingId === run.id}
                    onClick={() => onRetentionChange(run)}
                  >
                    {retentionUpdatingId === run.id ? '保存中…' : (run.keepForever ? '取消永久' : '设为永久')}
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

type HomeSectionsProps = {
  demoMode: boolean
  currentWorkspaceName: string
  workspaceCreateOpen: boolean
  newWorkspaceName: string
  recentRuns: ResearchRun[]
  retentionUpdatingId: string
  loading: boolean
  onApplyStarter: (prompt: string, goal: ResearchGoal) => void
  onToggleWorkspaceCreate: () => void
  onWorkspaceNameChange: (name: string) => void
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onOpenRun: (run: ResearchRun) => void | Promise<void>
  onRetentionChange: (run: ResearchRun) => void | Promise<void>
}

export function HomeSections({
  demoMode,
  currentWorkspaceName,
  workspaceCreateOpen,
  newWorkspaceName,
  recentRuns,
  retentionUpdatingId,
  loading,
  onApplyStarter,
  onToggleWorkspaceCreate,
  onWorkspaceNameChange,
  onCreateWorkspace,
  onOpenRun,
  onRetentionChange,
}: HomeSectionsProps) {
  return (
    <section className="home-sections" aria-label="研究起点与最近任务">
      <section className="home-panel starter-panel" aria-labelledby="starter-heading">
        <header>
          <div>
            <h2 id="starter-heading">不知道怎么描述？</h2>
            <p>从常见的建筑设计问题开始，再改成你的项目条件。</p>
          </div>
        </header>
        <ul className="starter-list">
          {problemStarters.map((starter) => (
            <li key={starter.label}>
              <button
                type="button"
                aria-label={`填入问题：${starter.label}，${starter.prompt}`}
                onClick={() => onApplyStarter(starter.prompt, starter.goal)}
              >
                <span className="starter-label">{starter.label}</span>
                <span className="starter-prompt">{starter.prompt}</span>
                <Plus aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-panel recent-panel" aria-labelledby="recent-heading">
        <header>
          <div>
            <h2 id="recent-heading">最近研究</h2>
            <p>{demoMode
              ? '继续尚未结束或已经完成的任务。'
              : '新研究从创建日起保留一学期（180 天），到期前可设为永久。'}</p>
          </div>
          {!demoMode && (
            <div className="workspace-actions">
              <span className="visually-hidden" aria-hidden="true">{currentWorkspaceName}</span>
              <button className="icon-text-button" type="button" onClick={onToggleWorkspaceCreate}>
                {workspaceCreateOpen ? <X aria-hidden="true" /> : <FolderPlus aria-hidden="true" />}
                {workspaceCreateOpen ? '取消新建' : '新建项目'}
              </button>
              {workspaceCreateOpen && (
                <form className="workspace-create" onSubmit={(event) => void onCreateWorkspace(event)}>
                  <label htmlFor="workspace-name">项目名称</label>
                  <input
                    id="workspace-name"
                    value={newWorkspaceName}
                    onChange={(event) => onWorkspaceNameChange(event.target.value)}
                    placeholder="例如：毕业设计 / 城市更新"
                    autoFocus
                  />
                  <button type="submit" disabled={!newWorkspaceName.trim()}>创建项目</button>
                </form>
              )}
            </div>
          )}
        </header>
        {recentRuns.length > 0 ? (
          <div className="recent-history" role="region" aria-label="研究记录" tabIndex={0}>
            <RunHistoryList
              runs={recentRuns}
              onOpen={(run) => void onOpenRun(run)}
              onRetentionChange={(run) => void onRetentionChange(run)}
              retentionUpdatingId={retentionUpdatingId}
            />
          </div>
        ) : (
          <p className="recent-empty">{loading ? '正在读取最近任务…' : '完成第一次研究后，最近任务会保留在这里。'}</p>
        )}
      </section>
    </section>
  )
}
