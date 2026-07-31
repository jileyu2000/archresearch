import { describe, expect, it, vi } from 'vitest'

import { runResearchWorkflow, workflowStageTimeout } from './workflow'

describe('mock Evidence-Grounded Plan-and-Execute workflow', () => {
  it('keeps the bounded visual analysis stage from timing out before 48 image slots are processed', () => {
    expect(workflowStageTimeout('analyzing')).toBe('20 minutes')
    expect(workflowStageTimeout('planning')).toBe('5 minutes')
  })

  it('checkpoints all seven stages and completes only with evidence-bound facts', async () => {
    const checkpoints: Array<{ stage: string; summary: Record<string, unknown> }> = []
    const services = {
      plan: vi.fn().mockResolvedValue([
        { id: 'section', question: '剖面如何组织开放与安静空间？' },
      ]),
      search: vi.fn().mockResolvedValue([
        { url: 'https://example.com/library', title: 'Courtyard Library' },
      ]),
      inspect: vi.fn().mockResolvedValue([
        {
          url: 'https://example.com/library',
          title: 'Courtyard Library',
          imageUrl: 'https://example.com/library-section.jpg',
          text: 'Reading rooms step away from the public atrium across the section.',
        },
      ]),
      analyze: vi.fn().mockResolvedValue([
        {
          subquestionId: 'section',
          statement: '阅览空间沿剖面退离公共中庭。',
          sourceUrl: 'https://example.com/library',
          quote: 'Reading rooms step away from the public atrium across the section.',
        },
      ]),
      verify: vi.fn().mockImplementation(async (findings: unknown) => findings),
      checkCoverage: vi.fn().mockResolvedValue({
        coverageSatisfied: true,
        enrichmentSatisfied: true,
        gaps: [],
      }),
      compose: vi.fn().mockResolvedValue({
        summary: '用剖面距离和高差把开放中庭与安静阅览区分开。',
        sections: [{
          id: 'section',
          title: '剖面分区',
          facts: [{
            statement: '阅览空间沿剖面退离公共中庭。',
            sourceUrl: 'https://example.com/library',
            quote: 'Reading rooms step away from the public atrium across the section.',
          }],
        }],
      }),
    }

    const result = await runResearchWorkflow(
      {
        runId: 'run-mock',
        workspaceId: 'workspace-studio',
        question: '社区图书馆如何用剖面组织安静与开放空间？',
        goal: 'precedent_research',
        mode: 'balanced',
        researchSources: [],
        clientSessionId: 'device-session-1',
      },
      services,
      {
        save: async (stage, summary) => {
          checkpoints.push({ stage, summary })
        },
      },
    )

    expect(checkpoints.map(({ stage }) => stage)).toEqual([
      'planning',
      'searching',
      'inspecting',
      'analyzing',
      'verifying',
      'gap_check',
      'composing',
    ])
    expect(checkpoints.find(({ stage }) => stage === 'verifying')?.summary).toMatchObject({
      verifiedFindingCount: 1,
      findings: [expect.objectContaining({
        sourceUrl: 'https://example.com/library',
      })],
    })
    expect(result).toMatchObject({
      runId: 'run-mock',
      workspaceId: 'workspace-studio',
      question: '社区图书馆如何用剖面组织安静与开放空间？',
      goal: 'precedent_research',
      mode: 'balanced',
      status: 'completed',
      coverage: {
        coverageSatisfied: true,
        enrichmentSatisfied: true,
      },
    })
    expect(result.sections[0]?.facts[0]).toEqual(expect.objectContaining({
      sourceUrl: 'https://example.com/library',
      sourceTitle: 'Courtyard Library',
      imageUrl: 'https://example.com/library-section.jpg',
      quote: expect.stringContaining('public atrium'),
    }))
  })

  it('does not claim completion when coverage and enrichment do not both pass', async () => {
    const services = {
      plan: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      inspect: vi.fn().mockResolvedValue([]),
      analyze: vi.fn().mockResolvedValue([]),
      verify: vi.fn().mockResolvedValue([]),
      checkCoverage: vi.fn().mockResolvedValue({
        coverageSatisfied: true,
        enrichmentSatisfied: false,
        gaps: ['缺少跨案例比较'],
      }),
      compose: vi.fn().mockResolvedValue({
        summary: '已有部分依据。',
        sections: [],
      }),
    }

    const result = await runResearchWorkflow(
      {
        runId: 'run-partial',
        workspaceId: 'workspace-studio',
        question: '旧厂房如何组织新旧结构？',
        goal: 'precedent_research',
        mode: 'quick',
        researchSources: [],
        clientSessionId: 'device-session-2',
      },
      services,
      { save: vi.fn() },
    )

    expect(result.status).toBe('partial')
    expect(result.coverage.enrichmentSatisfied).toBe(false)
  })

  it('checkpoints visual directions before waiting for bounded Chrome observations', async () => {
    const visualSources = [{
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '社区图书馆线稿轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewObjectKey: 'visual-previews/run-visual/1.png',
      adjacentText: '细线、蓝色编号与留白组织公共流线。',
    }]
    const checkpoints: Array<{ stage: string; summary: Record<string, unknown> }> = []
    const services = {
      plan: vi.fn().mockResolvedValue([
        {
          id: 'linework',
          question: '精细线稿轴测图',
          searchQuery: '社区图书馆 精细线稿 轴测图',
        },
      ]),
      search: vi.fn().mockResolvedValue([]),
      inspect: vi.fn().mockResolvedValue([]),
      analyze: vi.fn().mockResolvedValue([]),
      verify: vi.fn().mockResolvedValue([]),
      checkCoverage: vi.fn().mockResolvedValue({
        coverageSatisfied: false,
        enrichmentSatisfied: false,
        gaps: ['每个方向需要 3 篇可用小红书笔记'],
      }),
      compose: vi.fn().mockResolvedValue({
        summary: '已保留当前可用的图纸观察。',
        sections: [],
      }),
    }
    const waitForEvent = vi.fn().mockResolvedValue({
      payload: { sources: visualSources },
    })

    await runResearchWorkflow(
      {
        runId: 'run-visual',
        workspaceId: 'workspace-studio',
        question: '社区图书馆如何用轴测图表达公共流线？',
        goal: 'visual_reference_search',
        mode: 'balanced',
        researchSources: ['xiaohongshu'],
        clientSessionId: 'device-session-visual',
      },
      services,
      {
        save: async (stage, summary) => {
          checkpoints.push({ stage, summary })
        },
      },
      {
        do: async (_stage, callback) => await callback(),
        waitForEvent,
      },
    )

    expect(checkpoints[0]).toEqual({
      stage: 'planning',
      summary: {
        subquestionCount: 1,
        subquestions: [{
          id: 'linework',
          question: '精细线稿轴测图',
          searchQuery: '社区图书馆 精细线稿 轴测图',
        }],
        awaitingBrowserVisualSources: true,
      },
    })
    expect(waitForEvent).toHaveBeenCalledWith(
      'xiaohongshu-visual-sources',
      { type: 'xiaohongshu_visual_sources', timeout: '10 minutes' },
    )
    expect(services.search).toHaveBeenCalledWith(
      expect.objectContaining({ browserVisualSources: visualSources }),
      expect.any(Array),
    )
  })
})
