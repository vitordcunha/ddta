import type { CompletedProjectStats } from '@/features/results/types'

export function extractCompletedStats(
  raw: Record<string, unknown> | null | undefined,
): CompletedProjectStats | null {
  if (!raw) return null
  const n = (k: string) => (typeof raw[k] === 'number' ? (raw[k] as number) : null)
  const gsd = n('gsd_cm_px') ?? n('gsdCmPx')
  const area = n('area_ha') ?? n('areaHa')
  const images = n('image_count') ?? n('imageCount')
  const points = n('point_count') ?? n('pointCount')
  const orthoRes = n('orthophoto_resolution_cm_px') ?? n('orthophotoResolutionCmPx')
  const time = n('processing_time_minutes') ?? n('processingTimeMinutes')
  if (gsd == null && area == null && images == null) return null
  return {
    gsdCmPx: gsd ?? 0,
    areaHa: area ?? 0,
    imageCount: images ?? 0,
    pointCount: points ?? 0,
    orthophotoResolutionCmPx: orthoRes ?? 0,
    processingTimeMinutes: time ?? 0,
  }
}
