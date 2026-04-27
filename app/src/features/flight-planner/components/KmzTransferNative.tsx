import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, RefreshCw, Smartphone, TriangleAlert } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Button, DialogPanel } from '@/components/ui'
import { useDjiMissions } from '@/hooks/useDjiMissions'
import type { DjiMissionApp, DjiMissionListItem } from '@/native/djiMission'

type SendPhase = 'idle' | 'sending' | 'success' | 'error'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  buildKmzArrayBuffer: () => Promise<ArrayBuffer>
}

async function successHaptic() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* ignore */
  }
}

export function KmzTransferNative(props: Props) {
  if (!props.open) return null
  return <KmzTransferNativeInner {...props} />
}

function KmzTransferNativeInner({
  open,
  onOpenChange,
  buildKmzArrayBuffer,
}: Props) {
  const { requestPermission, refreshPermission, listMissions, pushKmzToController } =
    useDjiMissions()

  const [granted, setGranted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [missions, setMissions] = useState<DjiMissionListItem[]>([])
  const [targetApp, setTargetApp] = useState<DjiMissionApp>('fly')
  const [selectedName, setSelectedName] = useState('')
  const [sendPhase, setSendPhase] = useState<SendPhase>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const syncState = useCallback(async () => {
    setLoading(true)
    try {
      const ok = await refreshPermission()
      setGranted(ok)
      if (ok) {
        const list = await listMissions()
        setMissions(list)
      } else {
        setMissions([])
      }
    } finally {
      setLoading(false)
    }
  }, [listMissions, refreshPermission])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSendPhase('idle')
      setSendError(null)
    }
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = window.setTimeout(() => {
      if (!cancelled) void syncState()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, syncState])

  const onRequestAccess = async () => {
    setLoading(true)
    try {
      const ok = await requestPermission()
      setGranted(ok)
      if (ok) {
        setMissions(await listMissions())
      }
    } finally {
      setLoading(false)
    }
  }

  const missionsForApp = missions.filter((m) => m.app === targetApp)

  const uuidForPush = (() => {
    if (!selectedName) return undefined
    return selectedName.replace(/\.kmz$/i, '')
  })()

  const sendToController = async () => {
    setSendPhase('sending')
    setSendError(null)
    try {
      const buf = await buildKmzArrayBuffer()
      const res = await pushKmzToController(buf, {
        uuid: uuidForPush,
        app: targetApp,
      })
      if (res.ok) {
        setSendPhase('success')
        void successHaptic()
        window.setTimeout(() => {
          setSendPhase('idle')
        }, 3200)
      } else {
        setSendPhase('error')
        setSendError(res.message)
      }
    } catch (e) {
      setSendPhase('error')
      setSendError(e instanceof Error ? e.message : 'Falha ao gerar ou enviar o KMZ.')
    }
  }

  return (
    <DialogPanel open={open} onOpenChange={handleOpenChange} title="Enviar missão (Android)">
      <div className="space-y-4 text-sm text-neutral-300">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-neutral-400">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-primary-400/90" aria-hidden />
          Grava o KMZ na pasta de waypoint do DJI Fly ou DJI Pilot 2. Requer permissão «Acesso a
          todos os ficheiros» no Android 11+.
        </p>

        {!granted ? (
          <div className="space-y-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="flex gap-2 text-amber-200/90">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <div className="space-y-1 text-xs leading-relaxed">
                <p className="font-medium text-amber-100/95">Permissão necessária</p>
                <p className="text-amber-100/75">
                  Abra as definições do sistema, conceda «Acesso a todos os ficheiros» a esta app e
                  volte aqui. Depois confirme com «Atualizar».
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading} onClick={() => void onRequestAccess()}>
                Abrir definições
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => void syncState()}
              >
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
                Atualizar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-neutral-400">
                Destino
                <select
                  className="input-base h-10"
                  value={targetApp}
                  onChange={(e) => {
                    setTargetApp(e.target.value as DjiMissionApp)
                    setSelectedName('')
                  }}
                >
                  <option value="fly">DJI Fly (dji.go.v5)</option>
                  <option value="pilot2">DJI Pilot 2 (dji.pilot2)</option>
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                disabled={loading}
                onClick={() => void syncState()}
              >
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
                Atualizar lista
              </Button>
            </div>

            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              Missão existente (opcional)
              <select
                className="input-base h-10"
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
              >
                <option value="">Criar nova missão (novo ficheiro .kmz)</option>
                {missionsForApp.map((m) => (
                  <option key={m.path} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative min-h-[4.5rem]">
              <AnimatePresence mode="wait">
                {sendPhase === 'success' ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-4 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                    >
                      <Check className="size-10 text-emerald-400" strokeWidth={2.5} />
                    </motion.div>
                    <p className="text-sm font-medium text-emerald-100/95">KMZ gravado com sucesso</p>
                    <p className="max-w-sm px-3 text-xs text-emerald-100/70">
                      Abra o DJI {targetApp === 'fly' ? 'Fly' : 'Pilot 2'} para confirmar a missão na
                      lista de waypoints.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <Button
                      type="button"
                      className="w-full"
                      disabled={sendPhase === 'sending'}
                      onClick={() => void sendToController()}
                    >
                      {sendPhase === 'sending' ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          A enviar…
                        </span>
                      ) : (
                        `Enviar para DJI ${targetApp === 'fly' ? 'Fly' : 'Pilot 2'}`
                      )}
                    </Button>
                    {sendPhase === 'error' && sendError ? (
                      <p className="text-center text-xs text-red-400">{sendError}</p>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </DialogPanel>
  )
}
