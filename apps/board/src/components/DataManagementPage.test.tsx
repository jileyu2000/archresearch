import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '../api/client'
import { DataManagementPage } from './DataManagementPage'

const preflight = {
  ready: true,
  format_version: 1,
  schema_revision: 'd0f1a2b3c4d5',
  file_count: 5,
  total_bytes: 4096,
  categories: { database: 1, runs: 2, collections: 3, input_artifacts: 1 },
  workspace_count: 4,
  run_count: 15,
  collection_count: 14,
  input_artifact_count: 2,
}

function renderPage(overrides: Partial<React.ComponentProps<typeof DataManagementPage>> = {}) {
  const props: React.ComponentProps<typeof DataManagementPage> = {
    open: true,
    workspaceCount: 4,
    runCount: 15,
    isRunActive: false,
    dataStatus: '',
    onError: vi.fn(),
    onStatus: vi.fn(),
    onRestored: vi.fn(),
    ...overrides,
  }
  render(<DataManagementPage {...props} />)
  return props
}

describe('DataManagementPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('renders the settled backup copy and disables data changes during a research run', () => {
    renderPage({ isRunActive: true })

    expect(screen.getByRole('heading', { name: '备份与恢复' })).toBeVisible()
    expect(screen.getByText('4 个项目 · 15 条研究记录')).toBeVisible()
    expect(screen.getByRole('button', { name: '下载备份' })).toBeDisabled()
    expect(screen.getByLabelText('选择备份文件（.zip）')).toBeDisabled()
    expect(screen.getByText('有研究正在进行，恢复功能暂时停用。等研究结束后再来。')).toBeVisible()
  })

  it('preflights a selected archive before confirmation and reports restored workspaces to App', async () => {
    const user = userEvent.setup()
    const restoredWorkspaces = [
      { id: 'workspace-1', name: '原工作区' },
      { id: 'workspace-2', name: '恢复的工作区' },
    ]
    const preflightBackup = vi.spyOn(apiClient, 'preflightWorkspaceBackup').mockResolvedValue(preflight)
    const restoreBackup = vi.spyOn(apiClient, 'restoreWorkspaceBackup').mockResolvedValue({
      ...preflight,
      restored: true,
      rollback_backup: 'rollback.zip',
    })
    const listWorkspaces = vi.spyOn(apiClient, 'listWorkspaces').mockResolvedValue(restoredWorkspaces)
    const onRestored = vi.fn()
    const onStatus = vi.fn()
    renderPage({ onRestored, onStatus })
    const file = new File(['backup'], 'archresearch-backup.zip', { type: 'application/zip' })

    await user.upload(screen.getByLabelText('选择备份文件（.zip）'), file)

    expect(preflightBackup).toHaveBeenCalledWith(file)
    expect(await screen.findByText('检查通过，可以恢复')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '替换当前数据并恢复' }))
    expect(screen.getByRole('group', { name: '最终确认' })).toBeVisible()
    expect(restoreBackup).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确定替换' }))

    expect(restoreBackup).toHaveBeenCalledWith(file)
    expect(listWorkspaces).toHaveBeenCalledOnce()
    expect(onRestored).toHaveBeenCalledWith(restoredWorkspaces)
    expect(restoreBackup.mock.invocationCallOrder[0]).toBeLessThan(listWorkspaces.mock.invocationCallOrder[0])
    expect(listWorkspaces.mock.invocationCallOrder[0]).toBeLessThan(onRestored.mock.invocationCallOrder[0])
    expect(onStatus).toHaveBeenLastCalledWith('恢复完成，现在的数据就是这份备份里的内容。')
  })

  it('reports a failed backup download without recording a completed archive', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'downloadWorkspaceBackup').mockRejectedValue(new Error('磁盘空间不足'))
    const onError = vi.fn()
    renderPage({ onError })

    await user.click(screen.getByRole('button', { name: '下载备份' }))

    await waitFor(() => expect(onError).toHaveBeenLastCalledWith('磁盘空间不足'))
    expect(window.localStorage.getItem('archresearch.lastBackupDownload')).toBeNull()
  })
})
