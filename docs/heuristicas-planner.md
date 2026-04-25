# Heurísticas do planejador de voo (referência interna)

Resumo do que já está em código, alinhado ao fluxo *Planejamento → Voo-teste* (`plano-voo-teste.md`).

## Fonte de estado

- **`useFlightStore`**: `params`, `polygon`, `waypoints`, `strips`, `stats`, `weather`, `assessment`, `isCalculating`, `routeStartRef`, modo e camada de mapa. A persistência local de rascunho (`flightPlanDraftStorage`) inclui `polygon`, `params`, `waypoints`, `stats`, `weather`, `assessment` por `projectId`.

## Presets de qualidade de voo

- Arquivo: `app/src/features/flight-planner/utils/flightParamGuidance.ts`, constante **`FLIGHT_QUALITY_PRESETS`**: `draft`, `balanced`, `high` (rótulo, `short`, e subconjunto de `FlightParams`: altitude, sobreposições, velocidade).
- **`detectActiveQualityPreset`**: se os quatro campos batem com um preset, o painel destaca o botão correspondente.
- **`presetParamsFor`**: aplica os valores de um preset.

## Avisos de configuração (`analyzeFlightConfiguration`)

- Entrada: `params` e opcionalmente `stats` (`gsdCm`, `estimatedPhotos`).
- GSD de referência: com `stats` usa o GSD da área; senão `estimateGsdCmFromParams` (via `calculateGsd` + `getDroneSpec`).
- Regras principais (não exaustivo):
  - Sobreprosição frontal/lateral: erros/avisos abaixo de ~70%, diferença grande entre frontal e lateral, sobreposição muito alta.
  - Velocidade altíssima com baixa frontal; combinação “rápido e baixo” (alto/≤60 m, vel ≥14).
  - Altitude fora de faixas (≥220 m, ≤40 m) e velocidade perto de `maxSpeedMs` do `DroneSpec`.
  - GSD grosseiro (>3,5 cm/px) e volume de fotos muito grande com GSD fino.
- Saída: `FlightConfigNotice[]` com `severity` `error` | `warning` | `info` e `text`; deduplica por texto.

## Clima e decisão de voo (`assessFlightConditions`)

- Arquivo: `app/src/features/flight-planner/utils/weatherHelpers.ts`.
- Entrada: `WeatherData`, `droneModel`, `altitudeM` (o hook `useWeather` fornece `weather` + chama a avaliação com altitude do plano).
- Usa `getDroneSpec` para `maxSpeedMs` e janela de operação lógica.
- **Issues (bloqueiam `go`)**: vento/rajadas acima de frações de `maxSpeedMs` (limiares ~0,6 e ~0,72 do máximo de fabricante); trovoada (WMO ≥95); chuva significativa; chuva no momento em código ≥61.
- **Avisos**: vento/rajadas moderados; chuvisco leve; muito nublado; altitude >120 m (autorizações); previsão de alta probabilidade de chuva (primeiras 6h da série horária).
- **Dicas**: probabilidade moderada de chuva; nível de Beaufort estimado; lembrete bateria/home.
- `go === true` quando `issues.length === 0` (os avisos e dicas não anulam `go` sozinhos, mas o UI mostra tudo).

## Export KMZ

- **Hook** `useKmzExport` (`app/src/features/flight-planner/hooks/useKmzExport.ts`): `generateKmz` em `kmzBuilder` com `projectName` e `params`; download via blob URL, nome de arquivo `*-flight-plan.kmz` (pós Fase 1, o fluxo pode abrir o modal antes deste passo).

## Modelos e hardware (`DroneSpec`)

- Arquivo: `app/src/features/flight-planner/utils/droneSpecs.ts` — GSD, tempos e limites vêm de sensor, focal, resolução e `maxSpeedMs`/`batteryTimeMin` por `DroneModel`.

## Princípios do plano (produto)

- Heurística e métricas clássicas em primeiro lugar; sugestões são **assistivas**; validação de campo (DJI, regulamentação) permanece com o operador (ANAC, espaço aéreo, SARPAS, etc.).
