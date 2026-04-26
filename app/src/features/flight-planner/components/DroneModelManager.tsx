import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { http } from '@/services/http'
import type { ApiDroneModel, ApiDroneModelCreate } from '@/features/flight-planner/types/droneModelApi'
import { droneModelsQueryKey } from '@/features/flight-planner/hooks/useDroneModelsQuery'
import { useQueryClient } from '@tanstack/react-query'

type Props = {
  open: boolean
  onClose: () => void
  models: ApiDroneModel[]
}

const emptyForm: ApiDroneModelCreate = {
  name: '',
  manufacturer: 'DJI',
  sensor_width_mm: 13.2,
  sensor_height_mm: 8.8,
  focal_length_mm: 8.8,
  image_width_px: 5472,
  image_height_px: 3648,
  max_speed_ms: 15,
  max_altitude_m: 500,
  gimbal_pitch_min: -90,
  gimbal_pitch_max: 30,
}

export function DroneModelManager({ open, onClose, models }: Props) {
  const qc = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState<ApiDroneModelCreate>(emptyForm)
  const defaults = models.filter((m) => !m.is_custom)
  const customs = models.filter((m) => m.is_custom)

  if (!open) return null

  const invalidate = () => void qc.invalidateQueries({ queryKey: droneModelsQueryKey })

  const onCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do modelo.')
      return
    }
    try {
      setBusyId('new')
      await http.post('/drone-models', form)
      toast.success('Modelo criado.')
      setForm(emptyForm)
      await invalidate()
    } catch {
      toast.error('Não foi possível criar o modelo.')
    } finally {
      setBusyId(null)
    }
  }

  const onDelete = async (id: string) => {
    try {
      setBusyId(id)
      await http.delete(`/drone-models/${id}`)
      toast.success('Modelo removido.')
      await invalidate()
    } catch {
      toast.error('Não foi possível remover o modelo.')
    } finally {
      setBusyId(null)
    }
  }

  const onSaveInline = async (m: ApiDroneModel, patch: Partial<ApiDroneModelCreate>) => {
    try {
      setBusyId(m.id)
      await http.put(`/drone-models/${m.id}`, patch)
      toast.success('Modelo atualizado.')
      await invalidate()
    } catch {
      toast.error('Não foi possível salvar.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="drone-model-manager-title"
    >
      <Card className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="drone-model-manager-title" className="text-sm font-semibold text-neutral-100">
            Gerenciar modelos de drone
          </h2>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Modelos padrão são somente leitura. Crie modelos custom para câmeras ou drones não listados.
        </p>

        <section className="mt-4 space-y-2">
          <h3 className="text-xs font-medium text-neutral-300">Modelos padrão</h3>
          <ul className="space-y-1.5 text-[11px] text-neutral-400">
            {defaults.map((m) => (
              <li key={m.id} className="rounded border border-white/10 px-2 py-1.5">
                <span className="font-medium text-neutral-200">{m.name}</span>
                <span className="text-neutral-500"> — {m.manufacturer}</span>
                <div className="mt-0.5 text-neutral-500">
                  Sensor {m.sensor_width_mm}×{m.sensor_height_mm} mm · f {m.focal_length_mm} mm ·{' '}
                  {m.image_width_px}×{m.image_height_px} px · FOV {m.fov_horizontal_deg.toFixed(1)}°×
                  {m.fov_vertical_deg.toFixed(1)}°
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-medium text-neutral-300">Meus modelos</h3>
          {customs.length === 0 ? (
            <p className="text-[11px] text-neutral-500">Nenhum modelo custom ainda.</p>
          ) : (
            <ul className="space-y-2">
              {customs.map((m) => (
                <li key={m.id} className="rounded border border-white/10 p-2">
                  <InlineCustomEditor
                    model={m}
                    busy={busyId === m.id}
                    onSave={(patch) => void onSaveInline(m, patch)}
                    onDelete={() => void onDelete(m.id)}
                    deleteBusy={busyId === m.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 space-y-2 border-t border-white/10 pt-4">
          <h3 className="text-xs font-medium text-neutral-300">Novo modelo custom</h3>
          <div className="grid gap-2 text-[11px]">
            <label className="grid gap-0.5">
              <span className="text-neutral-500">Nome</span>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="grid gap-0.5">
              <span className="text-neutral-500">Fabricante</span>
              <input
                className="input-base"
                value={form.manufacturer}
                onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-0.5">
                <span className="text-neutral-500">Sensor W (mm)</span>
                <input
                  type="number"
                  step="0.01"
                  className="input-base"
                  value={form.sensor_width_mm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sensor_width_mm: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-neutral-500">Sensor H (mm)</span>
                <input
                  type="number"
                  step="0.01"
                  className="input-base"
                  value={form.sensor_height_mm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sensor_height_mm: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-0.5">
              <span className="text-neutral-500">Distância focal (mm)</span>
              <input
                type="number"
                step="0.01"
                className="input-base"
                value={form.focal_length_mm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, focal_length_mm: Number(e.target.value) }))
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-0.5">
                <span className="text-neutral-500">Largura (px)</span>
                <input
                  type="number"
                  className="input-base"
                  value={form.image_width_px}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, image_width_px: Math.round(Number(e.target.value)) }))
                  }
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-neutral-500">Altura (px)</span>
                <input
                  type="number"
                  className="input-base"
                  value={form.image_height_px}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, image_height_px: Math.round(Number(e.target.value)) }))
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-0.5">
                <span className="text-neutral-500">V máx (m/s)</span>
                <input
                  type="number"
                  step="0.5"
                  className="input-base"
                  value={form.max_speed_ms}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_speed_ms: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="grid gap-0.5">
                <span className="text-neutral-500">Altitude máx (m)</span>
                <input
                  type="number"
                  step="10"
                  className="input-base"
                  value={form.max_altitude_m}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, max_altitude_m: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1"
              disabled={busyId === 'new'}
              onClick={() => void onCreate()}
            >
              {busyId === 'new' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <Plus className="size-3.5" aria-hidden />
                  Criar modelo
                </>
              )}
            </Button>
          </div>
        </section>
      </Card>
    </div>
  )
}

function InlineCustomEditor({
  model,
  busy,
  onSave,
  onDelete,
  deleteBusy,
}: {
  model: ApiDroneModel
  busy: boolean
  onSave: (patch: Partial<ApiDroneModelCreate>) => void
  onDelete: () => void
  deleteBusy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(model.name)
  const [focal, setFocal] = useState(String(model.focal_length_mm))

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-neutral-200">{model.name}</div>
          <div className="text-neutral-500">
            f {model.focal_length_mm} mm · {model.sensor_width_mm}×{model.sensor_height_mm} mm
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={deleteBusy}>
            <Trash2 className="size-3.5 text-red-400/90" aria-hidden />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <input className="input-base text-xs" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className="input-base text-xs"
        type="number"
        step="0.01"
        value={focal}
        onChange={(e) => setFocal(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const fl = Number(focal)
            if (!name.trim() || !Number.isFinite(fl) || fl <= 0) return
            onSave({ name: name.trim(), focal_length_mm: fl })
            setEditing(false)
          }}
        >
          Salvar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setName(model.name)
            setFocal(String(model.focal_length_mm))
            setEditing(false)
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
