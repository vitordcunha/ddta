import { useEffect, useRef, useState } from "react"
import { motion } from "@/lib/motionTokens"

/**
 * Interpolates `value` from its previous value over `duration` ms.
 * Animation only triggers when the change is > 5% of the previous value
 * (avoids animating floating-point noise).
 */
export function useAnimatedNumber(
  value: number,
  options?: { duration?: number },
): number {
  const duration = options?.duration ?? motion.duration.base
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)
  const prevTargetRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const prev = prevTargetRef.current
    prevTargetRef.current = value

    const diff = Math.abs(value - prev)
    const threshold = Math.abs(prev) * 0.05

    if (diff <= threshold) {
      displayedRef.current = value
      setDisplayed(value)
      return
    }

    const from = displayedRef.current
    const to = value
    let startTime: number | null = null

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const t = Math.min((timestamp - startTime) / duration, 1)
      const cur = from + (to - from) * t
      displayedRef.current = cur
      setDisplayed(cur)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [value, duration])

  return displayed
}
