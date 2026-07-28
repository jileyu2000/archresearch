import type { TraceEvent } from '../api/client'
import type { StyleDraft } from '../components/StylePanel'
import type { WorkResult } from './workResult'

export const defaultStyle: StyleDraft = {
  primaryColor: '#315cf4',
  lineHierarchy: 'relative',
  fontCategory: 'sans',
  texture: 'none',
  layoutNotes: '',
}

export type RunPayloadState = {
  results: WorkResult[]
  selectedResultId: string
  selectedSubquestionId: string
  boardId: string
  comparisonIds: string[]
  savedIds: string[]
  rejectedIds: string[]
  notes: Record<string, string>
  traceEvents: TraceEvent[]
  styleProfile: StyleDraft
}

export const defaultRunPayload: RunPayloadState = {
  results: [],
  selectedResultId: '',
  selectedSubquestionId: '',
  boardId: '',
  comparisonIds: [],
  savedIds: [],
  rejectedIds: [],
  notes: {},
  traceEvents: [],
  styleProfile: defaultStyle,
}

export type RunPayloadAction =
  | { type: 'hydrate'; payload: RunPayloadState }
  | { type: 'reset' }
  | { type: 'update'; update: (current: RunPayloadState) => RunPayloadState }

export function runPayloadReducer(
  state: RunPayloadState,
  action: RunPayloadAction,
): RunPayloadState {
  if (action.type === 'hydrate') return action.payload
  if (action.type === 'reset') {
    return {
      ...defaultRunPayload,
      styleProfile: { ...defaultStyle },
    }
  }
  return action.update(state)
}
