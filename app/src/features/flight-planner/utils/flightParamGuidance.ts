import type { FlightParams } from '@/features/flight-planner/types'
import type { ApiDroneModel } from '@/features/flight-planner/types/droneModelApi'
import {
  profileToDroneSpec,
  resolveFlightDroneProfile,
} from '@/features/flight-planner/utils/flightDroneProfile'
import { calculateGsd } from '@/features/flight-planner/utils/waypointCalculator'

export type FlightQualityPresetId = 'draft' | 'balanced' | 'high'

export type FlightQualityPreset = {
  id: FlightQualityPresetId
  label: string
  short: string
  /** Parametros aplicados ao escolher o preset (nao altera o modelo de drone). */
  params: Pick<FlightParams, 'altitudeM' | 'forwardOverlap' | 'sideOverlap' | 'speedMs'>
}

export const FLIGHT_QUALITY_PRESETS: FlightQualityPreset[] = [
  {
    id: 'draft',
    label: 'Rascunho',
    short: 'Menos fotos, missao mais curta. Bom para testes ou visao geral.',
    params: {
      altitudeM: 150,
      forwardOverlap: 70,
      sideOverlap: 68,
      speedMs: 10,
    },
  },
  {
    id: 'balanced',
    label: 'Equilibrado',
    short: 'Ponto de partida seguro para ortomosaicos na maioria dos terrenos.',
    params: {
      altitudeM: 120,
      forwardOverlap: 80,
      sideOverlap: 70,
      speedMs: 8,
    },
  },
  {
    id: 'high',
    label: 'Alta qualidade',
    short: 'Mais redundancia e voo mais lento; melhor para vegetacao densa, 3D ou maior precisao.',
    params: {
      altitudeM: 90,
      forwardOverlap: 85,
      sideOverlap: 76,
      speedMs: 5,
    },
  },
]

export function presetParamsFor(
  presetId: FlightQualityPresetId,
): Pick<FlightParams, 'altitudeM' | 'forwardOverlap' | 'sideOverlap' | 'speedMs'> {
  const p = FLIGHT_QUALITY_PRESETS.find((x) => x.id === presetId)
  if (!p) throw new Error(`Unknown preset: ${presetId}`)
  return p.params
}

/** Quando os quatro campos coincidem com um preset, o painel pode destacar o botao correspondente. */
export function detectActiveQualityPreset(params: FlightParams): FlightQualityPresetId | null {
  for (const p of FLIGHT_QUALITY_PRESETS) {
    const { altitudeM, forwardOverlap, sideOverlap, speedMs } = p.params
    if (
      params.altitudeM === altitudeM &&
      params.forwardOverlap === forwardOverlap &&
      params.sideOverlap === sideOverlap &&
      params.speedMs === speedMs
    ) {
      return p.id
    }
  }
  return null
}

export function estimateGsdCmFromParams(
  params: FlightParams,
  catalog?: ApiDroneModel[],
): number {
  const spec = profileToDroneSpec(resolveFlightDroneProfile(params, catalog))
  const gsdM = calculateGsd(params.altitudeM, spec)
  return gsdM * 100
}

export type FlightConfigNotice = {
  severity: 'error' | 'warning' | 'info'
  text: string
}

/**
 * Estimativa de precisao posicional esperada (RMSE) sem GCP.
 * Baseado em literatura de fotogrametria UAV empirica.
 */
export function estimatePrecision(gsdCm: number): { xyMinCm: number; xyMaxCm: number; zMinCm: number; zMaxCm: number } {
  return {
    xyMinCm: parseFloat((1.5 * gsdCm).toFixed(1)),
    xyMaxCm: parseFloat((2.5 * gsdCm).toFixed(1)),
    zMinCm: parseFloat((2.5 * gsdCm).toFixed(1)),
    zMaxCm: parseFloat((4.0 * gsdCm).toFixed(1)),
  }
}

/**
 * Estima o motion blur em pixels com base em velocidade, GSD e tempo de exposicao tipico.
 */
export function estimateMotionBlurPx(speedMs: number, gsdCm: number, altitudeM: number): number {
  const gsdM = gsdCm / 100
  // Shutter tipico em auto ISO no DJI: mais alto = mais exposto, mais baixo = mais travado
  const estimatedShutterS =
    altitudeM > 120 ? 1 / 800 :
    altitudeM > 60  ? 1 / 1200 :
                      1 / 2000
  return (speedMs * estimatedShutterS) / Math.max(gsdM, 0.004)
}

/**
 * Velocidade maxima para manter blur abaixo de 0.5 px (limite seguro).
 */
export function safeSpeedMsForBlur(gsdCm: number, altitudeM: number): number {
  const gsdM = gsdCm / 100
  const shutterS =
    altitudeM > 120 ? 1 / 800 :
    altitudeM > 60  ? 1 / 1200 :
                      1 / 2000
  return Math.floor((0.5 * gsdM) / shutterS * 10) / 10
}

/**
 * Avisos e dicas com base nos parametros (e estatisticas quando ja calculadas).
 */
