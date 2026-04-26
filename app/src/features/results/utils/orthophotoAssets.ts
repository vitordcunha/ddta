import type { Project, ProjectAssets } from '@/types/project'

export function assetsIncludeOrthophoto(assets: ProjectAssets | null | undefined): boolean {
  if (!assets) return false
  return Object.keys(assets).some((k) => k.toLowerCase().includes('odm_orthophoto.tif'))
}

export function projectHasFullOrthophoto(project: Pick<Project, 'assets'>): boolean {
  return assetsIncludeOrthophoto(project.assets)
}

export function projectIsProcessingLike(project: Pick<Project, 'status'>): boolean {
  const s = project.status
  return s === 'processing' || (s as string) === 'queued'
}
