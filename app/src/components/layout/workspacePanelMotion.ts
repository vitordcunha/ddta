import type { Transition, Variants } from "framer-motion";

/** Painel do workspace: spring mais amortecido = menos oscilação e menos trabalho por frame. */
export const WORKSPACE_PANEL_SPRING: Transition = {
  type: "spring",
  damping: 38,
  stiffness: 280,
};

const WORKSPACE_PANEL_TWEEN: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

export function workspacePanelTransition(
  prefersReducedMotion: boolean | null,
): Transition {
  if (prefersReducedMotion) {
    return { duration: 0.15, ease: "linear" };
  }
  return WORKSPACE_PANEL_SPRING;
}

export function workspacePanelFabTransition(
  prefersReducedMotion: boolean | null,
): Transition {
  if (prefersReducedMotion) {
    return { duration: 0.12, ease: "linear" };
  }
  return WORKSPACE_PANEL_TWEEN;
}

export const desktopPanelSlide: Variants = {
  initial: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { x: "102%", opacity: 1 },
  animate: (reduced: boolean) =>
    reduced ? { opacity: 1 } : { x: 0, opacity: 1 },
  exit: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { x: "102%", opacity: 1 },
};

export const desktopFabSlide: Variants = {
  initial: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { x: 20, opacity: 0 },
  animate: (reduced: boolean) =>
    reduced ? { opacity: 1 } : { x: 0, opacity: 1 },
  exit: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { x: 12, opacity: 0 },
};

export const mobileSheetSlide: Variants = {
  initial: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { y: "105%", opacity: 1 },
  animate: (reduced: boolean) =>
    reduced ? { opacity: 1 } : { y: 0, opacity: 1 },
  exit: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { y: "105%", opacity: 1 },
};

export const mobileCollapsedBarSlide: Variants = {
  initial: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { y: 16, opacity: 0 },
  animate: (reduced: boolean) =>
    reduced ? { opacity: 1 } : { y: 0, opacity: 1 },
  exit: (reduced: boolean) =>
    reduced ? { opacity: 0 } : { y: 10, opacity: 0 },
};
