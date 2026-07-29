import { describe, expect, it, vi } from 'vitest'

import {
  buildCoverageReport,
  buildVisualCoverageReport,
  createLiveResearchServices,
  isSafePublicUrl,
  verifyEvidenceFindings,
} from './research-services'
import type { ResearchWorkflowInput } from './workflow'

describe('public page evidence boundary', () => {
  it('accepts only safe public HTTPS URLs', () => {
    expect(isSafePublicUrl('https://www.archdaily.com/1000000/project')).toBe(true)
    expect(isSafePublicUrl('http://127.0.0.1:8000/private')).toBe(false)
    expect(isSafePublicUrl('https://localhost/admin')).toBe(false)
    expect(isSafePublicUrl('file:///C:/secret.txt')).toBe(false)
    expect(isSafePublicUrl('javascript:alert(1)')).toBe(false)
  })

  it('keeps only facts whose verbatim quote occurs in the matching source', () => {
    const sources = [{
      url: 'https://www.archdaily.com/project',
      title: 'Courtyard Library',
      text: 'Reading rooms step away from the public atrium across the section.',
    }]
    const verified = verifyEvidenceFindings([
      {
        subquestionId: 'section',
        statement: '阅览空间沿剖面退离公共中庭。',
        sourceUrl: 'https://www.archdaily.com/project',
        quote: 'Reading rooms step away from the public atrium across the section.',
      },
      {
        subquestionId: 'section',
        statement: '屋顶形成公共花园。',
        sourceUrl: 'https://www.archdaily.com/project',
        quote: 'The roof becomes a public garden.',
      },
      {
        subquestionId: 'section',
        statement: '使用了另一个未读取来源。',
        sourceUrl: 'https://example.com/unread',
        quote: 'Unseen source.',
      },
    ], sources)

    expect(verified).toEqual([expect.objectContaining({
      statement: '阅览空间沿剖面退离公共中庭。',
      quote: expect.stringContaining('public atrium'),
    })])
  })

  it('requires both per-question coverage and enough distinct sources', () => {
    const plan = [
      { id: 'section', question: '剖面如何分区？' },
      { id: 'circulation', question: '流线如何组织？' },
      { id: 'structure', question: '结构如何表达？' },
    ]
    const findings = [
      {
        subquestionId: 'section',
        statement: '剖面结论',
        sourceUrl: 'https://example.com/a',
        quote: 'Section evidence.',
      },
      {
        subquestionId: 'circulation',
        statement: '流线结论',
        sourceUrl: 'https://example.com/a',
        quote: 'Circulation evidence.',
      },
    ]

    expect(buildCoverageReport(plan, findings)).toEqual({
      coverageSatisfied: false,
      enrichmentSatisfied: false,
      gaps: ['结构如何表达？', '至少还需要 2 个独立来源'],
    })
  })

  it('uses Chrome-provided Xiaohongshu observations without refetching the note page', async () => {
    const provider = { generateStructured: vi.fn() }
    const pageReader = { inspect: vi.fn() }
    const { services } = createLiveResearchServices(
      provider as never,
      pageReader as never,
      0.01,
    )
    const input: ResearchWorkflowInput = {
      runId: 'run-xhs',
      workspaceId: 'workspace-xhs',
      question: '社区图书馆蓝色轴测图',
      goal: 'visual_reference_search',
      mode: 'quick',
      researchSources: ['xiaohongshu'],
      browserVisualSources: [{
        directionId: 'color',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
        title: '蓝色轴测图',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
        previewObjectKey: 'visual-previews/run-xhs/1.png',
        adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
      }],
      clientSessionId: 'device-session-1',
    }
    const plan = [
      { id: 'color', question: '配色如何组织？' },
      { id: 'line', question: '线型如何组织？' },
    ]

    const candidates = await services.search(input, plan)
    const sources = await services.inspect(input, candidates)

    expect(provider.generateStructured).not.toHaveBeenCalled()
    expect(pageReader.inspect).not.toHaveBeenCalled()
    expect(sources).toEqual([{
      url: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      subquestionId: 'color',
      text: '蓝色轴测图，使用细线与编号组织信息。',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewObjectKey: 'visual-previews/run-xhs/1.png',
      candidateId: expect.any(String),
    }])
  })

  it('classifies each bounded Chrome image instead of treating card text as visual analysis', async () => {
    const provider = {
      generateStructured: vi.fn().mockResolvedValue({
        data: {
          classifications: [{
            candidateId: 'visual-1',
            assetType: 'axonometric',
            relevance: 5,
            observations: ['细蓝线建立主体轮廓，编号节点强调公共流线。'],
          }],
        },
        costUsd: 0.01,
      }),
    }
    const { services } = createLiveResearchServices(
      provider as never,
      { inspect: vi.fn() } as never,
      0.01,
      vi.fn().mockResolvedValue('data:image/png;base64,aW1hZ2U='),
    )
    const input: ResearchWorkflowInput = {
      runId: 'run-xhs-visual',
      workspaceId: 'workspace-xhs',
      question: '社区图书馆蓝色轴测图',
      goal: 'visual_reference_search',
      mode: 'balanced',
      researchSources: ['xiaohongshu'],
      browserVisualSources: [{
        directionId: 'linework',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
        title: '蓝色轴测图',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
        previewObjectKey: 'visual-previews/run-xhs-visual/1.png',
        adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
      }],
      clientSessionId: 'device-session-1',
    }
    const plan = [{ id: 'linework', question: '精细线稿轴测图' }]
    const candidates = await services.search(input, plan)
    expect(candidates[0]).toMatchObject({ candidateId: expect.any(String) })
    const candidateId = candidates[0]!.candidateId!
    provider.generateStructured.mockResolvedValueOnce({
      data: {
        classifications: [{
          candidateId,
          assetType: 'axonometric',
          relevance: 5,
          observations: ['细蓝线建立主体轮廓，编号节点强调公共流线。'],
        }],
      },
      costUsd: 0.01,
    })
    const sources = await services.inspect(input, candidates)

    await expect(services.analyze(input, plan, sources)).resolves.toEqual([{
      candidateId,
      subquestionId: 'linework',
      statement: '细蓝线建立主体轮廓，编号节点强调公共流线。',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      quote: '蓝色轴测图，使用细线与编号组织信息。',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      assetType: 'axonometric',
    }])
    expect(provider.generateStructured).toHaveBeenCalledWith(expect.objectContaining({
      schemaName: 'visual_classifications',
      input: [{
        role: 'user',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'input_image',
            image_url: 'data:image/png;base64,aW1hZ2U=',
          }),
        ]),
      }],
    }))
  })

  it('requires three usable notes in every planned visual direction', () => {
    const plan = [
      { id: 'linework', question: '精细线稿轴测图' },
      { id: 'collage', question: '拼贴叙事轴测图' },
    ]
    const finding = (subquestionId: string, note: number) => ({
      subquestionId,
      statement: `观察 ${note}`,
      sourceUrl: `https://www.xiaohongshu.com/explore/${subquestionId}-${note}`,
      quote: `笔记 ${note}`,
    })

    expect(buildVisualCoverageReport(plan, [
      finding('linework', 1),
      finding('linework', 2),
      finding('linework', 3),
      finding('collage', 1),
      finding('collage', 2),
    ])).toEqual({
      coverageSatisfied: true,
      enrichmentSatisfied: false,
      gaps: ['拼贴叙事轴测图：还需要 1 篇可用小红书笔记'],
    })
  })
})
