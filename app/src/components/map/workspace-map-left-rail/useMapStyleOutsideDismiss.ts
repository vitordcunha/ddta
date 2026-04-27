import { useEffect, type RefObject } from "react";

export function useMapStyleOutsideDismiss(
  mapStyleRef: RefObject<HTMLDivElement | null>,
  setMapStyleOpen: (open: boolean) => void,
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        mapStyleRef.current &&
        !mapStyleRef.current.contains(e.target as Node)
      ) {
        setMapStyleOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMapStyleOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [mapStyleRef, setMapStyleOpen]);
}
