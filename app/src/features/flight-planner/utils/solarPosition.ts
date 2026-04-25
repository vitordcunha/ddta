/**
 * Posição solar (elevação/azimute) — fórmulas alinhadas ao SunCalc (quae.nl / mourner),
 * comparáveis à calculadora NOAA GML dentro de ~1° na maioria dos casos (ver testes).
 */

import type { DroneModel, WeatherData } from '@/features/flight-planner/types'
import { droneHasMechanicalShutter } from '@/features/flight-planner/utils/cameraGuidance'
import { wmoCodeToConditionPt, wmoCodeToEstimatedCloudPct } from '@/features/flight-planner/utils/weatherHelpers'

const PI = Math.PI
const sin = Math.sin
const cos = Math.cos
const tan = Math.tan
const asin = Math.asin
const atan = Math.atan2
const rad = PI / 180
const dayMs = 1000 * 60 * 60 * 24
const J1970 = 2440588
const J2000 = 2451545
const e = rad * 23.4397

/** Limiar “sol baixo” usado nas mensagens de sombra (Fase 6). */
export const SOL_LOW_ELEVATION_DEG = 20

/** Elevação mínima considerada “sol alto” para janela de voo / ND heurístico. */
const SOL_HIGH_FOR_IDEAL_WINDOW_DEG = 32

const HOUR_MS = 60 * 60 * 1000
const SAMPLE_30M = 30 * 60 * 1000

function toJulian(d: Date) {
  return d.getTime() / dayMs - 0.5 + J1970
}
function toDays(d: Date) {
  return toJulian(d) - J2000
}

function rightAscension(l: number, b: number) {
  return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l))
}
function declination(l: number, b: number) {
  return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l))
}
function solarMeanAnomaly(d: number) {
  return rad * (357.5291 + 0.98560028 * d)
}
function eclipticLongitude(M: number) {
  const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M))
  const P = rad * 102.9372
  return M + C + P + PI
}
function sunCoords(d: number) {
  const M = solarMeanAnomaly(d)
  const L = eclipticLongitude(M)
  return { dec: declination(L, 0), ra: rightAscension(L, 0) }
}
function siderealTime(d: number, lw: number) {
  return rad * (280.16 + 360.9856235 * d) - lw
}
function azimuth(H: number, phi: number, dec: number) {
  return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi))
}
function altitude(H: number, phi: number, dec: number) {
  return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H))
}

export type SunPositionDeg = {
  elevationDeg: number
  azimuthDeg: number
}

export function getSunPositionDeg(lat: number, lon: number, when: Date): SunPositionDeg {
  const lw = rad * -lon
  const phi = rad * lat
  const d = toDays(when)
  const c = sunCoords(d)
  const H = siderealTime(d, lw) - c.ra
  return {
    elevationDeg: (altitude(H, phi, c.dec) * 180) / PI,
    azimuthDeg: ((azimuth(H, phi, c.dec) * 180) / PI + 360) % 360,
  }
}

/** viewBox 0 0 180 90 — mesmo arco que `M 15 82 A 75 75 0 0 1 165 82` (centro 90,82, r=75). */
const SOLAR_ARC_CX = 90
const SOLAR_ARC_CY = 82
const SOLAR_ARC_R = 75

export type SolarArcIllustrationDot = {
  cx: number
  cy: number
  elevationDeg: number
  azimuthDeg: number
}

/**
 * Posição do “sol” no SVG: direção (elevação + azimute, mesmo modelo de `getSunPositionDeg`)
 * normalizada para raio `SOLAR_ARC_R`, coincidindo com o círculo do traço `A 75 75`.
 */
