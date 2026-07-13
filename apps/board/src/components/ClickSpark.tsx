import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'

type Spark = {
  angle: number
  color: string
  startTime: number
  x: number
  y: number
}

type ClickSparkProps = {
  children: ReactNode
  className?: string
  duration?: number
  sparkColor?: string
  sparkCount?: number
  sparkRadius?: number
  sparkSize?: number
}

/**
 * Adapted from React Bits ClickSpark for task-bound feedback.
 * Source and license: https://github.com/DavidHDev/react-bits
 */
export function ClickSpark({
  children,
  className = '',
  duration = 360,
  sparkColor,
  sparkCount = 6,
  sparkRadius = 18,
  sparkSize = 8,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)
  const sparksRef = useRef<Spark[]>([])
  const [motionEnabled, setMotionEnabled] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setMotionEnabled(!media.matches)
    media.addEventListener('change', updateMotion)
    return () => media.removeEventListener('change', updateMotion)
  }, [])

  useEffect(() => {
    if (!motionEnabled) {
      sparksRef.current = []
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      return
    }

    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const resizeCanvas = () => {
      const { width, height } = parent.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
    }
    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(parent)
    resizeCanvas()

    return () => observer.disconnect()
  }, [motionEnabled])

  function drawFrame(timestamp: number) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      frameRef.current = null
      return
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    sparksRef.current = sparksRef.current.filter((spark) => {
      const progress = Math.min(1, (timestamp - spark.startTime) / duration)
      if (progress >= 1) return false

      const eased = progress * (2 - progress)
      const distance = eased * sparkRadius
      const lineLength = sparkSize * (1 - eased)
      const x1 = spark.x + distance * Math.cos(spark.angle)
      const y1 = spark.y + distance * Math.sin(spark.angle)
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle)
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle)

      context.strokeStyle = spark.color
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(x1, y1)
      context.lineTo(x2, y2)
      context.stroke()
      return true
    })

    frameRef.current = sparksRef.current.length > 0 ? requestAnimationFrame(drawFrame) : null
  }

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    if (
      !motionEnabled
      || event.button !== 0
      || event.detail === 0
      || !(target instanceof Element)
      || !target.closest('button, a[href], [role="button"]')
    ) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const startTime = performance.now()
    const color = sparkColor ?? getComputedStyle(canvas).color
    sparksRef.current.push(...Array.from({ length: sparkCount }, (_, index) => ({
      angle: (Math.PI * 2 * index) / sparkCount,
      color,
      startTime,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })))
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(drawFrame)
  }

  return (
    <div className={`click-spark ${className}`.trim()} onClick={handleClick}>
      {motionEnabled && <canvas ref={canvasRef} className="click-spark-canvas" aria-hidden="true" />}
      {children}
    </div>
  )
}
