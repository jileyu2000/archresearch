import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useReducer,
  useRef,
} from 'react'

import { apiClient } from '../api/client'
import type { StyleDraft } from '../components/StylePanel'
import {
  defaultStyle,
  runPayloadReducer,
  type RunPayloadState,
} from '../lib/runPayload'
import { toWorkResult } from '../lib/workResult'

type UseRunHydrationOptions = {
  initialPayload: RunPayloadState
  loadBrowserReadiness: (shouldApply?: () => boolean) => Promise<void>
  onHydrated?: () => void
}

function resolveState<T>(value: SetStateAction<T>, current: T) {
  return typeof value === 'function'
    ? (value as (previous: T) => T)(current)
    : value
}

export function useRunHydration({
  initialPayload,
  loadBrowserReadiness,
  onHydrated,
}: UseRunHydrationOptions) {
  const [runPayload, dispatch] = useReducer(runPayloadReducer, initialPayload)
  const runRequestRef = useRef(0)

  const updateField = useCallback(<Key extends keyof RunPayloadState>(
    key: Key,
    value: SetStateAction<RunPayloadState[Key]>,
  ) => {
    dispatch({
      type: 'update',
      update: (current) => ({
        ...current,
        [key]: resolveState(value, current[key]),
      }),
    })
  }, [])

  const beginRunRequest = useCallback(() => {
    runRequestRef.current += 1
    return runRequestRef.current
  }, [])
  const currentRunRequest = useCallback(() => runRequestRef.current, [])
  const invalidateRunRequests = useCallback(() => {
    runRequestRef.current += 1
    return runRequestRef.current
  }, [])
  const isRunRequestCurrent = useCallback(
    (requestId: number) => runRequestRef.current === requestId,
    [],
  )
  const resetRunPayload = useCallback(() => dispatch({ type: 'reset' }), [])

  const hydrateRun = useCallback(async (runId: string, requestId: number) => {
    const shouldApply = () => isRunRequestCurrent(requestId)
    const [apiResults, board, userState, events] = await Promise.all([
      apiClient.getResults(runId),
      apiClient.getBoard(runId),
      apiClient.getUserState(runId),
      apiClient.getEvents(runId),
      loadBrowserReadiness(shouldApply),
    ])
    if (!shouldApply()) return false
    const nextResults = apiResults.map(toWorkResult)
    dispatch({
      type: 'hydrate',
      payload: {
        results: nextResults,
        selectedResultId: nextResults[0]?.id ?? '',
        selectedSubquestionId: nextResults[0]?.subquestionIds[0] ?? '',
        boardId: board.id,
        comparisonIds: board.selected_asset_ids,
        savedIds: userState.saved.map((item) => item.asset_candidate_id),
        rejectedIds: userState.rejected.map((item) => item.asset_candidate_id),
        notes: Object.fromEntries(
          userState.saved.map((item) => [item.asset_candidate_id, item.note]),
        ),
        traceEvents: events,
        styleProfile: defaultStyle,
      },
    })
    onHydrated?.()

    const profile = await apiClient.getStyleProfile(board.id)
    if (!shouldApply()) return false
    const styleProfile: StyleDraft = profile
      ? {
          primaryColor: profile.palette[0] ?? defaultStyle.primaryColor,
          lineHierarchy: (() => {
            const primary = profile.line_weights.primary ?? 1
            const secondary = profile.line_weights.secondary ?? 0.35
            return primary === secondary
              ? 'uniform'
              : primary >= 1.1
                ? 'contrast'
                : 'relative'
          })(),
          fontCategory:
            profile.font_category === 'serif' || profile.font_category === 'mono'
              ? profile.font_category
              : 'sans',
          texture:
            profile.texture === 'vellum' || profile.texture === 'grain'
              ? profile.texture
              : 'none',
          layoutNotes: profile.layout_notes ?? '',
        }
      : defaultStyle
    updateField('styleProfile', styleProfile)
    return true
  }, [isRunRequestCurrent, loadBrowserReadiness, onHydrated, updateField])

  return {
    runPayload,
    beginRunRequest,
    currentRunRequest,
    hydrateRun,
    invalidateRunRequests,
    isRunRequestCurrent,
    resetRunPayload,
    setComparisonIds: useCallback<Dispatch<SetStateAction<string[]>>>(
      (value) => updateField('comparisonIds', value),
      [updateField],
    ),
    setNotes: useCallback<Dispatch<SetStateAction<Record<string, string>>>>(
      (value) => updateField('notes', value),
      [updateField],
    ),
    setRejectedIds: useCallback<Dispatch<SetStateAction<string[]>>>(
      (value) => updateField('rejectedIds', value),
      [updateField],
    ),
    setSavedIds: useCallback<Dispatch<SetStateAction<string[]>>>(
      (value) => updateField('savedIds', value),
      [updateField],
    ),
    setSelectedResultId: useCallback<Dispatch<SetStateAction<string>>>(
      (value) => updateField('selectedResultId', value),
      [updateField],
    ),
    setSelectedSubquestionId: useCallback<Dispatch<SetStateAction<string>>>(
      (value) => updateField('selectedSubquestionId', value),
      [updateField],
    ),
    setStyleProfile: useCallback<Dispatch<SetStateAction<StyleDraft>>>(
      (value) => updateField('styleProfile', value),
      [updateField],
    ),
  }
}
