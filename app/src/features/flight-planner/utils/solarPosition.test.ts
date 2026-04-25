import { describe, expect, it } from 'vitest'
import type { WeatherData } from '@/features/flight-planner/types'
import {
  buildSolarFlightContextLines,
  computeSolarFlightWindowSectionRisk,
  describeIdealFlightWindowFromForecast,
  describeNdFilterHeuristic,
  getSolarArcIllustrationDot,
  getSunPositionDeg,
  getSunSeriesHourly,
  SOL_LOW_ELEVATION_DEG,
} from '@/features/flight-planner/utils/solarPosition'

describe('getSunPositionDeg', () => {
  it('mantém valores de referência (regressão / faixa NOAA ~1° para modelo SunCalc)', () => {
    const nyc = getSunPositionDeg(40.7128, -74.006, new Date('2024-06-21T17:00:00.000Z'))
    expect(nyc.elevationDeg).toBeCloseTo(72.72, 1)
    expect(nyc.azimuthDeg).toBeCloseTo(1.36, 0)

    const sp = getSunPositionDeg(-23.5505, -46.6333, new Date('2024-01-15T15:00:00.000Z'))
    expect(sp.elevationDeg).toBeCloseTo(85.6, 1)
    expect(sp.azimuthDeg).toBeCloseTo(238.71, 1)
  })

  it('no equador perto do meio-dia em março a elevação fica próxima do zênite', () => {
    const zenithish = getSunPositionDeg(0, 0, new Date('2024-03-20T12:03:00.000Z'))
    expect(zenithish.elevationDeg).toBeGreaterThan(85)
    expect(zenithish.elevationDeg).toBeLessThanOrEqual(90.5)
  })

  it('getSolarArcIllustrationDot: sol alto fica alto no SVG; noite fica abaixo do horizonte; ponto no arco r=75', () => {
    const high = getSolarArcIllustrationDot(40.7128, -74.006, new Date('2024-06-21T17:00:00.000Z'))
    expect(high.cy).toBeLessThan(35)
    expect(high.cx).toBeGreaterThan(55)
    expect(high.cx).toBeLessThan(125)

    const lowWhen = new Date('2024-12-21T08:15:00.000Z')
    const lowEl = getSunPositionDeg(48.8566, 2.3522, lowWhen).elevationDeg
    const low = getSolarArcIllustrationDot(48.8566, 2.3522, lowWhen)
    expect(lowEl).toBeGreaterThan(0)
    expect(lowEl).toBeLessThan(12)
    expect(low.cy).toBeGreaterThan(74)

    const night = getSolarArcIllustrationDot(-23.5505, -46.6333, new Date('2024-01-15T04:00:00.000Z'))
    expect(night.cy).toBeGreaterThan(88)
    expect(night.elevationDeg).toBeLessThan(-4)

    for (const p of [high, low]) {
      const r2 = (p.cx - 90) ** 2 + (p.cy - 82) ** 2
      expect(r2).toBeCloseTo(75 * 75, 0)
    }
  })

  it('elevação ao longo do dia tem pico único em latitudes mid (amostragem horária)', () => {
    const lat = 48.8566
    const lon = 2.3522
    const day = new Date('2024-06-15T12:00:00.000Z')
    const base = day.getTime()
    const series = Array.from({ length: 24 }, (_, h) =>
      getSunPositionDeg(lat, lon, new Date(base + h * 3600000)).elevationDeg,
    )
    const max = Math.max(...series)
    const maxCount = series.filter((e) => e === max).length
    expect(max).toBeGreaterThan(55)
    expect(maxCount).toBeLessThanOrEqual(3)
  })
})

describe('getSunSeriesHourly', () => {
  it('retorna 24 amostras por defeito', () => {
    const s = getSunSeriesHourly(-22.9, -43.1, new Date('2025-06-01T10:00:00.000Z'))
    expect(s).toHaveLength(24)
    expect(s[0]!.elevationDeg).toBeDefined()
  })
})

