import { useMediaQuery } from "@/hooks/useMediaQuery"

export type Breakpoint = "mobile" | "tablet" | "desktop"

/** Tablet starts at 768px; desktop at 1280px (iPad Pro landscape stays tablet). */
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1280,
} as const

export function useBreakpoint(): Breakpoint {
  const isDesktop = useMediaQuery(
    `(min-width: ${BREAKPOINTS.desktop}px)`,
  )
  const isTabletUp = useMediaQuery(
    `(min-width: ${BREAKPOINTS.tablet}px)`,
  )
  if (isDesktop) return "desktop"
  if (isTabletUp) return "tablet"
  return "mobile"
}

export function useIsDesktop(): boolean {
  return useBreakpoint() === "desktop"
}

export function useIsTablet(): boolean {
  return useBreakpoint() === "tablet"
}

export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile"
}

/** Layout/gestos touch-first quando não estamos no tier desktop. */
export function useIsTouchPrimary(): boolean {
  const bp = useBreakpoint()
  return bp === "tablet" || bp === "mobile"
}
