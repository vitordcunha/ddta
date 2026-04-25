/**
 * Engine de score de qualidade do voo.
 *
 * Calcula um score 0-100 com base em:
 *  - Parâmetros de voo (sempre disponível)
 *  - Dados de clima (quando disponível)
 *  - Dados de calibração (quando disponível)
 */
import type { FlightParams, FlightStats, WeatherData } from '@/features/flight-planner/types'
import type {
  CalibrationSessionDetail,
  CalibrationRecommendation,
} from '@/services/projectsService'

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export type DimensionScore = {
  /** 0-100 */
  score: number
  label: string
  detail: string
  /** Peso efetivo usado no total (após redistribuição por dados ausentes) */
  weight: number
}

export type FlightQualityScore = {
  /** 0-100, arredondado */
  total: number
  grade: QualityGrade
  /** Rótulo em português */
  label: string
  /** Classe de cor Tailwind para o score */
  colorClass: string
  dimensions: {
    resolution: DimensionScore
    overlap: DimensionScore
    motionRisk: DimensionScore
    weather: DimensionScore | null
    terrain: DimensionScore | null
  }
  /** Dimensão com pior score (para destaque no UI) */
  dominantIssue: keyof FlightQualityScore['dimensions'] | null
  /** True quando calibração real foi usada */
  hasCalibration: boolean
  /** True quando dados de clima foram usados */
  hasWeather: boolean
}

// ---------------------------------------------------------------------------
// Funções auxiliares
// ---------------------------------------------------------------------------

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

/** Interpolação linear piecewise: pontos = [[x, y], ...] ordenados por x crescente */
function piecewise(value: number, points: [number, number][]): number {
  if (value <= points[0]![0]) return points[0]![1]
  if (value >= points[points.length - 1]![0]) return points[points.length - 1]![1]
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[i + 1]!
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return points[points.length - 1]![1]
}

// ---------------------------------------------------------------------------
// Sub-scores
// ---------------------------------------------------------------------------

function scoreResolution(gsdCm: number): DimensionScore {
  const score = clamp(
    piecewise(gsdCm, [
      [0.5, 100],
      [1.0, 95],
      [1.5, 88],
      [2.0, 78],
      [3.0, 62],
      [4.5, 44],
      [6.0, 26],
      [8.0, 14],
    ]),
  )

  let detail: string
  if (gsdCm <= 1.0) detail = `${gsdCm.toFixed(2)} cm/px — resolução de alta precisão`
  else if (gsdCm <= 2.0) detail = `${gsdCm.toFixed(2)} cm/px — adequado para inspeções e ortomosaicos`
  else if (gsdCm <= 3.5) detail = `${gsdCm.toFixed(2)} cm/px — visão geral; reduza altitude para mais detalhe`
  else detail = `${gsdCm.toFixed(2)} cm/px — resolução baixa; considere voar mais baixo`

  return { score, label: 'Resolução (GSD)', detail, weight: 0 }
}

function scoreOverlap(forwardOverlap: number, sideOverlap: number): DimensionScore {
  const fwdScore = piecewise(forwardOverlap, [
    [55, 0],
    [62, 20],
    [68, 50],
    [72, 68],
    [78, 82],
    [83, 92],
    [88, 98],
    [95, 100],
  ])
  const sideScore = piecewise(sideOverlap, [
    [55, 0],
    [62, 20],
    [68, 50],
    [72, 68],
    [78, 82],
    [83, 92],
    [88, 98],
    [95, 100],
  ])

  // Forward tem peso ligeiramente maior em fotogrametria
  let score = fwdScore * 0.55 + sideScore * 0.45

  // Penalidade se diferença entre os dois for muito grande
  const diff = Math.abs(forwardOverlap - sideOverlap)
  if (diff > 20) score -= 8
  else if (diff > 15) score -= 4

  score = clamp(score)

  let detail: string
  const minOv = Math.min(forwardOverlap, sideOverlap)
  if (minOv < 63) detail = 'Sobreposição crítica — risco elevado de buracos no ortomosaico'
  else if (minOv < 70) detail = `Frontal ${forwardOverlap}% / Lateral ${sideOverlap}% — abaixo do recomendado`
  else if (minOv < 78) detail = `Frontal ${forwardOverlap}% / Lateral ${sideOverlap}% — adequado para a maioria dos terrenos`
  else detail = `Frontal ${forwardOverlap}% / Lateral ${sideOverlap}% — boa redundância para reconstrução 3D`

  return { score, label: 'Sobreposição', detail, weight: 0 }
}

