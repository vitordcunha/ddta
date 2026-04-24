import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { FileQueueItem } from '@/features/upload/types/upload'
import { FileListItem } from '@/features/upload/components/FileListItem'
import { UploadSummaryBar } from '@/features/upload/components/UploadSummaryBar'
import type { FileQueueStats } from '@/features/upload/types/upload'

interface UploadProgressListProps {
  files: FileQueueItem[]
  stats: FileQueueStats
  totalBytes: number
  progress: number
  isUploading: boolean
  isCancelling: boolean
  onRemove: (id: string) => void
  onUploadAll: () => void
  onCancelAll: () => void
}

export function UploadProgressList({
  files,
  stats,
  totalBytes,
  progress,
  isUploading,
  isCancelling,
  onRemove,
  onUploadAll,
  onCancelAll,
}: UploadProgressListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 94,
    overscan: 8,
  })

  return (
    <div className="space-y-3">
      <UploadSummaryBar
        stats={stats}
        totalBytes={totalBytes}
        progress={progress}
        isUploading={isUploading}
        isCancelling={isCancelling}
        onUploadAll={onUploadAll}
        onCancelAll={onCancelAll}
      />

      <div ref={parentRef} className="h-[430px] overflow-auto rounded-xl border border-neutral-800 bg-neutral-900/30 p-3">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = files[virtualRow.index]
            return (
              <div
                key={item.id}
                className="animate-in fade-in slide-in-from-bottom-2 px-1 py-1 duration-200"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <FileListItem item={item} onRemove={onRemove} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
