import { beforeEach, describe, expect, it } from 'vitest'

import type { PersonalCollection, ResearchRun } from '../api/client'
import {
  formatBackupSize,
  formatBackupTime,
  lastBackupStorageKey,
  readLastBackupRecord,
} from './backup'
import {
  collectionCaseSubquestions,
  collectionSelectionKey,
} from './collections'
import { demoDepthFromSearch, demoSubquestionsFor } from './demo'
import {
  drawingFor,
  questionRelevanceLabel,
  visualPlatformName,
} from './labels'
import {
  needsCompletionContinuation,
  partialReasonTitle,
  runAnnouncement,
} from './run'
import { activeWorkspaceStorageKey } from './storage'
import {
  conciseSynthesisHeadline,
  firstUserFacingBoundary,
  userFacingRecommendation,
} from './text'
import { availablePreviewUrl, fallbackSubquestions, type WorkResult } from './workResult'

describe('App pure module contracts', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps storage and backup formatting behavior stable', () => {
    expect(activeWorkspaceStorageKey).toBe('archresearch.activeWorkspaceId')
    expect(formatBackupSize(1_048_576)).toBe('1.0 MB')
    expect(formatBackupTime('invalid')).toBe('invalid')

    window.localStorage.setItem(
      lastBackupStorageKey,
      JSON.stringify({ at: '2026-07-27T10:05:00', bytes: 2048 }),
    )
    expect(readLastBackupRecord()).toEqual({
      at: '2026-07-27T10:05:00',
      bytes: 2048,
    })
  })

  it('keeps text cleanup and user-facing boundary behavior stable', () => {
    expect(conciseSynthesisHeadline('一句足够短的结论。')).toBe('一句足够短的结论。')
    expect(userFacingRecommendation('【转译建议】先设置连续的公共路径。')).toBe(
      '先设置连续的公共路径。',
    )
    expect(firstUserFacingBoundary([
      '来源仍需核对',
      '适用条件：需要保留足够的原结构承载力',
    ])).toBe('需要保留足够的原结构承载力')
  })

  it('keeps labels and drawing mappings stable', () => {
    expect(questionRelevanceLabel(4)).toBe('直接支撑本题')
    expect(visualPlatformName('https://www.xiaohongshu.com/explore/example')).toBe('小红书')
    expect(drawingFor('plan')).toBe('courtyard')
  })

  it('keeps run status explanations stable', () => {
    const completedRun = {
      status: 'completed',
      goal: 'precedent_research',
      mode: 'quick',
      subquestions: [],
      coverageReport: { enrichment_gaps: [] },
    } as unknown as ResearchRun
    const incompleteRun = {
      ...completedRun,
      status: 'partial',
      coverageReport: { gaps: ['uncovered_subquestions'] },
    } as unknown as ResearchRun

    expect(runAnnouncement(completedRun)).toBe('研究已完成')
    expect(needsCompletionContinuation(incompleteRun)).toBe(true)
    expect(partialReasonTitle('no_new_assets')).toBe('这轮没有找到更多可用案例')

    expect(runAnnouncement({
      ...completedRun,
      goal: 'visual_reference_search',
      status: 'failed',
      stopReason: 'provider_error:visual_analysis_unavailable',
    } as unknown as ResearchRun)).toBe(
      '图纸分析暂时不可用，已找到的图纸已保留，可重新发起研究',
    )
  })

  it('keeps demo selection behavior stable', () => {
    expect(demoDepthFromSearch('?demo=1')).toBe('balanced')
    expect(demoSubquestionsFor('quick')).toHaveLength(3)
  })

  it('keeps collection fallback behavior stable', () => {
    const item = {
      note: '保留原有结构，植入独立盒子。',
      snapshot: {
        project_context: '旧厂房保留主体结构。',
        design_mechanism: '',
        transfer_strategy: ['新构件与旧结构脱开。'],
        limitations: [],
      },
    } as unknown as PersonalCollection

    expect(collectionSelectionKey('asset-1', 'direction-1')).toBe('direction-1:asset-1')
    expect(collectionCaseSubquestions(item)).toEqual([
      expect.objectContaining({
        id: 'legacy',
        design_mechanism: '保留原有结构，植入独立盒子。',
      }),
    ])
  })

  it('keeps work-result fallbacks and failed previews stable', () => {
    expect(fallbackSubquestions([], '如何组织公共流线？')).toEqual([
      expect.objectContaining({
        id: 'general',
        question: '如何组织公共流线？',
      }),
    ])

    const result = {
      id: 'asset-1',
      previewUrl: 'https://images.example/asset-1.jpg',
    } as WorkResult
    expect(availablePreviewUrl(result, {})).toBe(result.previewUrl)
    expect(availablePreviewUrl(result, { 'asset-1': result.previewUrl! })).toBeNull()
  })
})
