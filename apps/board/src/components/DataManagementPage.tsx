import { useState } from 'react'
import { Check, HardDriveDownload, ShieldCheck, Upload } from 'lucide-react'

import {
  ApiError,
  apiClient,
  type Workspace,
  type WorkspaceBackupPreflight,
} from '../api/client'
import {
  formatBackupSize,
  formatBackupTime,
  lastBackupStorageKey,
  readLastBackupRecord,
  type LastBackupRecord,
} from '../lib/backup'

interface DataManagementPageProps {
  open: boolean
  workspaceCount: number
  runCount: number
  isRunActive: boolean
  dataStatus: string
  onError: (message: string) => void
  onStatus: (message: string) => void
  onRestored: (workspaces: Workspace[]) => void
}

function apiMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : '操作未完成，请重试；若反复失败，请重启 ArchResearch。'
}

function backupAgeInDays(record: LastBackupRecord | null) {
  if (!record) return null
  const days = Math.floor((Date.now() - Date.parse(record.at)) / 86400000)
  return Number.isFinite(days) ? days : null
}

export function DataManagementPage({
  open,
  workspaceCount,
  runCount,
  isRunActive,
  dataStatus,
  onError,
  onStatus,
  onRestored,
}: DataManagementPageProps) {
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupPreflight, setBackupPreflight] = useState<WorkspaceBackupPreflight | null>(null)
  const [dataOperation, setDataOperation] = useState<'backup' | 'preflight' | 'restore' | ''>('')
  const [lastBackupRecord, setLastBackupRecord] = useState<LastBackupRecord | null>(readLastBackupRecord)
  const [preflightError, setPreflightError] = useState('')
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)

  async function handleDownloadBackup() {
    onError('')
    onStatus('')
    setDataOperation('backup')
    try {
      const { blob, filename } = await apiClient.downloadWorkspaceBackup()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      // The record is written only after the full archive arrived, so the
      // status row never claims a download that did not happen.
      const record: LastBackupRecord = { at: new Date().toISOString(), bytes: blob.size }
      window.localStorage.setItem(lastBackupStorageKey, JSON.stringify(record))
      setLastBackupRecord(record)
      onStatus('已下载。记得把文件挪到移动硬盘或网盘。')
    } catch (error) {
      onError(apiMessage(error))
    } finally {
      setDataOperation('')
    }
  }

  async function handleBackupPreflight(file: File) {
    onError('')
    setPreflightError('')
    onStatus('')
    setDataOperation('preflight')
    try {
      setBackupPreflight(await apiClient.preflightWorkspaceBackup(file))
    } catch {
      setBackupPreflight(null)
      setPreflightError('这份文件没有通过检查，不能用来恢复。可能是下载不完整、被改动过，或者不是 ArchResearch 的备份。当前数据没有任何改动，换一份文件再试。')
    } finally {
      setDataOperation('')
    }
  }

  async function handleRestoreBackup() {
    if (!backupFile || !backupPreflight?.ready) return
    onError('')
    onStatus('')
    setDataOperation('restore')
    try {
      await apiClient.restoreWorkspaceBackup(backupFile)
      const restoredWorkspaces = await apiClient.listWorkspaces()
      onRestored(restoredWorkspaces)
      setBackupPreflight(null)
      setBackupFile(null)
      setRestoreConfirmOpen(false)
      onStatus('恢复完成，现在的数据就是这份备份里的内容。')
    } catch (error) {
      onError(`恢复没有完成，已退回原状——当前数据和恢复前一样。${apiMessage(error)}`)
    } finally {
      setDataOperation('')
    }
  }

  if (!open) return null

  const backupAgeDays = backupAgeInDays(lastBackupRecord)
  const backupOverdueDays = backupAgeDays !== null && backupAgeDays >= 14 ? backupAgeDays : null

  return (
    <section className="data-management-page" aria-labelledby="data-management-title">
      <header className="data-management-heading">
        <div>
          <h1 id="data-management-title">备份与恢复</h1>
          <p>数据保存在这台电脑上。定期下载备份，需要时可恢复到备份时的状态。</p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>

      <section className="data-management-section data-backup-section" aria-labelledby="backup-heading">
        <div className="data-management-copy">
          <h2 id="backup-heading">备份数据</h2>
          <dl className="backup-status">
            <div>
              <dt>当前数据</dt>
              <dd>{workspaceCount} 个项目 · {runCount} 条研究记录</dd>
            </div>
            <div>
              <dt>最近备份</dt>
              <dd>
                {lastBackupRecord
                  ? `${formatBackupTime(lastBackupRecord.at)} · ${formatBackupSize(lastBackupRecord.bytes)}（仅此浏览器）`
                  : '这个浏览器里还没有下载记录。'}
                {backupOverdueDays !== null && (
                  <span className="backup-overdue">此浏览器已有 {backupOverdueDays} 天未下载；若未在别处备份，建议现在下载。</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="data-backup-note">手动备份；包含项目、研究记录、收藏和任务书，不包含服务配置和登录信息。</p>
        </div>
        <div className="data-backup-action">
          <button
            className="primary-action"
            type="button"
            disabled={Boolean(dataOperation) || isRunActive}
            onClick={() => void handleDownloadBackup()}
          >
            <HardDriveDownload aria-hidden="true" />
            {dataOperation === 'backup' ? '正在下载…' : '下载备份'}
          </button>
          <small>
            {isRunActive
              ? '研究进行中，完成后可备份。'
              : '保存为 .zip 文件。'}
          </small>
        </div>
      </section>

      <section className="data-management-section data-restore-section" aria-labelledby="restore-heading">
        <div className="data-management-copy">
          <h2 id="restore-heading">恢复数据</h2>
          <p>恢复会替换当前全部数据，不会合并。</p>
        </div>
        <div className="data-restore-controls">
          <label htmlFor="workspace-backup-file">选择备份文件（.zip）</label>
          <input
            id="workspace-backup-file"
            type="file"
            accept=".zip,application/zip"
            disabled={Boolean(dataOperation) || isRunActive}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              setBackupFile(file)
              setBackupPreflight(null)
              setPreflightError('')
              setRestoreConfirmOpen(false)
              onStatus('')
              onError('')
              if (file) void handleBackupPreflight(file)
            }}
          />
          {!isRunActive && <p className="data-restore-note">选择文件后会先检查，不会修改当前数据。</p>}
          {isRunActive && <p className="data-restore-note">有研究正在进行，恢复功能暂时停用。等研究结束后再来。</p>}
        </div>

        {dataOperation === 'preflight' && (
          <p className="data-restore-checking" role="status">正在检查这份备份……不会改动当前数据。</p>
        )}
        {preflightError && <p className="data-restore-error" role="alert">{preflightError}</p>}

        {backupPreflight?.ready && (
          <section className="backup-preflight-result" aria-label="备份检查结果">
            <header><Check aria-hidden="true" /><strong>检查通过，可以恢复</strong></header>
            <ul>
              <li><strong>{backupPreflight.workspace_count} 个项目</strong></li>
              <li><strong>{backupPreflight.run_count} 条研究记录</strong></li>
              <li><strong>{backupPreflight.collection_count} 项个人收藏</strong></li>
              <li><strong>{backupPreflight.input_artifact_count} 份任务书或附件</strong></li>
              <li><strong>约 {formatBackupSize(backupPreflight.total_bytes)}</strong></li>
            </ul>
            <p>恢复后，现在的 {workspaceCount} 个项目、{runCount} 条研究记录会换成这份备份里的内容；中途出任何差错，会用自动留底退回原状。</p>
            {restoreConfirmOpen ? (
              <div className="data-restore-confirm" role="group" aria-label="最终确认">
                <p>真的要替换吗？开始后请保持页面打开。</p>
                {/* 取消 is focused first so the safe exit is one keypress away. */}
                <button
                  type="button"
                  autoFocus
                  disabled={dataOperation === 'restore'}
                  onClick={() => setRestoreConfirmOpen(false)}
                >
                  取消
                </button>
                <button
                  className="danger-action"
                  type="button"
                  disabled={Boolean(dataOperation) || isRunActive}
                  onClick={() => void handleRestoreBackup()}
                >
                  <Upload aria-hidden="true" />
                  {dataOperation === 'restore' ? '正在恢复……' : '确定替换'}
                </button>
              </div>
            ) : (
              <button
                className="danger-action"
                type="button"
                disabled={Boolean(dataOperation) || isRunActive}
                onClick={() => setRestoreConfirmOpen(true)}
              >
                <Upload aria-hidden="true" />
                替换当前数据并恢复
              </button>
            )}
          </section>
        )}
      </section>

      {dataStatus && <p className="data-operation-status" aria-live="polite"><Check aria-hidden="true" />{dataStatus}</p>}
    </section>
  )
}
