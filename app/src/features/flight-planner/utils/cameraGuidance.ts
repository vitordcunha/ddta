import type { DroneModel } from '@/features/flight-planner/types'
import type { FlightQualityPresetId } from '@/features/flight-planner/utils/flightParamGuidance'

/** Drone com obturador mecânico relevante em muitos modos (referência de campo; DJI muda por firmware). */
const MECHANICAL_SHUTTER_HINT_MODELS: string[] = ['Phantom 4', 'Phantom 4 Pro', 'Mavic 3']

export function droneHasMechanicalShutter(droneModel: string): boolean {
  return MECHANICAL_SHUTTER_HINT_MODELS.some(
    (m) => m.toLowerCase() === droneModel.trim().toLowerCase(),
  )
}

export type CameraModelGuidance = {
  title: string
  paragraphs: string[]
}

/**
 * Regra prática: tempo de obturação < (GSD no solo em m) / (velocidade de solo em m/s)
 * para limitar deslocamento em pixel entre disparos.
 */
export function computeMinShutterSuggestion({
  speedMs,
  gsdCm,
}: {
  speedMs: number
  gsdCm: number
}): string {
  if (!Number.isFinite(speedMs) || !Number.isFinite(gsdCm) || speedMs <= 0 || gsdCm <= 0) {
    return 'Defina GSD e velocidade válidos para estimar o obturador mínimo de partida.'
  }
  const gsdM = gsdCm / 100
  const tSec = gsdM / speedMs
  const inv = Math.max(1, Math.round(1 / tSec))
  const tMs = tSec * 1000
  return `Comece por ~1/${inv} s (regra prática: obturador < GSD no solo ÷ velocidade, ~${tMs.toFixed(0)} ms com este GSD e voo; valide em campo com as fotos reais).`
}

export function getCameraModelGuidance(
  droneModel: DroneModel,
  activePreset: FlightQualityPresetId | null,
): CameraModelGuidance {
  const presetLabel = activePreset
    ? {
        draft: 'Rascunho (menor redundância)',
        balanced: 'Equilibrado',
        high: 'Alta qualidade',
      }[activePreset]
    : 'Personalizado (ajustes manuais)'

  const mechanical = droneHasMechanicalShutter(droneModel)
  const shutterText = mechanical
    ? 'Este perfil costuma oferecer obturador mecânico (ou híbrido) em muitas missões: prefira 1/xxx s ou mais rápido para ruas de sobreposição altas, conforme a regra de GSD ÷ velocidade.'
    : 'Linha Mini: obturador eletrônico na maioria dos casos. Reduza velocidade ou GSD (voando mais baixo) se notar riscas ou rebitamento; o fabricante restringe tempos muito curtos em certos modos — confira o app.'

  return {
    title: `${droneModel} — ${presetLabel}`,
    paragraphs: [
      'Use o mesmo branco, ISO e distância de foco entre toda a missão, ou marque a pasta para exposição idêntica se o pós exigir uniformidade.',
      'Disparo a intervalos ou por distância: verifique o intervalo mínimo que o app permite para a resolução escolhida; sobreposições muito altas com máquina lenta podem comprometer a taxa.',
      shutterText,
    ],
  }
}