export function getSolarArcIllustrationDot(lat: number, lon: number, when: Date): SolarArcIllustrationDot {
  const { elevationDeg, azimuthDeg } = getSunPositionDeg(lat, lon, when)
  if (elevationDeg < -4) {
    return { cx: SOLAR_ARC_CX, cy: 96, elevationDeg, azimuthDeg }
  }
  const elClampDeg = Math.max(0, Math.min(89, elevationDeg))
  const elR = (elClampDeg * PI) / 180
  const B = (azimuthDeg * PI) / 180
  const horiz = cos(elR)
  let ddx = -SOLAR_ARC_R * horiz * sin(B)
  let ddy = -SOLAR_ARC_R * sin(elR)
  const len = Math.hypot(ddx, ddy)
  if (len < 1e-4) {
    return { cx: SOLAR_ARC_CX, cy: SOLAR_ARC_CY - SOLAR_ARC_R, elevationDeg, azimuthDeg }
  }
  ddx = (ddx / len) * SOLAR_ARC_R
  ddy = (ddy / len) * SOLAR_ARC_R
  if (ddy > 0) {
    ddy = -Math.abs(ddy)
    ddx = Math.sign(ddx === 0 ? 1 : ddx) * Math.sqrt(Math.max(0, SOLAR_ARC_R * SOLAR_ARC_R - ddy * ddy))
  }
  const cx = SOLAR_ARC_CX + ddx
  const cy = SOLAR_ARC_CY + ddy
  return { cx, cy, elevationDeg, azimuthDeg }
}

export type SolarSample = {
  at: Date
  elevationDeg: number
  azimuthDeg: number
}

/** Uma amostra por hora a partir de `from` (inclusiva), por padrão 24 pontos. */
export function getSunSeriesHourly(lat: number, lon: number, from: Date, hourCount = 24): SolarSample[] {
  const out: SolarSample[] = []
  for (let h = 0; h < hourCount; h += 1) {
    const at = new Date(from.getTime() + h * HOUR_MS)
    const { elevationDeg, azimuthDeg } = getSunPositionDeg(lat, lon, at)
    out.push({ at, elevationDeg, azimuthDeg })
  }
  return out
}

function minMaxElevationInRange(lat: number, lon: number, from: Date, durationMs: number): { min: number; max: number } {
  const end = from.getTime() + durationMs
  let min = Infinity
  let max = -Infinity
  for (let t = from.getTime(); t <= end; t += SAMPLE_30M) {
    const e = getSunPositionDeg(lat, lon, new Date(t)).elevationDeg
    min = Math.min(min, e)
    max = Math.max(max, e)
  }
  const endE = getSunPositionDeg(lat, lon, new Date(end)).elevationDeg
  min = Math.min(min, endE)
  max = Math.max(max, endE)
  return { min, max }
}

/** Texto curto para as próximas 2 h em torno do limiar de 20°. */
export function describeNearTermLowSun(lat: number, lon: number, now: Date): string | null {
  const { min, max } = minMaxElevationInRange(lat, lon, now, 2 * HOUR_MS)
  if (max < SOL_LOW_ELEVATION_DEG) {
    return `Nas próximas 2 h o sol permanece abaixo de ~${SOL_LOW_ELEVATION_DEG}° de elevação — espere sombras longas e contraste acentuado nas bordas dos objetos.`
  }
  if (min < SOL_LOW_ELEVATION_DEG && max >= SOL_LOW_ELEVATION_DEG) {
    return `Nas próximas 2 h o sol cruza a faixa baixa (abaixo de ~${SOL_LOW_ELEVATION_DEG}°) em parte do período — atenção a sombras e reflexos variáveis.`
  }
  return null
}

