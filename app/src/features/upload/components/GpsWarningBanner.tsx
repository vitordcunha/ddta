import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { FileQueueItem } from '@/features/upload/types/upload'

interface GpsWarningBannerProps {
  files: FileQueueItem[]
}

export function GpsWarningBanner({ files }: GpsWarningBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const withoutGps = useMemo(() => files.filter((file) => file.hasGps === false), [files])
  if (!files.length) return null

  const percentage = withoutGps.length / files.length
  if (percentage <= 0.1) return null

  return (
    <div className="rounded-xl border border-warning-500/40 bg-warning-500/10 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning-300" />
          <p className="text-sm text-warning-100">
            {withoutGps.length} imagens sem metadados GPS - o processamento pode falhar.
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-warning-200" /> : <ChevronDown className="h-4 w-4 text-warning-200" />}
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-warning-500/30 pt-3 text-sm text-warning-100">
          <p className="mb-2 font-medium">Arquivos sem GPS</p>
          <ul className="mb-3 max-h-32 space-y-1 overflow-auto text-warning-200">
            {withoutGps.map((file) => (
              <li key={file.id} className="truncate">
                {file.file.name}
              </li>
            ))}
          </ul>
          <details className="rounded-md border border-warning-500/30 p-2">
            <summary className="cursor-pointer text-warning-100">Como garantir GPS nas fotos</summary>
            <p className="mt-2 text-xs text-warning-200">
              Ative geolocalizacao na camera/app do drone e mantenha o sincronismo de horario do dispositivo.
            </p>
          </details>
        </div>
      ) : null}
    </div>
  )
}