describe('describeIdealFlightWindowFromForecast', () => {
  it('identifica faixa quando há horas boas na previsão', () => {
    const weather: WeatherData = {
      windSpeedMs: 3,
      windDirectionDeg: 180,
      temperatureC: 22,
      cloudCoveragePct: 20,
      rainMmH: 0,
      hourlyForecast: Array.from({ length: 24 }, (_, i) => ({
        time: `2025-06-01T${String(i).padStart(2, '0')}:00`,
        tempC: 20,
        precipProbPct: 5,
        precipMm: 0,
        weatherCode: i >= 10 && i <= 14 ? 1 : 3,
      })),
    }
    const text = describeIdealFlightWindowFromForecast(-22.9, -43.1, weather, new Date('2025-06-01T08:00:00'))
    expect(text).toContain('Janela ideal estimada')
  })
})

describe('describeNdFilterHeuristic', () => {
  it('sugere ND leve só com sol alto, céu claro e modelo sem obturador mecânico', () => {
    const w: WeatherData = {
      windSpeedMs: 2,
      windDirectionDeg: 0,
      temperatureC: 28,
      cloudCoveragePct: 15,
      rainMmH: 0,
      weatherCode: 1,
    }
    const t = describeNdFilterHeuristic({
      lat: -22.9,
      lon: -43.1,
      now: new Date('2025-01-15T14:00:00-03:00'),
      weather: w,
      droneModel: 'Mini 4 Pro',
    })
    expect(t).toMatch(/ND leve/i)
    expect(t).toMatch(/relatório de fotos/i)
  })

  it('com céu nublado indica ND desnecessário', () => {
    const w: WeatherData = {
      windSpeedMs: 2,
      windDirectionDeg: 0,
      temperatureC: 20,
      cloudCoveragePct: 90,
      rainMmH: 0,
      weatherCode: 3,
    }
    const t = describeNdFilterHeuristic({
      lat: -22.9,
      lon: -43.1,
      now: new Date('2025-01-15T14:00:00-03:00'),
      weather: w,
      droneModel: 'Mini 4 Pro',
    })
    expect(t).toMatch(/provavelmente desnecessário/i)
  })
})

describe('computeSolarFlightWindowSectionRisk', () => {
  it('noite (sol abaixo do horizonte) = danger', () => {
    const r = computeSolarFlightWindowSectionRisk({
      lat: -23.5505,
      lon: -46.6333,
      now: new Date('2024-01-15T04:00:00.000Z'),
      weather: null,
      droneModel: 'Mavic 3',
    })
    expect(r).toBe('danger')
  })

  it('meio-dia com previsão favorável = none', () => {
    const weather: WeatherData = {
      windSpeedMs: 3,
      windDirectionDeg: 180,
      temperatureC: 22,
      cloudCoveragePct: 20,
      rainMmH: 0,
      hourlyForecast: Array.from({ length: 24 }, (_, i) => ({
        time: `2025-06-01T${String(i).padStart(2, '0')}:00`,
        tempC: 20,
        precipProbPct: 5,
        precipMm: 0,
        weatherCode: 1,
      })),
    }
    const r = computeSolarFlightWindowSectionRisk({
      lat: -22.9,
      lon: -43.1,
      now: new Date('2025-06-01T12:00:00-03:00'),
      weather,
      droneModel: 'Mavic 3',
    })
    expect(r).toBe('none')
  })
})

describe('buildSolarFlightContextLines', () => {
  it('inclui limiar de 20° nas mensagens quando aplicável', () => {
    const lines = buildSolarFlightContextLines({
      lat: 60,
      lon: 10,
      now: new Date('2024-12-21T10:00:00.000Z'),
      weather: null,
      droneModel: 'Mavic 3',
    })
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(lines.some((l) => l.includes(String(SOL_LOW_ELEVATION_DEG)))).toBe(true)
  })
})
