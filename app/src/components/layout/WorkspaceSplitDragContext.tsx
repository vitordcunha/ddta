import { createContext, useContext } from "react";

/**
 * Ref toggled during split-handle drag so heavy consumers (e.g. Leaflet
 * `ResizeObserver` → `invalidateSize`) can skip work until pointerup.
 */
export const WorkspaceSplitDragActiveRefContext =
  createContext<React.MutableRefObject<boolean> | null>(null);

export function useWorkspaceSplitDragActiveRef() {
  return useContext(WorkspaceSplitDragActiveRefContext);
}
