import { useEffect, useState } from "react";

function readLandscape(): boolean {
  if (typeof window === "undefined") return false;
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith("landscape");
  }
  return window.innerWidth > window.innerHeight;
}

/**
 * Landscape confiável para layout (resize + orientationchange + Screen Orientation API).
 */
export function useLandscapeOrientation(): boolean {
  const [landscape, setLandscape] = useState(readLandscape);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const sync = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        setLandscape(readLandscape());
      }, 50);
    };
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const so = window.screen?.orientation;
    so?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      so?.removeEventListener?.("change", sync);
      if (t) clearTimeout(t);
    };
  }, []);

  return landscape;
}