function scoreMotionRisk(params: FlightParams, gsdCm: number, calibration: CalibrationSessionDetail | null): DimensionScore {
  // Se temos dados reais de calibração, usar laplacian median
  if (calibration?.pixel_report?.summary) {
    const summary = calibration.pixel_report.summary as Record<string, unknown>
    const laplacian = typeof summary['median_laplacian_var'] === 'number' ? summary['median_laplacian_var'] : null

    if (laplacian !== null) {
      const score = clamp(
        piecewise(laplacian, [
          [5, 8],
          [15, 25],
          [25, 45],
          [40, 68],
          [60, 82],
          [90, 93],
          [130, 100],
        ]),
      )

      let detail: string
      if (laplacian < 20) detail = `Laplacian ${laplacian.toFixed(0)} — blur severo detectado nas fotos de calibração`
      else if (laplacian < 45) detail = `Laplacian ${laplacian.toFixed(0)} — algum blur; considere reduzir velocidade`
      else detail = `Laplacian ${laplacian.toFixed(0)} — nitidez boa nas fotos de calibração`

      return { score, label: 'Nitidez / Motion Blur', detail, weight: 0 }
    }
  }

  // Estimativa sem calibração:
  // Shutter típico em auto: H > 120m → ~1/800s, H 60-120m → ~1/1200s, H < 60m → ~1/2000s
  const gsdM = gsdCm / 100
  const estimatedShutterS =
    params.altitudeM > 120 ? 1 / 800 :
    params.altitudeM > 60  ? 1 / 1200 :
                             1 / 2000

  const blurPx = (params.speedMs * estimatedShutterS) / Math.max(gsdM, 0.001)

  const score = clamp(
    piecewise(blurPx, [
      [0.1, 100],
      [0.3, 92],
      [0.5, 80],
      [0.8, 62],
      [1.2, 42],
      [1.8, 22],
      [2.5, 8],
    ]),
  )

  const safeSpeedMs = (0.4 * gsdM) / estimatedShutterS

  let detail: string
  if (blurPx < 0.4) detail = `~${blurPx.toFixed(2)} px de blur estimado — risco baixo`
  else if (blurPx < 0.9) detail = `~${blurPx.toFixed(2)} px de blur estimado — aceitável`
  else detail = `~${blurPx.toFixed(2)} px de blur estimado — reduza para ≤${safeSpeedMs.toFixed(1)} m/s ou aumente shutter`

  return { score, label: 'Nitidez / Motion Blur', detail, weight: 0 }
}

function scoreWeather(weather: WeatherData): DimensionScore {
  // Vento (fator principal)
  const windScore = piecewise(weather.windSpeedMs, [
    [0, 100],
    [3, 95],
    [5, 85],
    [7, 70],
    [9, 52],
    [11, 32],
    [13, 15],
    [15, 0],
  ])

  // Precipitação
  const precipScore = weather.isPrecipitatingNow
    ? 0
    : weather.rainMmH > 0.5
      ? 20
      : weather.rainMmH > 0.1
        ? 55
        : 100

  // Cobertura de nuvens (afeta luz e janela solar)
  const cloudScore = piecewise(weather.cloudCoveragePct, [
    [0, 100],
    [30, 95],
    [55, 82],
    [70, 68],
    [85, 52],
    [95, 38],
    [100, 30],
  ])

  const score = clamp(windScore * 0.60 + precipScore * 0.28 + cloudScore * 0.12)

  let detail: string
  if (weather.isPrecipitatingNow) detail = 'Precipitação ativa — não voar'
  else if (weather.windSpeedMs >= 11) detail = `Vento ${weather.windSpeedMs.toFixed(1)} m/s — acima do limite recomendado`
  else if (weather.windSpeedMs >= 7) detail = `Vento ${weather.windSpeedMs.toFixed(1)} m/s — moderado, monitore condições`
  else detail = `Vento ${weather.windSpeedMs.toFixed(1)} m/s, ${weather.cloudCoveragePct}% nuvens — condições favoráveis`

  return { score, label: 'Condições climáticas', detail, weight: 0 }
}

function scoreTerrain(session: CalibrationSessionDetail): DimensionScore {
  const grid = session.theoretical_grid
  const exifReport = session.exif_report
  const pixelReport = session.pixel_report
  const recs: CalibrationRecommendation[] = session.recommendations ?? []

  // 1. Cobertura de slots
  const slotCounts = exifReport?.calibration_grid?.slot_counts ?? {}
  const total = Object.values(slotCounts).reduce((s, v) => s + Number(v), 0)
  const covered = (slotCounts['covered'] ?? 0) + (slotCounts['best'] ?? 0)
  const coverageRatio = total > 0 ? covered / total : (grid?.slots?.length ? 0 : null)
  const coverageScore = coverageRatio !== null ? clamp(coverageRatio * 100) : 60

  // 2. Blur real das fotos
  const pixelSummary = pixelReport?.summary as Record<string, unknown> | undefined
  const laplacian = typeof pixelSummary?.['median_laplacian_var'] === 'number' ? pixelSummary['median_laplacian_var'] : null
  const blurScore = laplacian !== null
    ? clamp(piecewise(laplacian, [[5, 10], [20, 35], [40, 60], [70, 82], [100, 95], [140, 100]]))
    : 65

  // 3. Consistência de exposição
  const exifSummary = exifReport?.summary as Record<string, unknown> | undefined
  const exposureStdev = typeof exifSummary?.['exposure_time_log2_stdev'] === 'number'
    ? exifSummary['exposure_time_log2_stdev']
    : null
  const exposureScore = exposureStdev !== null
    ? clamp(piecewise(exposureStdev, [[0, 100], [0.1, 95], [0.3, 78], [0.6, 55], [1.0, 32], [1.5, 15]]))
    : 70

  // 4. Penalidade por recomendações críticas
  const badCount = recs.filter((r) => r.severity === 'bad').length
  const warnCount = recs.filter((r) => r.severity === 'warn').length
  const recPenalty = Math.min(40, badCount * 18 + warnCount * 6)

  const rawScore = coverageScore * 0.30 + blurScore * 0.40 + exposureScore * 0.30 - recPenalty
  const score = clamp(rawScore)

  let detail: string
  if (badCount > 0) detail = `${badCount} problema(s) crítico(s) nas fotos de calibração`
  else if (warnCount > 1) detail = `${warnCount} avisos na calibração — ajuste os parâmetros sugeridos`
  else if (score >= 80) detail = 'Qualidade do terreno boa — configurações validadas pelas fotos reais'
  else detail = 'Calibração indica ajustes necessários antes do voo principal'

  return { score, label: 'Terreno (calibração)', detail, weight: 0 }
}

