import { describe, expect, it } from 'vitest'

import {
  buildCoverageReport,
  isSafePublicUrl,
  verifyEvidenceFindings,
} from './research-services'

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
})
