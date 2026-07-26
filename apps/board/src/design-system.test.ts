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
})
