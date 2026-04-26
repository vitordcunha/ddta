import { useEffect, useMemo } from 'react'
import type { Project } from '@/types/project'
import { ProcessingStatsGrid } from '@/features/results/components/ProcessingStatsGrid'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import { extractCompletedStats } from '@/features/results/utils/extractCompletedStats'
import { processingPresetLabel } from '@/features/results/utils/processingPresetLabel'
import {
  assetsIncludeOrthophoto,
  projectIsProcessingLike,
} from '@/features/results/utils/orthophotoAssets'

function formatRunDate(iso: string): string {
  const d = Date.parse(iso)
  if (Number.isNaN(d)) return iso
  return new Date(d).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type RunRow = {
  key: string
  title: string
  subtitle: string
}

function buildRunRows(project: Project): RunRow[] {
  const rows: RunRow[] = []
  if (assetsIncludeOrthophoto(project.assets)) {
    const preset = processingPresetLabel(project.lastProcessingPreset ?? 'desconhecido')
    const busy = projectIsProcessingLike(project)
    rows.push({
      key: 'full:current',
      title: 'Processamento completo (atual)',
      subtitle: busy
        ? `Qualidade: ${preset} · novo processamento em curso (o ficheiro atual pode ser substituído ao terminar)`
        : `Qualidade: ${preset}`,
    })
  }
  for (const r of project.processingRuns) {
    rows.push({
      key: `full:${r.runId}`,
      title: 'Processamento completo (arquivo)',
      subtitle: `${processingPresetLabel(r.preset)} · ${formatRunDate(r.completedAt)}`,
    })
  }
  if (project.previewAssets && project.previewStatus === 'completed') {
    rows.push({
      key: 'preview:current',
      title: 'Preview rápido (atual)',
      subtitle: 'Pré-visualização ODM (baixa resolução)',
    })
  }
  for (const r of project.previewRuns) {
    rows.push({
      key: `preview:${r.runId}`,
      title: 'Preview rápido (arquivo)',
      subtitle: `${r.kind === 'fast_preview' ? 'Preview rápido' : r.kind} · ${formatRunDate(r.completedAt)}`,
    })
  }
  return rows
}

function statsForSelectedKey(project: Project, key: string | null) {
  if (!key) return null
  if (key === 'full:current') return project.stats
  if (key === 'preview:current') return null
  if (key.startsWith('full:')) {
    const id = key.slice('full:'.length)
    const run = project.processingRuns.find((r) => r.runId === id)
    return run?.stats ?? null
  }
  return null
}

type ResultRunLayersPanelProps = {
  project: Project
}

export function ResultRunLayersPanel({ project }: ResultRunLayersPanelProps) {
  const rows = useMemo(() => buildRunRows(project), [project])
  const layerKeys = useMemo(() => rows.map((r) => r.key), [rows])
  const ensureOrthophotoLayerKeys = useResultsViewStore((s) => s.ensureOrthophotoLayerKeys)
  const orthophotoLayerVisibility = useResultsViewStore((s) => s.orthophotoLayerVisibility)
  const orthophotoLayerOpacity = useResultsViewStore((s) => s.orthophotoLayerOpacity)
  const setOrthophotoLayerVisibility = useResultsViewStore((s) => s.setOrthophotoLayerVisibility)
  const setOrthophotoLayerOpacity = useResultsViewStore((s) => s.setOrthophotoLayerOpacity)
  const selectedRunDetailKey = useResultsViewStore((s) => s.selectedRunDetailKey)
  const setSelectedRunDetailKey = useResultsViewStore((s) => s.setSelectedRunDetailKey)

  useEffect(() => {
    ensureOrthophotoLayerKeys(layerKeys)
  }, [ensureOrthophotoLayerKeys, layerKeys])

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedRunDetailKey(null)
      return
    }
    if (selectedRunDetailKey && rows.some((r) => r.key === selectedRunDetailKey)) return
    const preferred = rows.find((r) => r.key === 'full:current') ?? rows[0]
    setSelectedRunDetailKey(preferred?.key ?? null)
  }, [rows, selectedRunDetailKey, setSelectedRunDetailKey])

  const detailStats = extractCompletedStats(statsForSelectedKey(project, selectedRunDetailKey))
  const showDetailGrid =
    Boolean(detailStats) && selectedRunDetailKey !== 'full:current'

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#2e2e2e] bg-[#171717]/80 p-3">
        <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-neutral-500">
          Ortomosaicos · varias execuções
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Aqui vão aparecer as opções para ligar ou desligar cada ortomosaico no mapa (completo, preview e
          versões anteriores após refazer). Enquanto não existir ortomosaico no projeto, esta caixa fica vazia.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#2e2e2e] bg-[#171717]/80 p-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[1.2px] text-neutral-500">
          Ortomosaicos · varias execuções
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Com <span className="text-neutral-300">Ortomosaico</span> em &quot;Camada ativa&quot;, use as caixas
          para mostrar versões no mapa e o slider de opacidade de cada linha para afinar por cima do satélite.
          Clique no texto para preset e métricas quando existirem.
        </p>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const visible = orthophotoLayerVisibility[row.key] !== false
          const selected = selectedRunDetailKey === row.key
          const op = orthophotoLayerOpacity[row.key] ?? 85
          return (
            <li
              key={row.key}
              className={[
                'rounded-md border px-2 py-2',
                selected ? 'border-[#3ecf8e]/40 bg-[rgba(62,207,142,0.06)]' : 'border-transparent bg-[#0f0f0f]',
              ].join(' ')}
            >
              <div className="flex gap-2">
                <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-600 bg-neutral-900"
                    checked={visible}
                    onChange={(e) => setOrthophotoLayerVisibility(row.key, e.target.checked)}
                    title="Mostrar no mapa"
                  />
                </label>
                <div className="min-w-0 flex-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRunDetailKey(row.key)}
                    className="w-full text-left text-xs transition hover:opacity-90"
                  >
                    <span className="font-medium text-neutral-100">{row.title}</span>
                    <span className="mt-0.5 block text-neutral-500">{row.subtitle}</span>
                    {selected ? (
                      <span className="mt-1 block text-[10px] font-mono uppercase tracking-wider text-[#3ecf8e]">
                        Detalhes selecionados
                      </span>
                    ) : (
                      <span className="mt-1 block text-[10px] text-neutral-600">Clique para ver detalhes</span>
                    )}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-500">Opacidade</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={op}
                      onChange={(e) => setOrthophotoLayerOpacity(row.key, Number(e.target.value))}
                      className="h-1 min-w-[6rem] flex-1 cursor-pointer accent-[#3ecf8e]"
                      aria-label={`Opacidade ${row.title}`}
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] text-neutral-400">{op}%</span>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {selectedRunDetailKey === 'full:current' ? (
        <p className="border-t border-[#2e2e2e] pt-2 text-xs text-neutral-500">
          As métricas do processamento atual aparecem na seção de estatísticas abaixo neste painel.
        </p>
      ) : null}
      {showDetailGrid ? (
        <div className="border-t border-[#2e2e2e] pt-2">
          <p className="mb-2 text-xs text-neutral-500">Métricas desta execução (quando o backend gravou estatísticas)</p>
          <ProcessingStatsGrid stats={detailStats!} />
        </div>
      ) : selectedRunDetailKey?.startsWith('preview') ? (
        <p className="text-xs text-neutral-500">
          O preview prioriza velocidade; métricas completas costumam aparecer só no processamento completo.
        </p>
      ) : null}
    </div>
  )
}
