import { describe, expect, it } from 'vitest'

import styles from './styles.css?raw'

describe('responsive design-system rules', () => {
  it('keeps tablet header and card actions at touch size', () => {
    const tabletStart = styles.indexOf('@media (max-width: 860px)')
    const mobileStart = styles.indexOf('@media (max-width: 620px)')
    const tabletRules = styles.slice(tabletStart, mobileStart)

    expect(tabletRules).toMatch(/\.app-header button,[\s\S]*?min-height:\s*44px/)
    expect(tabletRules).toMatch(/\.reference-actions button[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?opacity:\s*1/)
  })
})
