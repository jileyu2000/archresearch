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
})