function formatClockLocal(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

type ScoredHour = {
  at: Date
  elevationDeg: number
  cloudPct: number
  precipMm: number
  weatherCode: number
  good: boolean
}

function scoreForecastHours(lat: number, lon: number, forecast: NonNullable<WeatherData['hourlyForecast']>): ScoredHour[] {
  return forecast.map((h) => {
    const at = new Date(h.time)
    const elevationDeg = getSunPositionDeg(lat, lon, at).elevationDeg
    const cloudPct = wmoCodeToEstimatedCloudPct(h.weatherCode ?? 0)
    const precipMm = h.precipMm ?? 0
    const good =
      elevationDeg >= SOL_HIGH_FOR_IDEAL_WINDOW_DEG && cloudPct < 68 && precipMm < 0.35 && elevationDeg > -2
    return {
      at,
      elevationDeg,
      cloudPct,
      precipMm,
      weatherCode: h.weatherCode ?? 0,
      good,
    }
  })
}

function mergeGoodHourRanges(rows: ScoredHour[]): { start: Date; end: Date; codes: number[] }[] {
  const ranges: { start: Date; end: Date; codes: number[] }[] = []
  let cur: { start: Date; end: Date; codes: number[] } | null = null
  for (const r of rows) {
    if (!r.good) {
      if (cur) {
        ranges.push(cur)
        cur = null
      }
      continue
    }
    if (!cur) {
      cur = { start: r.at, end: r.at, codes: [r.weatherCode] }
    } else {
      cur.end = r.at
      cur.codes.push(r.weatherCode)
    }
  }
  if (cur) ranges.push(cur)
  return ranges
}

function dominantWmoLabel(codes: number[]): string {
  if (codes.length === 0) return wmoCodeToConditionPt(0)
  const counts = new Map<number, number>()
  for (const c of codes) {
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best = codes[0]!
  let n = 0
  for (const [c, k] of counts) {
    if (k > n) {
      n = k
      best = c
    }
  }
  return wmoCodeToConditionPt(best)
}

/** Janela “ideal” heurística: sol mais alto + céu menos encoberto + pouca chuva na previsão horária. */
export function describeIdealFlightWindowFromForecast(
  lat: number,
  lon: number,
  weather: WeatherData | null,
  now: Date,
): string {
  const hourly = weather?.hourlyForecast
  if (hourly && hourly.length > 0) {
    const scored = scoreForecastHours(lat, lon, hourly)
    const ranges = mergeGoodHourRanges(scored)
    if (ranges.length === 0) {
      return 'Nenhuma janela ideal óbvia nas próximas 24 h (sol alto + céu mais claro + pouca chuva na previsão); considere outro horário ou valide no local.'
    }
    const parts = ranges.map((g) => {
      const sky = dominantWmoLabel(g.codes)
      return `${formatClockLocal(g.start)}–${formatClockLocal(g.end)} (${sky})`
    })
    return `Janela ideal estimada (fotogrametria / sombras): ${parts.join('; ')} — horários locais da previsão.`
  }

  const series = getSunSeriesHourly(lat, lon, now, 24)
  const goodSlots = series.filter((s) => s.elevationDeg >= SOL_HIGH_FOR_IDEAL_WINDOW_DEG && s.elevationDeg > -2)
  if (goodSlots.length === 0) {
    return 'Sem previsão horária: o sol permanece baixo nas próximas 24 h neste modelo, ou está noite — janela “sol alto” não aparece; confira calendário e latitude.'
  }
  const first = goodSlots[0]!
  const last = goodSlots[goodSlots.length - 1]!
  return `Sem previsão de nuvens por hora: janela solar estimada com sol mais alto (≥${SOL_HIGH_FOR_IDEAL_WINDOW_DEG}°) entre ${formatClockLocal(first.at)} e ${formatClockLocal(last.at)} (horário local do dispositivo).`
}

/**
 * ND contextual só a partir de sol + céu + modelo (sem pixels).
 * Texto deixa claro que não contradiz relatório de calibração se este existir.
 */
export function describeNdFilterHeuristic(input: {
  lat: number
  lon: number
  now: Date
  weather: WeatherData | null
  droneModel: DroneModel
}): string {
  const { elevationDeg } = getSunPositionDeg(input.lat, input.lon, input.now)
  const cloud = input.weather?.cloudCoveragePct ?? 50
  const code = input.weather?.weatherCode ?? 0
  const heavyCloud = cloud >= 58 || code === 3 || code === 45 || code === 48 || (code >= 61 && code <= 67)

  const disclaimer =
    'Estimativa só com sol e previsão — se o relatório de fotos (EXIF/pixéis) apontar outra causa, priorize o relatório.'

  if (heavyCloud) {
    return `Céu encoberto ou muito nublado na leitura atual: filtro ND provavelmente desnecessário para ganho real. ${disclaimer}`
  }
  if (elevationDeg < 22) {
    return `Sol ainda baixo (~${elevationDeg.toFixed(0)}°): ND costuma ser secundário frente a sombras e contraste. ${disclaimer}`
  }
  const clearish = cloud < 42 && (code === 0 || code === 1 || code === 2)
  if (elevationDeg >= 40 && clearish && !droneHasMechanicalShutter(input.droneModel)) {
    return `Sol alto (~${elevationDeg.toFixed(0)}°) e céu relativamente limpo, com modelo sem obturador mecânico de referência: um ND leve pode ajudar na exposição — valide com voo-teste ou fotos. ${disclaimer}`
  }
  if (elevationDeg >= 40 && clearish && droneHasMechanicalShutter(input.droneModel)) {
    return `Sol alto e céu claro com obturador mecânico de referência: prefira ajustar obturador/ISO antes de depender de ND. ${disclaimer}`
  }
  return `ND só se notar realces estourados em campo ou no relatório de calibração. ${disclaimer}`
}

export type SolarFlightContextInput = {
  lat: number
  lon: number
  now: Date
  weather: WeatherData | null
  droneModel: DroneModel
}

/** Nível de alerta para o cabeçalho da seção «Janela de voo estimada» no planejador. */
export type PlannerSectionRisk = 'none' | 'warning' | 'danger'

/**
 * Heurística para ícone de risco ao lado do título: noite (sol abaixo do horizonte) = danger;
 * sol baixo, janela ideal ausente na previsão ou aviso de sol baixo nas próximas horas = warning.
 */
export function computeSolarFlightWindowSectionRisk(
  input: SolarFlightContextInput,
): PlannerSectionRisk {
  const { lat, lon, now, weather } = input
  const { elevationDeg } = getSunPositionDeg(lat, lon, now)
  if (elevationDeg < -2) return 'danger'

  const ideal = describeIdealFlightWindowFromForecast(lat, lon, weather, now)
  if (
    ideal.includes('Nenhuma janela ideal') ||
    ideal.includes('Sem previsão horária: o sol permanece baixo')
  ) {
    return 'warning'
  }

  if (elevationDeg < SOL_LOW_ELEVATION_DEG) return 'warning'

  const near = describeNearTermLowSun(lat, lon, now)
  if (near) return 'warning'

  return 'none'
}

/** Blocos de texto para painel pré-voo e modal (Fase 6). */
export function buildSolarFlightContextLines(input: SolarFlightContextInput): string[] {
  const { lat, lon, now, weather, droneModel } = input
  const lines: string[] = []
  lines.push(describeSolarForLocation(lat, lon, now))
  const near = describeNearTermLowSun(lat, lon, now)
  if (near) lines.push(near)
  lines.push(describeIdealFlightWindowFromForecast(lat, lon, weather, now))
  lines.push(describeNdFilterHeuristic({ lat, lon, now, weather, droneModel }))
  return lines
}

/** Resumo legado de uma linha (instante atual). */
export function describeSolarForLocation(lat: number, lon: number, now: Date) {
  const { elevationDeg, azimuthDeg } = getSunPositionDeg(lat, lon, now)
  if (elevationDeg < -2) {
    return 'Com esta localização, o sol está abaixo do horizonte no instante selecionado. Evite voos noturnos sem regras e equipamento adequados.'
  }
  if (elevationDeg < 5) {
    return `Sol muito rasteiro (elevação ~${elevationDeg.toFixed(0)}°; azimute ~${azimuthDeg.toFixed(0)}°). Contrastes fortes, sombras longas e dificuldade de exposição.`
  }
  if (elevationDeg < SOL_LOW_ELEVATION_DEG) {
    return `Sol baixo (elevação ~${elevationDeg.toFixed(0)}°; azimute ~${azimuthDeg.toFixed(0)}°). Observe brilho em superfícies e rebordo do terreno.`
  }
  return `Elevação solar ~${elevationDeg.toFixed(0)}°; azimute ~${azimuthDeg.toFixed(0)}°. Iluminação geral favorável, mas ainda ajuste ISO e obturador.`
}
