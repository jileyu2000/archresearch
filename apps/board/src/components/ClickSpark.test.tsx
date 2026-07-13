import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClickSpark } from './ClickSpark'

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

describe('ClickSpark', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setReducedMotion(true)
  })

  it('keeps its content accessible and omits decorative canvas when motion is reduced', () => {
    setReducedMotion(true)

    render(<ClickSpark><button type="button">填入问题</button></ClickSpark>)

    expect(screen.getByRole('button', { name: '填入问题' })).toBeVisible()
    expect(document.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('starts a frame only after a completed interactive click', () => {
    setReducedMotion(false)
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D)
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)

    render(<ClickSpark><button type="button">填入问题</button></ClickSpark>)
    expect(requestFrame).not.toHaveBeenCalled()

    fireEvent.pointerDown(screen.getByRole('button', { name: '填入问题' }), { clientX: 12, clientY: 12 })
    expect(requestFrame).not.toHaveBeenCalled()

    fireEvent.click(document.querySelector('.click-spark') as HTMLElement, {
      clientX: 12,
      clientY: 12,
      detail: 1,
    })
    expect(requestFrame).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '填入问题' }), {
      clientX: 12,
      clientY: 12,
      detail: 1,
    })
    expect(requestFrame).toHaveBeenCalledTimes(1)
  })
})
