import { describe, expect, it, vi } from 'vitest'

import { runResearchWorkflow } from './workflow'

describe('mock Evidence-Grounded Plan-and-Execute workflow', () => {
  it('checkpoints all seven stages and completes only with evidence-bound facts', async () => {
    const checkpoints: string[] = []
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
        question: '社区图书馆如何用剖面组织安静与开放空间？',
        mode: 'balanced',
        clientSessionId: 'device-session-1',
      },
      services,
      {
        save: async (stage) => {
          checkpoints.push(stage)
        },
      },
    )

    expect(checkpoints).toEqual([
      'planning',
      'searching',
      'inspecting',
      'analyzing',
      'verifying',
      'gap_check',
      'composing',
    ])
    expect(result).toMatchObject({
      runId: 'run-mock',
      status: 'completed',
      coverage: {
        coverageSatisfied: true,
        enrichmentSatisfied: true,
      },
    })
    expect(result.sections[0]?.facts[0]).toEqual(expect.objectContaining({
      sourceUrl: 'https://example.com/library',
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
        question: '旧厂房如何组织新旧结构？',
        mode: 'quick',
        clientSessionId: 'device-session-2',
      },
      services,
      { save: vi.fn() },
    )

    expect(result.status).toBe('partial')
    expect(result.coverage.enrichmentSatisfied).toBe(false)
  })
})
