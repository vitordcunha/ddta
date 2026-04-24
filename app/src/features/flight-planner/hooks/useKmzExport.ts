import { useState } from 'react'
import { generateKmz } from '@/features/flight-planner/utils/kmzBuilder'
import type { FlightParams, Waypoint } from '@/features/flight-planner/types'

type ExportStatus = 'idle' | 'generating' | 'done' | 'error'

export function useKmzExport(projectName: string) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [kmzBlob, setKmzBlob] = useState<Blob | null>(null)

  const generateAndDownload = async (waypoints: Waypoint[], params: FlightParams) => {
    try {
      setStatus('generating')
      const blob = await generateKmz(waypoints, { projectName, params })
      setKmzBlob(blob)

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${projectName.replaceAll(/\s+/g, '-').toLowerCase()}-flight-plan.kmz`
      anchor.click()
      URL.revokeObjectURL(url)

      setStatus('done')
      window.setTimeout(() => setStatus('idle'), 1800)
    } catch {
      setStatus('error')
    }
  }

  return { status, kmzBlob, generateAndDownload }
}
