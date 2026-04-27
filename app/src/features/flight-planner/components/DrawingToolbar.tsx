import { maybeBackdropBlur, useDeviceTier } from '@/lib/deviceUtils'
import { cn } from '@/lib/utils'

export interface DrawingToolbarProps {
  visible: boolean
  canUndo: boolean
  canComplete: boolean
  onUndo: () => void
  onCancel: () => void
  onComplete: () => void
}

export function DrawingToolbar({
  visible,
  canUndo,
  canComplete,
  onUndo,
  onCancel,
  onComplete,
}: DrawingToolbarProps) {
  const deviceTier = useDeviceTier()
  if (!visible) return null

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(26,26,26,0.97)] px-3 py-2 shadow-xl',
        maybeBackdropBlur(deviceTier, 'md'),
      )}
      style={{
        position: 'fixed',
        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 55,
      }}
    >
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition',
          'border border-white/10 bg-white/5 text-[#fafafa]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'enabled:hover:bg-white/10',
        )}
        title="Desfazer último vértice"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        Desfazer
      </button>

      <button
        type="button"
        onClick={onCancel}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition',
          'border border-red-500/30 bg-red-500/10 text-red-400',
          'hover:bg-red-500/20',
        )}
        title="Cancelar desenho"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        Cancelar
      </button>

      <button
        type="button"
        disabled={!canComplete}
        onClick={onComplete}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition',
          'border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 text-[#3ecf8e]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'enabled:hover:bg-[#3ecf8e]/20',
        )}
        title="Concluir polígono (mínimo 3 vértices)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Concluir
      </button>
    </div>
  )
}
