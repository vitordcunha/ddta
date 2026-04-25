import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { http } from '@/services/http'
import type {
  CalibrationGridSlot,
  CalibrationImageSummary,
  CalibrationSlotReport,
} from '@/services/projectsService'

function fmtExif(exif: Record<string, unknown>, key: string): string {
  const v = exif[key]
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
  return String(v)
}

export type CalibrationSlotInspectorProps = {
  sessionId: string
  slot: CalibrationGridSlot
  slotReport?: CalibrationSlotReport
  images: CalibrationImageSummary[]
  onClose: () => void
}

/**
 * Painel lateral ao clicar num slot: miniatura, carrossel de fotos do slot, métricas.
 */
export function CalibrationSlotInspector({
  sessionId,
  slot,
  slotReport,
  images,
  onClose,
}: CalibrationSlotInspectorProps) {
  const inSlot = useMemo(
    () => images.filter((im) => im.primary_slot_id === slot.id),
    [images, slot.id],
  )
  const [idx, setIdx] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    setIdx(0)
  }, [slot.id])

  const current = inSlot[idx] ?? null

  useEffect(() => {
    if (!current) {
      setBlobUrl(null)
      return
    }
    let cancelled = false
    const path = `/calibration-sessions/${sessionId}/images/${current.id}/thumbnail`
    void http
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, current?.id])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  const primaryId = slot.primary_image_id ?? slotReport?.best_image_id ?? null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-neutral-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-100">Slot {slot.row},{slot.col}</p>
          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{slot.id}</p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Fechar painel"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>

      {blobUrl ? (
        <img src={blobUrl} alt="" className="mx-auto max-h-36 w-full rounded-md object-contain" />
      ) : (
        <p className="text-center text-neutral-500">Sem miniatura</p>
      )}

      {inSlot.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={idx <= 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-[11px] text-neutral-500">
            {idx + 1} / {inSlot.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={idx >= inSlot.length - 1}
            onClick={() => setIdx((i) => Math.min(inSlot.length - 1, i + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-neutral-500">Estado</dt>
        <dd>{slot.status}</dd>
        {slotReport?.best_score != null ? (
          <>
            <dt className="text-neutral-500">Score</dt>
            <dd>{slotReport.best_score}</dd>
          </>
        ) : null}
        {slotReport?.blur_score != null ? (
          <>
            <dt className="text-neutral-500">Nitidez (Lap.)</dt>
            <dd>{slotReport.blur_score}</dd>
          </>
        ) : null}
        {slotReport?.clipping_ratio != null ? (
          <>
            <dt className="text-neutral-500">Clipping</dt>
            <dd>{(slotReport.clipping_ratio * 100).toFixed(2)}%</dd>
          </>
        ) : null}
        <dt className="text-neutral-500">Primária (GPS)</dt>
        <dd className="truncate font-mono text-[10px]">{primaryId ?? '—'}</dd>
        {current ? (
          <>
            <dt className="text-neutral-500">Ficheiro</dt>
            <dd className="truncate">{current.filename}</dd>
            <dt className="text-neutral-500">ISO</dt>
            <dd>{fmtExif(current.exif, 'iso')}</dd>
            <dt className="text-neutral-500">Obturador</dt>
            <dd>{fmtExif(current.exif, 'exposure_time_s')} s</dd>
            <dt className="text-neutral-500">f</dt>
            <dd>{fmtExif(current.exif, 'f_number')}</dd>
          </>
        ) : null}
      </dl>
    </div>
  )
}
