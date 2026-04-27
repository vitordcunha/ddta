import { lazy } from 'react'

export type { SparseCloudViewerProps } from '@/features/sparse-cloud/components/SparseCloudViewer'

// Lazy-loaded to avoid pulling @deck.gl chunks into the projects page bundle.
export const SparseCloudViewer = lazy(() =>
  import('@/features/sparse-cloud/components/SparseCloudViewer').then((m) => ({
    default: m.SparseCloudViewer,
  })),
)
