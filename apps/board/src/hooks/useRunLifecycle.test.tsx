import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  apiClient,
  type ApiReferenceBoard,
  type ResearchRun,
  type RunUserState,
  type TraceEvent,
} from '../api/client'
import {
  defaultRunPayload,
  defaultStyle,
  runPayloadReducer,
  type RunPayloadState,
} from '../lib/runPayload'
import type { WorkResult } from '../lib/workResult'
import { useRunHydration } from './useRunHydration'
import { useRunPolling } from './useRunPolling'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

const resultItem = { id: 'result-1', subquestionIds: ['question-1'] } as WorkResult
const hydratedPayload: RunPayloadState = {
  results: [resultItem],
  selectedResultId: 'result-1',
  selectedSubquestionId: 'question-1',
  boardId: 'board-1',
  comparisonIds: ['result-1'],
  savedIds: ['result-1'],
  rejectedIds: [],
  notes: { 'result-1': 'keep this' },
  traceEvents: [{ id: 'event-1' } as TraceEvent],
  styleProfile: { ...defaultStyle, primaryColor: '#123456' },
}

const terminalRun: ResearchRun = {
  id: 'run-1',
  question: 'How should the shared hall work?',
  goal: 'precedent_research',
  status: 'completed',
  mode: 'balanced',
  subquestions: [],
}

describe('run payload lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hydrates and resets the complete run payload atomically', () => {
    expect(runPayloadReducer(defaultRunPayload, {
      type: 'hydrate',
      payload: hydratedPayload,
    })).toEqual(hydratedPayload)

    expect(runPayloadReducer(hydratedPayload, { type: 'reset' })).toEqual(defaultRunPayload)
  })

  it('hydrates board, user state, trace, and style into one run payload', async () => {
    vi.spyOn(apiClient, 'getResults').mockResolvedValue([])
    vi.spyOn(apiClient, 'getBoard').mockResolvedValue({
      id: 'board-1',
      run_id: 'run-1',
      selected_asset_ids: ['saved-1'],
    })
    vi.spyOn(apiClient, 'getUserState').mockResolvedValue({
      saved: [{ asset_candidate_id: 'saved-1', note: 'retain this' }],
      rejected: [{ asset_candidate_id: 'rejected-1', reason: 'not relevant' }],
    })
    vi.spyOn(apiClient, 'getEvents').mockResolvedValue([
      { id: 'event-1' } as TraceEvent,
    ])
    vi.spyOn(apiClient, 'getStyleProfile').mockResolvedValue({
      id: 'style-1',
      board_id: 'board-1',
      palette: ['#123456'],
      line_weights: { primary: 1.2, secondary: 0.25 },
      font_category: 'serif',
      texture: 'grain',
      layout_notes: 'Keep the grid',
    })
    const onHydrated = vi.fn()
    const { result } = renderHook(() => useRunHydration({
      initialPayload: defaultRunPayload,
      loadBrowserReadiness: vi.fn().mockResolvedValue(undefined),
      onHydrated,
    }))

    await act(async () => {
      const requestId = result.current.beginRunRequest()
      await expect(result.current.hydrateRun('run-1', requestId)).resolves.toBe(true)
    })

    expect(result.current.runPayload).toEqual({
      ...defaultRunPayload,
      boardId: 'board-1',
      comparisonIds: ['saved-1'],
      savedIds: ['saved-1'],
      rejectedIds: ['rejected-1'],
      notes: { 'saved-1': 'retain this' },
      traceEvents: [{ id: 'event-1' }],
      styleProfile: {
        primaryColor: '#123456',
        lineHierarchy: 'contrast',
        fontCategory: 'serif',
        texture: 'grain',
        layoutNotes: 'Keep the grid',
      },
    })
    expect(onHydrated).toHaveBeenCalledOnce()
  })

  it('keeps local notes, rejection, and result selection updates in the reducer state', () => {
    const { result } = renderHook(() => useRunHydration({
      initialPayload: hydratedPayload,
      loadBrowserReadiness: vi.fn().mockResolvedValue(undefined),
    }))

    act(() => {
      result.current.setNotes((current) => ({ ...current, 'result-2': 'compare later' }))
      result.current.setRejectedIds((current) => [...current, 'result-2'])
      result.current.setSelectedResultId('result-2')
      result.current.setSelectedSubquestionId('question-2')
    })

    expect(result.current.runPayload.notes['result-2']).toBe('compare later')
    expect(result.current.runPayload.rejectedIds).toContain('result-2')
    expect(result.current.runPayload.selectedResultId).toBe('result-2')
    expect(result.current.runPayload.selectedSubquestionId).toBe('question-2')
  })

  it('does not apply an older hydration after its request generation is invalidated', async () => {
    vi.spyOn(apiClient, 'getResults').mockResolvedValue([])
    const board = deferred<ApiReferenceBoard>()
    vi.spyOn(apiClient, 'getBoard').mockReturnValue(board.promise)
    vi.spyOn(apiClient, 'getUserState').mockResolvedValue({
      saved: [],
      rejected: [],
    } satisfies RunUserState)
    vi.spyOn(apiClient, 'getEvents').mockResolvedValue([])
    vi.spyOn(apiClient, 'getStyleProfile').mockResolvedValue(null)
    const loadBrowserReadiness = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRunHydration({
      initialPayload: defaultRunPayload,
      loadBrowserReadiness,
    }))

    let hydration!: Promise<boolean>
    act(() => {
      const requestId = result.current.beginRunRequest()
      hydration = result.current.hydrateRun('run-1', requestId)
      result.current.invalidateRunRequests()
    })
    await act(async () => {
      board.resolve({
        id: 'board-1',
        run_id: 'run-1',
        selected_asset_ids: [],
      })
      await hydration
    })

    expect(result.current.runPayload).toEqual(defaultRunPayload)
    expect(loadBrowserReadiness).toHaveBeenCalledOnce()
    expect(result.current.currentRunRequest()).toBe(2)
  })

  it('updates a watched terminal run, stops polling, then hydrates its payload', async () => {
    vi.useFakeTimers()
    vi.spyOn(apiClient, 'getRun').mockResolvedValue(terminalRun)
    const calls: string[] = []
    const hydrateRun = vi.fn(async () => {
      calls.push('hydrate')
      return true
    })

    renderHook(() => useRunPolling({
      activeRunId: 'run-1',
      currentRunRequest: () => 4,
      demoMode: false,
      hydrateRun,
      isRunRequestCurrent: (requestId) => requestId === 4,
      onError: vi.fn(),
      onPollingStopped: () => calls.push('stop'),
      onRecentRunUpdated: () => calls.push('recent'),
      onWatchingRunUpdated: () => calls.push('active'),
      pollingRunId: 'run-1',
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(calls).toEqual(['recent', 'active', 'stop', 'hydrate'])
    expect(hydrateRun).toHaveBeenCalledWith('run-1', 4)
  })
})
