export const motion = {
  duration: {
    instant: 0,
    micro: 80,
    fast: 160,
    base: 240,
    slow: 380,
    enter: 480,
    route: 920,
    /** Leaflet strip draw-reveal (plan path). */
    strip: 520,
    stripStaggerTotal: 420,
    stripStaggerMin: 28,
    stripFadeOut: 210,
    sweepStart: 600,
    sweepDraw: 560,
    sweepHold: 120,
    sweepFade: 380,
  },
  easing: {
    standard: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
    accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    spring: { type: "spring" as const, damping: 38, stiffness: 280 },
    cinematic: "cubic-bezier(0.45, 0, 0.55, 1)",
    bounce: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const
