import { describe, expect, it } from 'vitest'

import source from './App.tsx?raw'

// The user-facing vocabulary is settled: one concept gets one plain name.
// This guard keeps retired or internal wording from drifting back into the
// board source. It intentionally checks the source text, not a render,
// because vocabulary regressions can hide in rarely rendered branches.
describe('copy glossary', () => {
  it('keeps retired and internal vocabulary out of user-facing copy', () => {
    const banned = [
      '聚合来源',
      '权利未知',
      '需要检查环境',
      '配对码',
      '精确提取',
      '档位',
      '使用边界',
      '方法对照',
      '分享版权利检查',
      '可嵌入',
      '返回画板',
      '主页收藏',
      '续研检查点',
      '分享证据板',
      '视觉观察',
      '该历史候选',
      '线型层级',
      '加入成功',
      // Retired after the simulated persona walkthrough: three first-time
      // readers each stumbled on these exact phrases.
      '轮流检索',
      '案例子问题',
      '研究已形成初步依据',
      '已形成初步灵感',
      '还剩',
      '尚未结束或已经完成的研究记录',
      // Retired with the backup-and-restore page redesign: the page now
      // speaks in scenarios and consequences, not packaging internals.
      '工作区数据',
      '检查备份包',
      '校验并恢复',
      'SHA-256',
      '预检',
    ]
    for (const term of banned) {
      expect(source, `retired term "${term}" must not reappear`).not.toContain(term)
    }
  })

  it('tells the user what happens while research runs', () => {
    expect(source).toContain('完成后结果会自动显示在这里')
  })

  it('names the comparison workflow and connection action consistently', () => {
    expect(source).toContain('对照案例策略')
    expect(source).toContain('连接 Chrome 读取高清图纸')
    expect(source).toContain('转载合集（非首发）')
  })
})
