import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'

describe('public research workspace', () => {
  it('opens on the usable workspace, restores local history, and asks for no API key', async () => {
    const history = {
      listRuns: vi.fn().mockResolvedValue([{
        schemaVersion: 1,
        id: 'run-history',
        question: '旧厂房如何植入新的公共功能？',
        mode: 'quick',
        status: 'completed',
        checkpointStage: 'composing',
        createdAt: '2026-07-29T00:00:00.000Z',
        updatedAt: '2026-07-29T00:02:00.000Z',
      }]),
      getResults: vi.fn().mockResolvedValue([]),
      saveRun: vi.fn(),
      saveResult: vi.fn(),
      listCollections: vi.fn().mockResolvedValue([]),
      saveCollection: vi.fn(),
      exportBackup: vi.fn(),
      importBackup: vi.fn(),
      close: vi.fn(),
    }
    const client = {
      getConfig: vi.fn().mockResolvedValue({ turnstileSiteKey: 'public-site-key' }),
      startResearch: vi.fn(),
      getRun: vi.fn(),
      cancelRun: vi.fn(),
    }

    render(
      <App
        client={client}
        history={history}
        clientSessionId="device-session-test"
        verificationToken="test-turnstile-token"
      />,
    )

    expect(screen.getByRole('heading', { name: 'ArchResearch' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '研究问题' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始实时研究' })).toBeInTheDocument()
    expect(screen.queryByText(/API Key/i)).not.toBeInTheDocument()
    expect(screen.getByText('记录保存在此浏览器')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('旧厂房如何植入新的公共功能？')).toBeInTheDocument()
    })
  })

  it('starts one verified run and checkpoints it in browser-local history immediately', async () => {
    const history = {
      listRuns: vi.fn().mockResolvedValue([]),
      getResults: vi.fn().mockResolvedValue([]),
      saveRun: vi.fn().mockResolvedValue(undefined),
      saveResult: vi.fn(),
      listCollections: vi.fn().mockResolvedValue([]),
      saveCollection: vi.fn(),
      exportBackup: vi.fn(),
      importBackup: vi.fn(),
      close: vi.fn(),
    }
    const client = {
      getConfig: vi.fn().mockResolvedValue({ turnstileSiteKey: 'public-site-key' }),
      startResearch: vi.fn().mockResolvedValue({ runId: 'run-new', status: 'created' }),
      getRun: vi.fn(),
      cancelRun: vi.fn(),
    }

    render(
      <App
        client={client}
        history={history}
        clientSessionId="device-session-test"
        verificationToken="test-turnstile-token"
      />,
    )
    fireEvent.change(screen.getByRole('textbox', { name: '研究问题' }), {
      target: { value: '社区图书馆如何用剖面组织安静与开放空间？' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始实时研究' }))

    await waitFor(() => {
      expect(client.startResearch).toHaveBeenCalledWith({
        question: '社区图书馆如何用剖面组织安静与开放空间？',
        mode: 'balanced',
        clientSessionId: 'device-session-test',
        turnstileToken: 'test-turnstile-token',
      })
    })
    expect(history.saveRun).toHaveBeenCalledWith(expect.objectContaining({
      id: 'run-new',
      question: '社区图书馆如何用剖面组织安静与开放空间？',
      status: 'created',
    }))
  })
})
