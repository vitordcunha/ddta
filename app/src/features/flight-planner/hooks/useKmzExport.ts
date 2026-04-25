import { useState } from 'react'
import { generateKmz, type KmzVariant } from '@/features/flight-planner/utils/kmzBuilder'
import type { FlightParams, Waypoint } from '@/features/flight-planner/types'

type ExportStatus = 'idle' | 'generating' | 'done' | 'error'

export type KmzExportOptions = {
  variant?: KmzVariant
}

export function useKmzExport(projectName: string) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [kmzBlob, setKmzBlob] = useState<Blob | null>(null)

  const generateAndDownload = async (
    waypoints: Waypoint[],
    params: FlightParams,
    options?: KmzExportOptions,
  ) => {
    try {
      setStatus('generating')
      const variant = options?.variant
      const blob = await generateKmz(waypoints, { projectName, params, variant })
      setKmzBlob(blob)

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const slug = projectName.replaceAll(/\s+/g, '-').toLowerCase()
      anchor.download =
        variant === 'calibration' ? `${slug}-calibration.kmz` : `${slug}-flight-plan.kmz`
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
