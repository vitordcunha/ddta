import { Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { FileQueueItem } from '@/features/upload/types/upload'
import { formatBytes } from '@/features/upload/utils/uploadHelpers'

interface FileListItemProps {
  item: FileQueueItem
  onRemove: (id: string) => void
}

export function FileListItem({ item, onRemove }: FileListItemProps) {
  const gpsBadge = (() => {
    if (item.hasGps === null) {
      return (
        <Badge variant="info" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Lendo GPS
        </Badge>
      )
    }
    if (item.hasGps) return <Badge variant="success">GPS ✓</Badge>
    return <Badge variant="error">Sem GPS</Badge>
  })()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">IMG</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-100">{item.file.name}</p>
            <p className="text-xs text-neutral-400">
              {item.serverImageId && item.file.size === 0 ? 'Ja armazenada no servidor' : formatBytes(item.file.size)}
            </p>
          </div>
          {gpsBadge}
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-150"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-200 disabled:opacity-40"
        onClick={() => onRemove(item.id)}
        disabled={item.status === 'uploading'}
        aria-label={`Remover ${item.file.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
