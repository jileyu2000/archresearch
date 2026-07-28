import { describe, expect, it } from 'vitest'

import appSource from './App.tsx?raw'
import caseAnalysisSource from './components/CaseAnalysis.tsx?raw'
import comparisonDialogSource from './components/ComparisonDialog.tsx?raw'
import dataManagementPageSource from './components/DataManagementPage.tsx?raw'
import homeSectionsSource from './components/HomeSections.tsx?raw'
import personalCollectionsPageSource from './components/PersonalCollectionsPage.tsx?raw'
import researchComposerSource from './components/ResearchComposer.tsx?raw'
import sharePanelSource from './components/SharePanel.tsx?raw'
import sourceInspectorSource from './components/SourceInspector.tsx?raw'
import stylePanelSource from './components/StylePanel.tsx?raw'
import visualInspirationBoardSource from './components/VisualInspirationBoard.tsx?raw'
import browserReadinessSource from './hooks/useBrowserReadiness.ts?raw'
import backupSource from './lib/backup.ts?raw'
import collectionsSource from './lib/collections.ts?raw'
import demoSource from './lib/demo.ts?raw'
import labelsSource from './lib/labels.ts?raw'
import runSource from './lib/run.ts?raw'
import textSource from './lib/text.ts?raw'
import workResultSource from './lib/workResult.ts?raw'

const source = [
  appSource,
  caseAnalysisSource,
  comparisonDialogSource,
  dataManagementPageSource,
  homeSectionsSource,
  personalCollectionsPageSource,
  researchComposerSource,
  sharePanelSource,
  sourceInspectorSource,
  stylePanelSource,
  visualInspirationBoardSource,
  browserReadinessSource,
  backupSource,
  collectionsSource,
  demoSource,
  labelsSource,
  runSource,
  textSource,
  workResultSource,
].join('\n')

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
      '正在打包',
      '换电脑或重装之前',
      '在新电脑上，或者出事之后',
      '这一页做两件事',
      // Retired after the second pilot: the interface now uses one set of
      // research-depth names and keeps implementation/audit language internal.
      '查看上次结果',
      '初步依据',
      '初步灵感',
      '证据方向',
      '综合方法',
      '策略矩阵',
      '未读取图片像素',
      '连续检索',
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