// ---------------------------------------------------------------------------
// Score total com redistribuição de pesos
// ---------------------------------------------------------------------------

export function calculateFlightQualityScore(
  params: FlightParams,
  stats: FlightStats | null,
  weather: WeatherData | null,
  calibration: CalibrationSessionDetail | null,
): FlightQualityScore {
  const gsdCm = stats?.gsdCm ?? (params.altitudeM * 0.0133) // fallback estimado grosseiro

  const hasWeather = weather !== null
  const hasCalibration = calibration !== null && calibration.status === 'ready'

  // Calcular sub-scores
  const resolution = scoreResolution(gsdCm)
  const overlap = scoreOverlap(params.forwardOverlap, params.sideOverlap)
  const motionRisk = scoreMotionRisk(params, gsdCm, hasCalibration ? calibration : null)
  const weatherDim = hasWeather ? scoreWeather(weather!) : null
  const terrainDim = hasCalibration ? scoreTerrain(calibration!) : null

  // Pesos base
  let wRes = 0.20
  let wOv  = 0.25
  let wMot = 0.15
  let wWth = 0.20
  let wTer = 0.20

  // Redistribuir pesos quando dados ausentes
  if (!hasWeather && !hasCalibration) {
    wRes = 0.33; wOv = 0.42; wMot = 0.25; wWth = 0; wTer = 0
  } else if (!hasWeather) {
    wRes = 0.25; wOv = 0.30; wMot = 0.20; wWth = 0; wTer = 0.25
  } else if (!hasCalibration) {
    wRes = 0.25; wOv = 0.30; wMot = 0.20; wWth = 0.25; wTer = 0
  }

  resolution.weight = wRes
  overlap.weight = wOv
  motionRisk.weight = wMot
  if (weatherDim) weatherDim.weight = wWth
  if (terrainDim) terrainDim.weight = wTer

  const total = Math.round(
    resolution.score * wRes +
    overlap.score * wOv +
    motionRisk.score * wMot +
    (weatherDim?.score ?? 0) * wWth +
    (terrainDim?.score ?? 0) * wTer,
  )

  // Grade
  let grade: QualityGrade
  let label: string
  let colorClass: string
  if (total >= 85) { grade = 'A'; label = 'Excelente';    colorClass = 'text-emerald-400' }
  else if (total >= 70) { grade = 'B'; label = 'Boa';          colorClass = 'text-green-400' }
  else if (total >= 55) { grade = 'C'; label = 'Aceitável';    colorClass = 'text-yellow-400' }
  else if (total >= 40) { grade = 'D'; label = 'Limitada';     colorClass = 'text-orange-400' }
  else                  { grade = 'F'; label = 'Insuficiente'; colorClass = 'text-red-400' }

  // Dimensão com pior score (normalizada pelo peso para identificar impacto real)
  const dims = [
    { key: 'resolution' as const, s: resolution.score },
    { key: 'overlap' as const, s: overlap.score },
    { key: 'motionRisk' as const, s: motionRisk.score },
    ...(weatherDim ? [{ key: 'weather' as const, s: weatherDim.score }] : []),
    ...(terrainDim ? [{ key: 'terrain' as const, s: terrainDim.score }] : []),
  ]
  const worst = dims.reduce((a, b) => (a.s < b.s ? a : b))
  const dominantIssue = worst.s < 70 ? worst.key : null

  return {
    total: clamp(total),
    grade,
    label,
    colorClass,
    dimensions: {
      resolution,
      overlap,
      motionRisk,
      weather: weatherDim,
      terrain: terrainDim,
    },
    dominantIssue,
    hasCalibration,
    hasWeather,
  }
}

/** Retorna a classe de cor do anel SVG baseada no score total */
export function scoreToRingColor(score: number): string {
  if (score >= 85) return '#34d399' // emerald-400
  if (score >= 70) return '#4ade80' // green-400
  if (score >= 55) return '#facc15' // yellow-400
  if (score >= 40) return '#fb923c' // orange-400
  return '#f87171'                  // red-400
}
