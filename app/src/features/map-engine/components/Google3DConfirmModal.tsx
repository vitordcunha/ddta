import * as Dialog from '@radix-ui/react-dialog'
import { Building2, Map } from 'lucide-react'
import { cn } from '@/lib/utils'

type Google3DConfirmModalProps = {
  open: boolean
  currentPreference: 'immersive' | 'classic' | null
  onSelectImmersive: () => void
  onSelectClassic: () => void
}

/**
 * Modal de confirmação exibido sempre que o usuário ativa o modo 3D no Google Maps.
 * Permite escolher entre modelos 3D fotorrealísticos (Map3DElement) ou modo clássico (tilt 45°).
 * Destaca a escolha anterior quando houver.
 */
export function Google3DConfirmModal({
  open,
  currentPreference,
  onSelectImmersive,
  onSelectClassic,
}: Google3DConfirmModalProps) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-[201] w-full max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <Dialog.Title className="text-sm font-semibold text-white">
            Modo 3D — Google Maps
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-xs leading-relaxed text-neutral-400">
            Escolha como ativar o modo 3D. Modelos fotorrealísticos incluem prédios,
            árvores e terreno detalhado, mas exigem mais processamento gráfico.
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onSelectImmersive}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3.5',
                'text-left transition',
                currentPreference === 'immersive'
                  ? 'border-primary-500/50 bg-primary-500/10 ring-1 ring-primary-500/30'
                  : 'border-white/10 bg-white/[0.04] hover:border-primary-500/40 hover:bg-white/[0.08]',
              )}
            >
              <Building2
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  currentPreference === 'immersive' ? 'text-primary-400' : 'text-neutral-400',
                )}
                aria-hidden
              />
              <div>
                <p className="text-xs font-semibold text-white">
                  Modelos 3D fotorrealísticos
                  {currentPreference === 'immersive' ? (
                    <span className="ml-2 text-[10px] font-medium text-primary-400">ativo</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  Prédios, árvores e terreno detalhado via Google Maps 3D
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={onSelectClassic}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3.5',
                'text-left transition',
                currentPreference === 'classic'
                  ? 'border-white/25 bg-white/[0.07] ring-1 ring-white/15'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.08]',
              )}
            >
              <Map
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  currentPreference === 'classic' ? 'text-neutral-300' : 'text-neutral-400',
                )}
                aria-hidden
              />
              <div>
                <p className="text-xs font-semibold text-white">
                  Modo clássico
                  {currentPreference === 'classic' ? (
                    <span className="ml-2 text-[10px] font-medium text-neutral-400">ativo</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
                  Perspectiva 3D com satélite, sem modelos detalhados
                </p>
              </div>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
