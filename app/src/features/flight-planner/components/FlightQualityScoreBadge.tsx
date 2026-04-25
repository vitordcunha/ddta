import { useState } from 'react'
import { ChevronDown, FlaskConical, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui'
import {
  calculateFlightQualityScore,
  scoreToRingColor,
  type FlightQualityScore,
  type DimensionScore,
} from '@/features/flight-planner/utils/flightQualityScore'
import type { FlightParams, FlightStats, WeatherData } from '@/features/flight-planner/types'
import type { CalibrationSessionDetail } from '@/services/projectsService'

// ---------------------------------------------------------------------------
// SVG ring
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = scoreToRingColor(score)

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={4}
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Dimensão individual
// ---------------------------------------------------------------------------

function DimensionRow({ dim, label }: { dim: DimensionScore; label: string }) {
  const barColor =
    dim.score >= 85 ? 'bg-emerald-400' :
    dim.score >= 70 ? 'bg-green-400' :
    dim.score >= 55 ? 'bg-yellow-400' :
    dim.score >= 40 ? 'bg-orange-400' :
                      'bg-red-400'

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">{label}</span>
        <span
          className={cn(
            'font-mono text-[11px] font-medium',
            dim.score >= 85 ? 'text-emerald-400' :
            dim.score >= 70 ? 'text-green-400' :
            dim.score >= 55 ? 'text-yellow-400' :
            dim.score >= 40 ? 'text-orange-400' :
                              'text-red-400',
          )}
        >
          {Math.round(dim.score)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${dim.score}%` }}
        />
      </div>
      <p className="text-[10px] leading-snug text-neutral-500">{dim.detail}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type Props = {
  params: FlightParams
  stats: FlightStats | null
  weather: WeatherData | null
  calibration: CalibrationSessionDetail | null
}

export function FlightQualityScoreBadge({ params, stats, weather, calibration }: Props) {
  const [open, setOpen] = useState(false)

  const score: FlightQualityScore = calculateFlightQualityScore(params, stats, weather, calibration)

  const scoreColor =
    score.total >= 85 ? 'text-emerald-400' :
    score.total >= 70 ? 'text-green-400' :
    score.total >= 55 ? 'text-yellow-400' :
    score.total >= 40 ? 'text-orange-400' :
                        'text-red-400'

  return (
    <Card className="glass-card overflow-hidden p-0">
      {/* Header — sempre visível */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {/* Score ring + número */}
        <div className="relative shrink-0">
          <ScoreRing score={score.total} size={52} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center font-mono text-sm font-bold',
              scoreColor,
            )}
          >
            {score.total}
          </span>
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-neutral-200">Score de qualidade</span>
            {score.hasCalibration && (
              <span
                className="flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-300"
                title="Score inclui dados reais do voo de calibração"
              >
                <FlaskConical className="size-2.5" />
                Calibrado
              </span>
            )}
          </div>
          <p className={cn('text-xs font-medium', scoreColor)}>{score.label}</p>
          {score.dominantIssue && (
            <p className="mt-0.5 truncate text-[10px] text-neutral-500">
              {score.dimensions[score.dominantIssue]?.detail}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-neutral-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {/* Breakdown — expandível */}
      {open && (
        <div className="space-y-3 border-t border-white/[0.08] px-4 pb-4 pt-3">
          {/* Grades das dimensões */}
          <div className="space-y-2.5">
            <DimensionRow dim={score.dimensions.resolution} label="Resolução (GSD)" />
            <DimensionRow dim={score.dimensions.overlap} label="Sobreposição" />
            <DimensionRow dim={score.dimensions.motionRisk} label="Nitidez / Motion Blur" />
            {score.dimensions.weather && (
              <DimensionRow dim={score.dimensions.weather} label="Condições climáticas" />
            )}
            {score.dimensions.terrain && (
              <DimensionRow dim={score.dimensions.terrain} label="Terreno (calibração)" />
            )}
          </div>

          {/* Rodapé informativo */}
          <div className="flex gap-1.5 rounded-lg bg-white/[0.03] p-2.5 text-[10px] leading-snug text-neutral-500">
            <Info className="mt-0.5 size-3 shrink-0 text-neutral-600" />
            <span>
              Score estimado com base nos parâmetros de voo
              {score.hasWeather ? ', clima' : ''}
              {score.hasCalibration ? ' e dados reais do voo de calibração' : ''}.
              {!score.hasCalibration && (
                <> Realize um voo de calibração para score mais preciso.</>
              )}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
