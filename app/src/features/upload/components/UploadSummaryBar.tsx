import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FileQueueStats } from '@/features/upload/types/upload'
import { formatBytes } from '@/features/upload/utils/uploadHelpers'

interface UploadSummaryBarProps {
  stats: FileQueueStats
  totalBytes: number
  progress: number
  isUploading: boolean
  isCancelling: boolean
  onUploadAll: () => void
  onCancelAll: () => void
}

export function UploadSummaryBar({
  stats,
  totalBytes,
  progress,
  isUploading,
  isCancelling,
  onUploadAll,
  onCancelAll,
}: UploadSummaryBarProps) {
  const buttonLabel = isUploading ? (isCancelling ? 'Cancelando...' : 'Cancelar upload') : stats.done === stats.total && stats.total > 0 ? 'Concluido ✓' : 'Iniciar upload'

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-neutral-800 bg-neutral-900/95 p-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-200">
          {stats.total} arquivos - {formatBytes(totalBytes)} total - {stats.withGps} com GPS
        </p>
        <Button
          variant={stats.done === stats.total && stats.total > 0 ? 'secondary' : 'primary'}
          size="sm"
          onClick={isUploading ? onCancelAll : onUploadAll}
          disabled={!stats.total || (stats.done === stats.total && !isUploading)}
        >
          {stats.done === stats.total && !isUploading ? <CheckCircle2 className="mr-2 h-4 w-4 text-accent-300" /> : null}
          {buttonLabel}
        </Button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-primary-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
