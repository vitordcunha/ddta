import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button, DialogPanel } from '@/components/ui'
import { projectsService, type ProjectPurgeRequestBody } from '@/services/projectsService'

type OptionKey = keyof ProjectPurgeRequestBody

const OPTIONS: { key: OptionKey; label: string; description: string }[] = [
  {
    key: 'images',
    label: 'Imagens do drone',
    description: 'Ficheiros em disco, filas de chunks e registos na base (metadados EXIF/GPS).',
  },
  {
    key: 'flight_plan',
    label: 'Plano de voo',
    description: 'Poligono da area, dados do planejador e parametros de sobreposicao / altitude.',
  },
  {
    key: 'processing_results',
    label: 'Resultado principal (ODM)',
    description: 'Pasta results/, ortomosaico, nuvens, estatisticas e referencias de tarefa principal.',
  },
  {
    key: 'preview_results',
    label: 'Resultados de preview rapido',
    description: 'Pasta preview-results/, assets de preview e estado do preview.',
  },
  {
    key: 'processing_runs',
    label: 'Historico de processamentos',
    description: 'Execucoes arquivadas em processing-runs/ e lista no projeto.',
  },
  {
    key: 'preview_runs',
    label: 'Historico de previews',
    description: 'Execucoes em preview-runs/ e lista de previews guardados.',
  },
  {
    key: 'calibration_sessions',
    label: 'Sessoes de calibracao',
    description: 'Relatorios EXIF/pixel, grelha teorica e ficheiros por sessao.',
  },
]

const INITIAL: ProjectPurgeRequestBody = {
  images: false,
  flight_plan: false,
  processing_results: false,
  preview_results: false,
  processing_runs: false,
  preview_runs: false,
  calibration_sessions: false,
}

type ProjectPurgeModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
}

export function ProjectPurgeModal(props: ProjectPurgeModalProps) {
  if (!props.open) return null
  return <ProjectPurgeModalInner {...props} />
}

function ProjectPurgeModalInner({ open, onOpenChange, projectId, projectName }: ProjectPurgeModalProps) {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<ProjectPurgeRequestBody>(INITIAL)

  const resetSelection = useCallback(() => {
    setSelection(INITIAL)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetSelection()
      onOpenChange(next)
    },
    [onOpenChange, resetSelection],
  )

  const anySelected = useMemo(() => Object.values(selection).some(Boolean), [selection])

  const purgeMutation = useMutation({
    mutationFn: (body: ProjectPurgeRequestBody) => projectsService.purge(projectId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Dados do projeto atualizados.')
      handleOpenChange(false)
    },
    onError: (err: unknown) => {
      const res = typeof err === 'object' && err !== null ? (err as { response?: { status?: number; data?: { detail?: unknown } } }).response : undefined
      const status = res?.status
      const detail = res?.data?.detail
      const detailStr =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d))).join('; ')
            : ''
      if (status === 409) {
        toast.error('Nao e possivel limpar enquanto o processamento ou preview estiver em curso.')
        return
      }
      toast.error(detailStr || 'Nao foi possivel limpar os dados selecionados.')
    },
  })

  const toggle = (key: OptionKey) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectAll = () => {
    setSelection({
      images: true,
      flight_plan: true,
      processing_results: true,
      preview_results: true,
      processing_runs: true,
      preview_runs: true,
      calibration_sessions: true,
    })
  }

  const clearAll = () => setSelection(INITIAL)

  return (
    <DialogPanel
      open={open}
      onOpenChange={handleOpenChange}
      title="Limpar dados do projeto"
      contentClassName="lg:max-w-[min(92vw,42rem)]"
    >
      <div className="space-y-4 pr-1">
        <p className="text-sm text-neutral-400">
          Escolha o que remover de <span className="font-medium text-neutral-100">{projectName}</span>. A accao e
          irreversivel apos confirmar. Com processamento ou preview em fila ou a correr, o pedido e recusado.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
            Marcar tudo
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Desmarcar tudo
          </Button>
        </div>
        <ul className="space-y-3">
          {OPTIONS.map(({ key, label, description }) => (
            <li
              key={key}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 transition hover:border-neutral-700"
            >
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-neutral-600 bg-neutral-900"
                  checked={selection[key]}
                  onChange={() => toggle(key)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-neutral-100">{label}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={purgeMutation.isPending}
            disabled={!anySelected}
            onClick={() => {
              if (!anySelected) return
              purgeMutation.mutate(selection)
            }}
          >
            Limpar seleccionados
          </Button>
        </div>
      </div>
    </DialogPanel>
  )
}
