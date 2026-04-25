import {
  windSpeedToBeaufort,
  wmoCodeToConditionPt,
} from '@/features/flight-planner/utils/weatherHelpers'
import type { FlightParams, WeatherData, FlightAssessment } from '@/features/flight-planner/types'
import { estimateGsdCmFromParams } from '@/features/flight-planner/utils/flightParamGuidance'

export type ChecklistItemDef = {
  id: string
  label: string
  /** Dica adicional, tipicamente contextual */
  sub?: string
}

export type ChecklistGroup = {
  id: string
  title: string
  items: ChecklistItemDef[]
}

const fmt = (n: number, d: number) => n.toFixed(d).replace('.', ',')

function buildClimaGroup(
  weather: WeatherData | null,
  assessment: FlightAssessment | null,
  params: FlightParams,
  now: Date,
): ChecklistGroup {
  const base: ChecklistItemDef[] = [
    {
      id: 'op-climate-source',
      label: 'Conferi a tendência (radar/app) e não voo debaixo de trovoada ou com vento inseguro no limite de controle do drone.',
    },
  ]
  if (!weather) {
    return {
      id: 'clima',
      title: 'Clima e ambiente de voo',
      items: [
        {
          id: 'clima-no-data',
          label: 'Dados de clima não carregaram para o centro da área — confira o tempo, radar, vento e tempestade no app e na meteorologia local antes de decolar.',
        },
        ...base,
        ...(assessment
          ? assessment.issues.map((t, i) => ({
              id: `asmt-issue-nw-${i}`,
              label: t,
            }))
          : []),
        ...(assessment
          ? assessment.warnings.map((t, i) => ({
              id: `asmt-warn-nw-${i}`,
              label: t,
            }))
          : []),
        ...(assessment
          ? assessment.tips.map((t, i) => ({
              id: `asmt-tip-nw-${i}`,
              label: t,
            }))
          : []),
      ],
    }
  }

  const beau = windSpeedToBeaufort(weather.windSpeedMs)
  const previso = (weather.conditionLabel ?? wmoCodeToConditionPt(weather.weatherCode ?? 0)).trim()
  const hora = now.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return {
    id: 'clima',
    title: 'Clima e ambiente de voo',
    items: [
      {
        id: 'clima-now',
        label: `Resumo: ${previso}; ${fmt(weather.temperatureC, 1)} °C; vento ${fmt(weather.windSpeedMs, 1)} m/s (Beaufort ~${beau}); precipitação ${fmt(weather.rainMmH, 2)} mm/h.`,
        sub: `Amostra: ${hora}. Ajusta ao ponto: altitude planejada ${params.altitudeM} m; compare com a avaliação de vento/rajadas e limites do modelo.`,
      },
      ...base,
      ...(assessment
        ? assessment.issues.map(
            (t, i) =>
              ({
                id: `asmt-issue-${i}`,
                label: t,
                sub: 'Avaliação: bloqueio lógico — corrija antes de confirmar o KMZ com segurança.',
              }) as ChecklistItemDef,
          )
        : []),
      ...(assessment
        ? assessment.warnings.map((t, i) => ({
            id: `asmt-warn-${i}`,
            label: t,
          }))
        : []),
      ...(assessment
        ? assessment.tips.map((t, i) => ({
            id: `asmt-tip-${i}`,
            label: t,
            sub: 'Dica da heurística local; não dispensa o julgamento no local.',
          }))
        : []),
    ],
  }
}

export function buildChecklist(
  params: FlightParams,
  weather: WeatherData | null,
  assessment: FlightAssessment | null,
  now: Date,
): ChecklistGroup[] {
  const gsd = estimateGsdCmFromParams(params)
  return [
    {
      id: 'drone',
      title: 'Drone e controles',
      items: [
        { id: 'dr-firmware', label: 'Aplicativo do fabricante, firmware, mapa de zona e bateria dos controles em dia (sem alertas pendentes).' },
        { id: 'dr-prop', label: 'Hélices sem sinais de dano, parafusos apertados, obstáculo do app calibrado.' },
        { id: 'dr-geo', label: 'Casa, retorno (RTH) e altura de retorno alinhados ao voo; geofence e sinal GNSS com precisão aceitável.' },
        { id: 'dr-same-model', label: `Modelo de simulação na app: ${params.droneModel} (mesmo usado no plano).` },
      ],
    },
    {
      id: 'media',
      title: 'Cartão, bateria e câmera no solo',
      items: [
        { id: 'md-card', label: 'Cartão de memória rápido, vazio o suficiente, gravando sem falhas; backup se for missão longa.' },
        { id: 'md-batt', label: 'Bateria (s) ciclada, sem inchaço; carga e temperatura de partida no manual; bateria reserva (se houver) carregada.' },
        {
          id: 'md-gsd',
          label: `GSD estimado ~${fmt(gsd, 2)} cm/px à altitude de ${params.altitudeM} m; revisar intervalo/velocidade no app para a sobreposição alvo.`,
        },
        { id: 'md-ov', label: `Sobreposições: frontal ${params.forwardOverlap}%, lateral ${params.sideOverlap}%; alinhado ao pós (evitar surpresa no voo).` },
      ],
    },
    {
      id: 'regulacao',
      title: 'Regulamentação (Brasil, referência ANAC)',
      items: [
        {
          id: 'anac-doc',
          label: 'Aeronave, responsável, seguro, registro/numeração e regras de SARPAS/voo a distância conforme o caso; área restringida/NOTAM verificados.',
        },
        {
          id: 'anac-h-limits',
          label: params.altitudeM > 120
            ? `Risco operacional/regularidade: operação alvo acima de 120 m requer autorizações/condições (conforme norma vigente) — ajuste ou alvará.`
            : 'Limite de altura: confirmar 120 m AGL (ou a regulamentação e autorização adicional necessária).',
        },
        { id: 'anac-people', label: 'Afastamento mínimo de pessoas e propriedade alheia; nunca voe sobre multidões; opção de VLOS conforme a operação real.' },
      ],
    },
    {
      id: 'operacao',
      title: 'Operação e segurança no campo',
      items: [
        { id: 'op-rescue', label: 'Plano de emergência (perda de sinal, vento, bateria baixa, obstáculo), observador/ajudante se necessário.' },
        { id: 'op-path', label: 'Faixa de aproximação e aterrissagem claras; animais, tráfego, linhas e torres mapeados.' },
        { id: 'op-weather-eye', label: 'Decisão final de cancelamento no local (visibilidade, nuvens baixas, mudança súbita de condição).' },
      ],
    },
    buildClimaGroup(weather, assessment, params, now),
  ]
}
