import { useState } from 'react'
import { Button } from '@/components/ui'
import type { FlightParams } from '@/features/flight-planner/types'
import type { ApiDroneModel } from '@/features/flight-planner/types/droneModelApi'
import { getDroneOptions } from '@/features/flight-planner/utils/droneSpecs'
import { DroneModelManager } from '@/features/flight-planner/components/DroneModelManager'

type Props = {
  params: FlightParams
  setParams: (patch: Partial<FlightParams>) => void
  models: ApiDroneModel[] | undefined
  isLoading: boolean
  isError: boolean
}

export function DroneModelSection({
  params,
  setParams,
  models,
  isLoading,
  isError,
}: Props) {
  const [managerOpen, setManagerOpen] = useState(false)
  const defaults = models?.filter((m) => !m.is_custom) ?? []
  const customs = models?.filter((m) => m.is_custom) ?? []
  const useApiList = !isError && models && models.length > 0

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-xs text-neutral-400">
          Drone
          {useApiList ? (
            <select
              className="input-base"
              disabled={isLoading}
              value={params.droneModelId ?? ''}
              onChange={(event) => {
                const id = event.target.value
                const m = models!.find((x) => x.id === id)
                if (m) {
                  setParams({ droneModelId: m.id, droneModel: m.name })
                }
              }}
            >
              {isLoading ? (
                <option value="">Carregando catálogo…</option>
              ) : null}
              {!isLoading && !params.droneModelId ? (
                <option value="" disabled>
                  Selecione um modelo
                </option>
              ) : null}
              <optgroup label="Modelos padrão">
                {defaults.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              {customs.length > 0 ? (
                <optgroup label="Meus modelos">
                  {customs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          ) : (
            <select
              className="input-base"
              value={params.droneModel}
              onChange={(event) =>
                setParams({
                  droneModelId: null,
                  droneModel: event.target.value,
                })
              }
            >
              {getDroneOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </label>
        {useApiList ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setManagerOpen(true)}
          >
            Gerenciar modelos
          </Button>
        ) : null}
      </div>
      {isError ? (
        <p className="text-[11px] text-amber-200/80">
          Catálogo de modelos indisponível — usando lista local para GSD e estatísticas.
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-neutral-500">
        Escolha o mesmo modelo que vai voar: o GSD, o frustum 3D e as estatísticas usam sensor, focal e
        resolução cadastrados.
      </p>
      {useApiList ? (
        <DroneModelManager
          open={managerOpen}
          onClose={() => setManagerOpen(false)}
          models={models}
        />
      ) : null}
    </>
  )
}
