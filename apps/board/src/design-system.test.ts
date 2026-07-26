import { describe, expect, it } from 'vitest'

import styles from './styles.css?raw'

describe('responsive design-system rules', () => {
  it('gives the primary research prompt more vertical working space', () => {
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const tabletRules = styles.slice(tabletStart, mobileStart)
    const mobileRules = styles.slice(mobileStart)

    expect(styles).toMatch(/--research-prompt-min-height:\s*152px/)
    expect(styles).toMatch(/\.research-prompt textarea[\s\S]*?min-height:\s*var\(--research-prompt-min-height\)/)
    expect(tabletRules).toMatch(/--research-prompt-min-height:\s*132px/)
    expect(mobileRules).toMatch(/--research-prompt-min-height:\s*108px/)
  })

  it('keeps tablet header and card actions at touch size', () => {
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const tabletRules = styles.slice(tabletStart, mobileStart)

    expect(tabletRules).toMatch(/\.app-header button,[\s\S]*?min-height:\s*44px/)
    expect(tabletRules).toMatch(/\.reference-actions button[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?opacity:\s*1/)
  })

  it('keeps source-inspector controls at touch size on compact screens', () => {
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const tabletRules = styles.slice(tabletStart, mobileStart)

    expect(tabletRules).toMatch(
      /\.inspector-heading button,\s*\.inspector-preview-pane \.source-link,\s*\.inspector-actions button\s*\{\s*min-height:\s*44px;\s*\}/,
    )
  })

  it('keeps optional research inputs at touch size on compact screens', () => {
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const tabletRules = styles.slice(tabletStart, mobileStart)

    expect(tabletRules).toMatch(/\.research-options input\s*\{\s*min-height:\s*44px/)
  })

  it('keeps inline history retention actions at touch size on mobile', () => {
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const mobileRules = styles.slice(mobileStart)

    expect(mobileRules).toMatch(
      /\.retention-control button\s*\{\s*min-height:\s*44px/,
    )
  })

  it('keeps the architectural result filter at touch size on mobile', () => {
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const mobileRules = styles.slice(mobileStart)

    expect(mobileRules).toMatch(/#asset-filter\s*\{\s*min-height:\s*44px/)
  })

  it('keeps recent research compact while every record remains in one scrollable list', () => {
    expect(styles).toMatch(
      /\.recent-panel > header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s,
    )
    expect(styles).toMatch(
      /\.recent-history\s*\{[^}]*max-height:\s*min\(320px,\s*45dvh\)[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s,
    )
  })

  it('uses readable text-image result layouts and returns them to one column on compact screens', () => {
    const compactStart = styles.indexOf('@media (max-width: 1180px)')
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const compactRules = styles.slice(compactStart, tabletStart)
    const tabletRules = styles.slice(tabletStart, mobileStart)
    const mobileRules = styles.slice(mobileStart)

    expect(styles).toMatch(
      /\.collection-case-layout\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.05fr\) minmax\(360px, 0\.95fr\)/,
    )
    expect(styles).toMatch(
      /\.case-answer-layout\[data-has-image="true"\]\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(280px, 0\.42fr\)/,
    )
    expect(compactRules).toMatch(
      /\.collection-case-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/,
    )
    expect(tabletRules).toMatch(
      /\.case-answer-layout\[data-has-image="true"\]\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/,
    )
    expect(mobileRules).toMatch(
      /\.collection-case-image-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    )
  })

  it('uses one dominant recognition image while leaving drawing collections unchanged', () => {
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const mobileRules = styles.slice(mobileStart)

    expect(styles).toMatch(
      /\.collection-case-image-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    )
    expect(styles).toMatch(
      /\.collection-case-image:first-child\s*\{\s*grid-column:\s*1 \/ -1/,
    )
    expect(styles).toMatch(
      /\.collection-visual-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill, minmax\(340px, 1fr\)\)/,
    )
    expect(mobileRules).toMatch(
      /\.collection-case-image:first-child\s*\{\s*grid-column:\s*1 \/ -1/,
    )
    expect(mobileRules).toMatch(
      /\.collection-visual-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/,
    )
  })

  it('runs results and collections through one centered document column', () => {
    expect(styles).toMatch(/--layout-doc-max:\s*1180px/)
    const documentRule = styles.match(
      /\.result-task-heading,[^{]*\{[^}]*max-width:\s*var\(--layout-doc-max\);[^}]*margin-inline:\s*auto;[^}]*\}/,
    )
    expect(documentRule).not.toBeNull()
    const selectors = documentRule?.[0].slice(0, documentRule[0].indexOf('{')) ?? ''
    for (const selector of [
      '.result-task-heading',
      '.research-synthesis',
      '.case-analysis > .results-header',
      '.case-chapter',
      '.collection-page > .panel-heading',
      '.collection-architecture',
      '.collection-question-directory',
    ]) {
      expect(selectors).toContain(selector)
    }
    expect(styles).not.toMatch(/\.case-chapter\s*\{[^}]*max-width:\s*1180px/)
    expect(styles).not.toMatch(/\.collection-architecture\s*\{[^}]*max-width:\s*1180px/)
    expect(styles).not.toMatch(/\.result-task-heading\s*\{[^}]*max-width:\s*1100px/)
  })

  it('caps every conclusion block at a reading measure', () => {
    expect(styles).toMatch(/\.synthesis-primary li\s*\{[^}]*max-width:\s*64ch/)
    expect(styles).toMatch(/\.synthesis-boundary\s*\{[^}]*max-width:\s*64ch/)
    expect(styles).toMatch(/\.collection-question-heading h2\s*\{[^}]*max-width:\s*40ch/)
    expect(styles).toMatch(/\.collection-case-heading h4\s*\{[^}]*max-width:\s*40ch/)
    expect(styles).toMatch(/\.case-answer-heading h4\s*\{[^}]*max-width:\s*40ch/)
  })

  it('runs every animation through the shared motion tokens', () => {
    const animationDeclarations = [...styles.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1])
    expect(animationDeclarations.length).toBeGreaterThanOrEqual(5)
    for (const declaration of animationDeclarations) {
      expect(declaration, `animation "${declaration}" must use duration tokens`).toMatch(/var\(--duration-/)
      expect(declaration, `animation "${declaration}" must use easing tokens`).toMatch(/var\(--ease-/)
    }
    expect(styles).toMatch(/@keyframes\s+sheet-settle/)
    expect(styles).toMatch(/@keyframes\s+dock-rise/)
    expect(styles).toMatch(/@keyframes\s+saved-dot-in/)
    expect(styles).toMatch(/prefers-reduced-motion/)
  })

  it('disables directional chevron nudges under reduced motion', () => {
    const reduced = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduced).toMatch(/\.collection-directory-list button:hover svg[\s\S]{0,240}?transform:\s*none/)
  })

  it('fades the provenance underline in instead of snapping it', () => {
    expect(styles).toMatch(/\.case-answer-source,\s*\.collection-case-source\s*\{[^}]*text-decoration-color:\s*transparent/)
  })

  it('caps the recent-row status column so long statuses wrap instead of crushing the title', () => {
    expect(styles).toMatch(
      /\.recent-open\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) fit-content\(40%\) var\(--icon-sm\)/,
    )
  })

  it('lets imageless case answers use the full reading measure', () => {
    expect(styles).toMatch(
      /\.case-answer-layout:not\(\[data-has-image="true"\]\) \.case-answer-mechanism[^{]*\{[^}]*max-width:\s*72ch/,
    )
    expect(styles).toMatch(/\.case-chapter-heading h3\s*\{[^}]*max-width:\s*64ch/)
  })

  it('stacks applicability labels above their text at body size', () => {
    expect(styles).not.toMatch(/\.synthesis-boundary\s*\{[^}]*grid-template-columns/)
    expect(styles).not.toMatch(/\.case-answer-boundary\s*\{[^}]*grid-template-columns/)
    expect(styles).not.toMatch(/\.collection-case-boundary\s*\{[^}]*grid-template-columns/)
    expect(styles).toMatch(
      /\.synthesis-boundary strong,\s*\.case-answer-boundary strong,\s*\.collection-case-boundary strong\s*\{[^}]*display:\s*block/,
    )
    expect(styles).toMatch(/\.synthesis-boundary\s*\{[^}]*font-size:\s*var\(--font-base\)/)
    expect(styles).toMatch(/\.case-answer-boundary\s*\{[^}]*font-size:\s*var\(--font-base\)/)
    expect(styles).toMatch(
      /\.collection-case-boundary\s*\{[^}]*font-size:\s*var\(--font-base\)/,
    )
  })
})