export function analyzeFlightConfiguration(
  params: FlightParams,
  stats: { gsdCm: number; estimatedPhotos: number } | null,
  catalog?: ApiDroneModel[],
): FlightConfigNotice[] {
  const notices: FlightConfigNotice[] = []
  const spec = profileToDroneSpec(resolveFlightDroneProfile(params, catalog))
  const gsdCm = stats?.gsdCm ?? estimateGsdCmFromParams(params, catalog)
  const photos = stats?.estimatedPhotos

  if (params.forwardOverlap < 63 || params.sideOverlap < 63) {
    notices.push({
      severity: 'error',
      text: 'Sobreposicao muito baixa: alto risco de falhas na costura e buracos no ortomosaico. Suba para pelo menos ~70% em ambas as direcoes.',
    })
  } else if (params.forwardOverlap < 68) {
    notices.push({
      severity: 'warning',
      text: 'Sobreposicao frontal baixa: muitos softwares recomendam 70% ou mais para resultados estaveis.',
    })
  } else if (params.forwardOverlap < 72) {
    notices.push({
      severity: 'info',
      text: 'Com frontal entre 68% e 72%, verifique se o terreno tem textura suficiente (evite pasto ou agua uniforme sem referencias).',
    })
  }

  if (params.sideOverlap < 63) {
    /* ja coberto pelo erro combinado */
  } else if (params.sideOverlap < 68) {
    notices.push({
      severity: 'warning',
      text: 'Sobreposicao lateral baixa: prefira 70% ou mais se precisar de bordas confiaveis ou terreno irregular.',
    })
  }

  if (params.forwardOverlap - params.sideOverlap > 18) {
    notices.push({
      severity: 'warning',
      text: 'Grande diferenca entre frontal e lateral: pode gerar desequilibrio de pontos de amarracao; aproxime os dois valores se notar problemas no processamento.',
    })
  }

  if (params.speedMs >= 13 && params.forwardOverlap < 78) {
    notices.push({
      severity: 'warning',
      text: 'Velocidade alta com sobreposicao moderada: risco de desfoque e intervalo irregular entre fotos; reduza a velocidade ou aumente a frontal.',
    })
  }

  if (params.speedMs >= 14 && params.altitudeM <= 60) {
    notices.push({
      severity: 'warning',
      text: 'Voo rapido e baixo: exige pilotagem precisa e bom disparo por distancia no app do drone.',
    })
  }

  if (params.altitudeM >= 220) {
    notices.push({
      severity: 'warning',
      text: 'Altitude muito alta para detalhe fino: o GSD fica grosseiro; confirme se a resolucao atual atende ao objetivo do levantamento.',
    })
  }

  if (params.altitudeM <= 40) {
    notices.push({
      severity: 'warning',
      text: 'Altitude baixa: mais fotos, mais tempo de voo e maior sensibilidade a obstaculos e variacoes de relevo; confirme margem de seguranca.',
    })
  }

  if (params.speedMs > spec.maxSpeedMs * 0.85) {
    notices.push({
      severity: 'info',
      text: `Velocidade proxima do limite tipico deste modelo (~${Math.round(spec.maxSpeedMs)} m/s no fabricante): em missao real use margem para vento e modo de camera.`,
    })
  }

  if (gsdCm > 3.5) {
    notices.push({
      severity: 'info',
      text: `GSD ~${gsdCm.toFixed(2)} cm/px: adequado para visao geral; para medicoes ou detalhes finos, voe mais baixo ou use preset "Alta qualidade".`,
    })
  }

  if (photos != null && photos > 3500 && gsdCm < 1.2) {
    notices.push({
      severity: 'info',
      text: 'Muitas fotos estimadas: tempo de processamento e armazenamento serao elevados; avalie subir um pouco a altitude se o GSD permitir.',
    })
  }

  if (params.forwardOverlap >= 90 && params.sideOverlap >= 82) {
    notices.push({
      severity: 'info',
      text: 'Sobreposicao muito alta: excelente redundancia, mas missao longa e possivel desfocagem por vento entre disparos — avalie se e necessario.',
    })
  }

  // Motion blur estimate
  const blurPx = estimateMotionBlurPx(params.speedMs, gsdCm, params.altitudeM)
  const safeSpeed = safeSpeedMsForBlur(gsdCm, params.altitudeM)
  if (blurPx > 1.5) {
    notices.push({
      severity: 'error',
      text: `Motion blur severo estimado (~${blurPx.toFixed(1)} px): com este GSD e velocidade o drone provavelmente producira fotos borradas. Reduza para ≤${safeSpeed} m/s ou use shutter mais rapido no app da camera.`,
    })
  } else if (blurPx > 0.65) {
    notices.push({
      severity: 'warning',
      text: `Motion blur detectavel estimado (~${blurPx.toFixed(1)} px): velocidade ideal para este GSD seria ≤${safeSpeed} m/s. Considere travar o shutter em 1/1000s ou mais no modo de camera.`,
    })
  }

  return dedupeNotices(notices)
}

function dedupeNotices(list: FlightConfigNotice[]): FlightConfigNotice[] {
  const seen = new Set<string>()
  const out: FlightConfigNotice[] = []
  const order = { error: 0, warning: 1, info: 2 }
  const sorted = [...list].sort((a, b) => order[a.severity] - order[b.severity])
  for (const n of sorted) {
    if (seen.has(n.text)) continue
    seen.add(n.text)
    out.push(n)
  }
  return out
}
