import { useEffect, useRef } from 'react'
import { projectsService } from '@/services/projectsService'
import type { MapBounds } from '@/features/results/stores/useResultsViewStore'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'

/**
 * Fetches the project bounding box from the backend and stores it in
 * useResultsViewStore so the map can auto-fit.
 *
 * Triggers:
 *  - On mount / projectId change (uses flight_area or image GPS while processing)
 *  - Whenever `assetVersion` changes (pass a new value when preview or full assets arrive)
 */
export function useMapAutoBounds(projectId: string, assetVersion: number) {
  const setAutoFitBounds = useResultsViewStore((s) => s.setAutoFitBounds)
  const lastProjectId = useRef<string | null>(null)
  const lastAssetVersion = useRef<number>(-1)

  useEffect(() => {
    const projectChanged = projectId !== lastProjectId.current
    const assetsUpdated = assetVersion !== lastAssetVersion.current

    if (!projectChanged && !assetsUpdated) return
    if (!projectId) return

    lastProjectId.current = projectId
    lastAssetVersion.current = assetVersion

    void projectsService.getProjectBounds(projectId).then((bounds) => {
      if (!bounds) return
      const leafletBounds: MapBounds = [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]
      setAutoFitBounds(leafletBounds)
    })
  }, [projectId, assetVersion, setAutoFitBounds])

  // Clear bounds when switching projects
  useEffect(() => {
    return () => {
      setAutoFitBounds(null)
    }
  }, [projectId, setAutoFitBounds])
}
