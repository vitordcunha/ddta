# Plano de implementação — Voo de calibração, análise de imagens e recomendações inteligentes

> Este documento complementa `plano-frontend.md` e `plano-backend.md`, focando no fluxo
> **Planejamento → Voo-teste → Análise → Recomendação → Plano final / KMZ**.
>
> Princípios:
>
> - **Heurística primeiro, IA depois.** Começamos por métricas clássicas de visão
>   computacional; modelos de IA entram para camadas de valor agregado.
> - **Piloto sempre no controle.** As recomendações são assistivas; nunca “a app
>   aprovou o voo”.
> - **Privacidade:** processar o mínimo de imagem, preferir EXIF + miniaturas.
> - **Entrega incremental:** cada fase deve gerar valor isoladamente.

---

## Visão geral do fluxo

```
[Planner atual] ──► [Modal "Antes de voar" no download do KMZ]
                        │
                        ├─► Checklist estático + contextual (clima/sol/modelo)
                        │
                        └─► Opção: "Fazer voo de calibração"
                                │
                                ▼
                       [KMZ de calibração (reduzido)]
                                │
                                ▼
                       [Voo curto do usuário]
                                │
                                ▼
                       [Upload de amostras ao backend]
                                │
                                ▼
                       [Pipeline de análise (EXIF + OpenCV)]
                                │
                                ▼
                       [Diagnóstico + parâmetros recomendados]
                                │
                                ▼
                       [Plano final ajustado + KMZ definitivo]
```

---

## Fase 0 — Fundações já existentes (status)

Itens **já implementados**, mantidos como base:

- `FlightPlannerConfigPanel` com presets (`FLIGHT_QUALITY_PRESETS`), avisos de configuração (`analyzeFlightConfiguration`) e textos de ajuda por parâmetro.
- `useWeather` + `assessFlightConditions` com `FlightAssessment` (`issues`, `warnings`, `tips`).
- `useKmzExport` (`generateAndDownload`) como ponto de gatilho do fluxo pós-plano.
- `useFlightStore` com `params`, `polygon`, `waypoints`, `stats`, `weather`, `assessment` — fonte única de verdade para todos os módulos seguintes.

**Checkpoint antes de seguir:** consolidar em `docs` internos as heurísticas já em uso (para referência e testes).

---

## Fase 1 — Modal “Antes de voar” (pós-KMZ)

**Objetivo:** transformar o clique em “Baixar KMZ” numa **revisão guiada** antes de levar o plano ao campo.

### Escopo

- Intercepta o clique atual no botão de KMZ. O download só acontece depois do “Confirmar”.
- Janela com três abas:
  1. **Checklist de campo** (lista marcável, persistida por projeto).
  2. **Condições atuais** (resumo de `assessFlightConditions` + posição solar — ver Fase 6).
  3. **Configuração da câmera** (texto condicional ao `droneModel` e preset).
- Ação secundária: **“Fazer voo de calibração”** (abre Fase 2).
- Opção “Não mostrar para este projeto” (persistida em `localStorage`).

### Frontend

- `features/flight-planner/components/PreFlightChecklistModal.tsx`
  - Props: `params`, `weather`, `assessment`, `onConfirmDownload`, `onRequestCalibration`.
  - Radix Dialog (já disponível no projeto).
- `features/flight-planner/utils/preFlightChecklist.ts`
  - `buildChecklist(params, weather, assessment, now): ChecklistGroup[]` com grupos:
    drone, cartão e câmera, bateria, clima, regulação (ANAC), operação.
- `features/flight-planner/utils/cameraGuidance.ts`
  - Regras condicionais por `droneModel` (ex.: shutter mecânico em `Phantom 4 / Mavic 3`, ausência em `Mini`).
  - `computeMinShutterSuggestion({ speedMs, gsdCm }): string` com a regra prática
    `shutter < GSD / velocidade_solo` (texto “comece por ~1/x s; valide em campo”).
- Integração em `FlightPlannerConfigPanel`:
  - substituir `onClick` do botão por abertura do modal;
  - manter atalho “pular e baixar” para usuários avançados (checkbox persistido).

### Backend

- Nenhuma mudança nesta fase.

### Critérios de aceite

- Ao clicar em KMZ, o modal sempre abre (respeitando skip).
- Lista reflete `weather` quando disponível e degrada corretamente sem clima.
- Acessibilidade: foco, `Esc`, tecla `Enter` confirma.
- Testes: unit em `buildChecklist` e `computeMinShutterSuggestion`.

---

## Fase 2 — KMZ de calibração

**Status:** ✅ **Implementado** (KMZ + sessão + grid teórico persistido e devolvido na API; validação manual em app DJI continua fora de escopo).

**Objetivo:** gerar uma **missão curta** para validar câmera e condições antes do voo real.

### Escopo

- Subconjunto da área original:
  - mesma altitude/rotação/velocidade do plano atual,
  - apenas **1–2 faixas centrais** ou **um mini polígono** (ex. 10% da área ou caixa 80 × 80 m no centro),
  - ≥ 5 waypoints para produzir pares com overlap real,
  - duração alvo < ~3 min.
- Gerado no mesmo `kmzBuilder`, mas com flag `variant: 'calibration'`.

### Frontend

- `features/flight-planner/utils/calibrationPlan.ts`
  - `buildCalibrationPolygon(polygon, params)` — recorta área central ou usa faixa.
  - `buildCalibrationStats(...)` para mostrar ao usuário “~X fotos / Y min”.
- `PreFlightChecklistModal` chama esta função e:
  - mostra preview mini do polígono no modal (reaproveita `PlannerMapBaseLayer`);
  - emite KMZ **separado** (sufixo `-calibration.kmz`).
- `useFlightStore`: novo campo `calibrationSessionId: string | null` para correlacionar com a Fase 3.

### Backend

- Endpoint `POST /flight-plans/{id}/calibration-session`
  - cria uma sessão com `id`, `project_id`, `params_snapshot`, `polygon_snapshot`, `created_at`.
  - ✅ Calcula e persiste `theoretical_grid` (JSONB) na criação:
    - usa `params_snapshot` (altitude, overlap, sensor via `DRONE_SENSOR_DB`, focal, `rotationDeg`) e
      `polygon_snapshot` (GeoJSON) para footprints e slots sobre a área de calibração.
    - Estrutura persistida: `theoretical_grid.slots[]` com `{ id, row, col, center_lat, center_lon, footprint_polygon, status, primary_image_id }`.
  - Resposta JSON: `session_id`, `upload_url`, `theoretical_grid` (snake_case; o frontend consome e pode mostrar slots cinza `empty` logo após criar a sessão).

### Algoritmo de grid teórico (backend, novo)

```python
# app/services/calibration/calibration_grid.py

def compute_theoretical_grid(polygon_geojson, params_snapshot) -> list[GridSlot]:
    “””
    Retorna lista de slots com centróide e footprint.
    footprint_w = (sensor_w_mm / focal_mm) * altitude_m   (em metros)
    footprint_h = (sensor_h_mm / focal_mm) * altitude_m
    step_along  = footprint_h * (1 - forward_overlap)
    step_cross  = footprint_w * (1 - side_overlap)
    “””
    ...
```

- Usa dados de `DRONE_SENSOR_DB` (dicionário interno mapeando `droneModel` →
  `{sensor_w_mm, sensor_h_mm, focal_length_mm}`; inicialmente cobre os modelos já
  presentes nos presets do frontend).
- Projeção: converte lat/lon do centróide do polígono para UTM local, aplica grid,
  converte slots de volta para WGS-84. Biblioteca: `pyproj`.
- Tolerância de matching (usada na Fase 3): `tolerance_m = min(footprint_w, footprint_h) * 0.5`.

### Critérios de aceite

- KMZ de calibração abre corretamente em DJI Fly / Pilot 2 (manual, sem validação automatizada).
- Um “Voo de calibração” aparece vinculado ao projeto e pode ser reaberto no histórico.
- Grid teórico é retornado na criação da sessão e exibido no frontend como slots cinza (`CalibrationGridMap` na aba «Voo-teste» e no diálogo de upload quando há polígono de calibração).

---

## Fase 3 — Upload, extração de metadados e mapeamento GPS→Grid

**Status:** ✅ **3a e 3b principais implementados** — upload + EXIF + agregação + recomendações já existiam; acrescentados matching GPS→slot, persistência no grid, resumo `slot_counts` no relatório EXIF e UI do mapa. **Pendências vs texto original:** miniatura dedicada 320×240 (hoje continua miniatura ~1280px para análise de píxeis Fase 4); SSE envia o objeto `theoretical_grid` completo (não um evento separado só `slotUpdates`); GPS via Pillow EXIF (sem `piexif` obrigatório).

**Objetivo:** receber as amostras, já entregar diagnóstico barato só com **EXIF**, e
**atribuir cada foto a um slot do grid teórico** calculado na Fase 2.

### Escopo

- Upload de 5 a 30 imagens por sessão (JPEG). RAW fica para Fase 4.
- Pipeline mínimo **sem abrir pixel**:
  - `ISO`, `ExposureTime`, `FNumber`, `WhiteBalance`, `FocalLength`, `GPSAltitude`,
    `GPSLatitude`, `GPSLongitude`, `DateTimeOriginal`, `Make`, `Model`, `Software`, `Orientation`.
  - Verificações imediatas:
    - **Exposição consistente**: desvio-padrão de `log2(ExposureTime)`, `log2(ISO)`, `FNumber` entre fotos.
    - **Shutter coerente com GSD/velocidade**: compara com recomendação da Fase 1.
    - **White balance automático** vs fixo.
    - **Altitude GPS** vs `params.altitudeM` (sanity).
    - **Intervalo temporal** entre disparos vs overlap planejado.
- **[Novo]** Após extração de EXIF, matching GPS→slot:
  - cada foto é associada ao slot cuja centróide está dentro de `tolerance_m`
    (calculada na Fase 2);
  - uma foto pode cobrir múltiplos slots (overlap), mas é registrada como
    **foto primária** no slot de centróide mais próxima;
  - slots sem nenhuma foto primária = **gap de cobertura** (vermelho no grid).
- **[Novo]** Thumbnail gerado no upload:
  - **Planejado:** 320 × 240 px, JPEG quality 70; preview leve por slot.
  - **Implementado hoje:** miniatura com lado máx. ~1280 px (config) para pipeline EXIF + Fase 4 (histograma/ORB); consentimento no upload cobre miniatura derivada.

### Backend

- `POST /calibration-sessions/{id}/images`
  - multipart com N arquivos (limite por config).
  - Para cada arquivo:
    1. ✅ Extrai EXIF com `pillow` (GPS em IFD GPS quando presente).
    2. ✅ Gera miniatura JPEG (lado máx. configurável, hoje orientada à Fase 4).
    3. ✅ Matching GPS→slot: `assign_image_to_slot(lat, lon, theoretical_grid)` (slot mais próximo dentro de `tolerance_m`; flag «núcleo» se distância ≤ `tolerance_m * 0.5` → colunas `is_primary_core`).
    4. ✅ Persiste `CalibrationImage` com `primary_slot_id` (UUID do slot no JSON), `is_primary_core`, `thumbnail_storage_key`, `exif`, etc.
    5. Imagem original opcional (`store_original`); senão só EXIF + miniatura.
- ✅ Após persistir as imagens, atualiza `theoretical_grid.slots[].status` (`covered` / `gap`) e `primary_image_id` no JSON; `flag_modified` para gravar JSONB.
- Tarefa Celery `analyze_exif_task(session_id)`:
  - agrega métricas globais;
  - ✅ Re-sincroniza estados do grid a partir das imagens e inclui no relatório `exif_report.calibration_grid.slot_counts` (totais por status).
  - Métricas **por slot** com scores de pixel — Fase 4 (não só EXIF).
- SSE `GET .../calibration-sessions/{id}/stream`: payload inclui `theoretical_grid` completo (o cliente atualiza o mapa quando o estado muda).
- Schemas em `schemas/calibration.py`: ✅ `CalibrationSessionDetail` / resposta de criação com `theoretical_grid`. Endpoints REST dedicados `CalibrationImageOut` / `CalibrationSlotOut` — ainda não expostos como lista pública (dados de slot vêm no JSON da sessão).

### Algoritmo de matching GPS→slot (novo)

```python
# app/services/calibration/calibration_grid.py

def assign_image_to_slot(
    gps_lat: float,
    gps_lon: float,
    grid_slots: list[GridSlot],
    tolerance_m: float,
) -> tuple[GridSlot | None, bool]:
    """
    Retorna (slot_mais_próximo, is_primary).
    is_primary = True se a distância ao centróide < tolerance_m * 0.5
    (foto cai no "núcleo" do slot, não só na borda de overlap).
    Retorna (None, False) se a foto está fora de qualquer slot
    (fora do polígono de calibração — descartada da análise de grid).
    """
    ...
```

### Frontend

- `features/flight-planner/components/CalibrationUploadDialog.tsx` (drag & drop).
  - ✅ Ao atualizar sessão (refetch / SSE), `theoretical_grid` atualiza o mapa: verde `covered`, vermelho `gap`, cinza `empty`.
- `hooks/useCalibrationSession.ts` (polling + SSE).
  - ✅ Mescla `theoretical_grid` vindo dos eventos SSE.
- ✅ `features/flight-planner/components/CalibrationGridMap.tsx` (ver Fase 3-A).
- Painel de resultados: verde/amarelo/vermelho por métrica global; **mapa de slots** com cobertura (scores por slot na Fase 4+).

### Dependências

- Backend: `pillow` (EXIF + thumbnail), `pyproj` + `shapely` (grid UTM ↔ WGS-84). `piexif` opcional se no futuro normalizar GPS fora do Pillow.
- Armazenamento: `boto3` já previsto.

### Critérios de aceite

- Upload de 10 fotos termina em < 10 s em rede local.
- Relatório EXIF identifica corretamente auto-exposição (teste com dataset sintético).
- Após upload, cada foto aparece no slot correto do grid (±1 slot de margem aceitável).
- Slots sem foto primária ficam `gap` após o upload (persistido); o frontend reflete após refetch ou no próximo tick do SSE (`theoretical_grid` no payload).
- Nenhuma imagem original é salva sem consentimento explícito (LGPD/RGPD);
  thumbnail pode ser armazenado como dado derivado.

---

## Fase 3-A — Visualização espacial do grid (CalibrationGridMap)

**Status:** 🟡 **Parcial** — componente Leaflet com polígono de calibração + footprints dos slots e cores por estado (`empty` / `covered` / `gap`); integrado na aba «Voo-teste» do `PreFlightChecklistModal` e no `CalibrationUploadDialog`. **Ainda por fazer:** tooltips ricos no hover, painel lateral ao clique, carrossel de fotos, toggle «footprints reais», otimização de re-render por slot, rota standalone `/calibration/{sessionId}`.

**Objetivo:** mostrar ao piloto **onde** estão os problemas, não apenas que eles existem.

### Componente `CalibrationGridMap`

- ✅ Sobrepõe o grid de slots ao mapa **react-leaflet** (mesma família de tiles do planejador).
- ✅ Cada slot é um polígono georreferenciado a partir do `footprint_polygon` (GeoJSON) do backend.

### Estados visuais de um slot

| Estado | Cor | Quando |
|---|---|---|
| `empty` | Cinza (`#9ca3af`) | Sessão criada, ainda sem upload |
| `covered` | Verde (`#22c55e`) | Tem foto primária, ainda sem análise de pixel |
| `gap` | Vermelho (`#ef4444`) | Nenhuma foto GPS-mapeou para este slot |
| `warning` | Amarelo (`#f59e0b`) | Foto existe mas alguma métrica está fora do limiar |
| `critical` | Vermelho escuro (`#991b1b`) | Blur ou clipping grave no slot |
| `best` | Verde escuro (`#15803d`) | Slot com melhor score da sessão |

### Interação

- **Hover**: tooltip com `slot_id`, `n_photos_covering`, score de blur, score de exposição.
- **Click**: abre painel lateral com:
  - thumbnail da foto primária (carregado sob demanda do `thumbnail_key`);
  - todas as fotos secundárias que cobrem o slot (carrossel compacto);
  - métricas individuais: blur, exposição, ISO, shutter, altitude GPS;
  - badge de recomendação quando a Fase 5 tiver processado o slot.
- **Toggle "mostrar footprints"**: exibe o retângulo do footprint real de cada foto
  (não só o slot teórico), ilustrando o overlap visualmente.

### Props

```ts
interface CalibrationGridMapProps {
  polygon: GeoJSON.Polygon;          // polígono do voo de calibração
  slots: CalibrationSlot[];          // do store / SSE
  onSlotClick: (slotId: string) => void;
  highlightSlotId?: string;          // slot em foco (sincronizado com painel lateral)
}
```

### Posicionamento no layout

- ✅ Aba **«Voo-teste»** do `PreFlightChecklistModal` (com sessão ativa) + diálogo de upload no painel.
- Planejado: view standalone em `/calibration/{sessionId}` (não implementada).

### Critérios de aceite

- Grid renderiza sobre o polígono correto sem distorção até zoom 18.
- Slots atualizam cor em tempo real via SSE sem re-renderizar toda a camada.
- Em sessão com 15 fotos e 30 slots, hover é fluido (sem jank).

---

## Fase 4 — Análise de pixel por slot (métricas clássicas de CV)

**Objetivo:** explicar **porque** as fotos estão ruins, **onde no terreno** isso acontece,
e selecionar a foto representativa de cada slot.

### Métricas implementadas (MVP)

Todas computadas **por imagem** e depois agregadas por slot:

| Métrica | Implementação | Indicação para o usuário |
|---|---|---|
| Histograma / clipping | percentis P1/P99 por canal; contagem de pixéis em 0/255 | “X% dos pixéis estouraram no canal vermelho” |
| Desfocagem global | `var(Laplacian)` em patch central (1280 px) | “Desfoque acima do esperado; reduza velocidade ou aumente shutter” |
| Ruído em sombras | desvio-padrão em regiões de baixa luminância | “ISO alto em áreas escuras; desça ISO” |
| Variação inter-imagem | luminância média por foto → desvio no conjunto | “Exposição não travada; use manual” |
| Cobertura / sharpness local | grid interno de patches + `var(Laplacian)` | “Bordas da imagem fora de foco” |
| Contagem de features ORB/AKAZE | overlap de features em pares de slots adjacentes | “Overlap insuficiente para costura” |
| Hot spots / reflexos | blobs brilhantes por luminância | “Reflexos fortes; considere horário ou ângulo” |

### Seleção da foto representativa por slot (novo)

Quando múltiplas fotos cobrem o mesmo slot, a **foto primária exibida no grid** é
escolhida pelo **score composto**:

```python
slot_score(img) = (
    w_blur   * normalize(blur_variance)      # maior = melhor
  + w_exp    * (1 - clipping_ratio)          # menor clipping = melhor
  + w_noise  * (1 - shadow_noise_score)      # menor ruído = melhor
)
# pesos padrão: w_blur=0.5, w_exp=0.3, w_noise=0.2
```

- A melhor foto do slot recebe `is_best_for_slot = True`.
- Score do slot = score da melhor foto (não média — a pior foto do slot não degrada,
  o piloto quer saber se é possível conseguir uma boa foto naquela área).

### Agregação global vs espacial

```
pixel_report
  ├── global_summary          ← média/mediana/desvio de todas as fotos
  └── slot_reports[]
        ├── slot_id
        ├── best_image_id
        ├── best_score
        ├── blur_score        ← da foto primária
        ├── clipping_ratio    ← da foto primária
        ├── shadow_noise      ← da foto primária
        ├── n_photos_covering
        └── feature_overlap_with_neighbors   ← ORB entre slot e adjacentes
```

### Backend

- Novo módulo `backend/app/services/image_quality/`:
  - `exposure.py`, `blur.py`, `consistency.py`, `coverage.py`, `features.py`.
  - Funções puras aceitam `np.ndarray`; fáceis de testar.
- Tarefa Celery `analyze_pixels_task(session_id)`:
  - baixa miniaturas **1280 px** (geradas na Fase 3) — **não re-baixa imagem original**;
  - computa métricas por imagem;
  - **[Novo]** agrega por slot e seleciona `best_image_id`;
  - **[Novo]** calcula `feature_overlap_with_neighbors` usando ORB entre fotos primárias
    de slots adjacentes no grid;
  - grava em `calibration_session.pixel_report`;
  - **[Novo]** emite SSE `{ type: “slot_scored”, slotId, score, status }` a cada slot
    processado — frontend atualiza cor do slot em tempo real.
- Endpoint `GET /calibration-sessions/{id}/report` consolida EXIF + pixel.

### Dependências

- `opencv-python-headless`, `numpy`, `scikit-image`.
- Miniaturas 1280 px: geradas na Fase 3 e reutilizadas aqui (sem novo download).
- Opcional: `imageio` + `rawpy` para RAW (Fase 4.1, se demanda).

### Critérios de aceite

- Dataset de validação com ~50 imagens anotadas (ok / desfocado / superexposto / inconsistente).
- Precisão / recall mínimos documentados por métrica.
- Análise de 15 fotos 1280 px em < 20 s em máquina dev.
- Grid no frontend exibe cor correta para cada slot após análise.
- Slots adjacentes com ORB insuficiente são marcados como `warning` no grid.

---

## Fase 5 — Motor de recomendações com consciência espacial

**Objetivo:** transformar métricas + plano atual em **ajustes concretos**, incluindo
recomendações que levam em conta **onde no terreno** o problema ocorreu.

### Regras globais (sem mudança)

- **Clipping em realces alto + shutter já rápido + ISO base** → sugerir **ND** (caso raro e explicitado).
- **Clipping em realces + shutter lento** → subir shutter antes de pensar em ND.
- **Desfoque acima do limiar** → aumentar shutter, baixar velocidade do drone ou reforçar aviso de vento.
- **Variação de exposição > N EV** → alertar que está em automático.
- **Features ORB insuficientes entre pares adjacentes** → sugerir subir `forwardOverlap` e/ou baixar altitude.
- **Altitude GPS inconsistente** → recomendar `terrain-follow` ou revisar ponto de decolagem.
- **Ruído em sombras + ISO alto** → reduzir ISO (se shutter permitir) ou voar com luz melhor.

### Regras espaciais (novas)

Analisam **padrões no grid** para diagnósticos que métricas globais não capturam:

| Padrão espacial | Diagnóstico | Recomendação |
|---|---|---|
| Slots ruins concentrados numa borda do grid | Desfoque / exposição piora numa direção | “Problema concentrado na borda {N/S/L/O}. Pode ser sombra, reflexo ou vento lateral. Considere ajustar direção das faixas.” |
| Slots ruins em faixas alternadas | Exposição oscila entre faixas | “Padrão inter-faixa indica AutoExposure compensando mudança de curso. Use modo manual.” |
| Slots gap (sem foto) em área coberta pelo plano | Lacuna de cobertura | “X slots sem foto na área central. Revise ponto de ativação do obturador ou aumente overlap.” |
| Desfoque piora progressivamente da esquerda para direita | Movimento relativo ao sol | “Desfoque cresce na direção {L→O}. Pode ser contra-luz em metade do percurso. Considere voar em horário diferente.” |
| ORB baixo em todos os pares de uma faixa | Feature starvation naquela superfície | “Faixa {n} tem pouca textura (água / solo homogêneo?). Aumente overlap lateral nesta área.” |
| Todos os gaps no mesmo lado | Drone não chegou até a borda | “Cobertura incompleta na borda {N/S/L/O}. Verifique margem do polígono de calibração.” |

### Estrutura

- `services/recommendation_engine.py` no backend:
  - entrada: `params`, `weather` (opcional), `exif_report`, `pixel_report` (inclui `slot_reports`).
  - saída: lista `Recommendation { kind, severity, text, paramChanges?, affectedSlots? }`.
  - **[Novo]** `affectedSlots: string[]` — IDs dos slots relacionados à recomendação;
    o frontend destaca esses slots no grid ao selecionar a recomendação.
- `paramChanges` descreve um diff aplicável no `FlightParams` / câmera.
- **[Novo]** `services/spatial_pattern_detector.py`:
  - recebe `slot_reports[]` com coordenadas e scores;
  - detecta os padrões da tabela acima usando análise de gradiente espacial
    (blur_score por coluna/linha do grid → Pearson correlation com posição X/Y);
  - retorna lista de `SpatialPattern { type, confidence, affectedSlots, axis? }`.

### Frontend

- `PreFlightChecklistModal` ganha aba **”Resultado do voo-teste”** quando há sessão vinculada.
  - **[Novo]** Layout da aba:
    - Metade superior: `CalibrationGridMap` (da Fase 3-A) com slots coloridos por score.
    - Metade inferior: lista de recomendações.
    - Ao clicar numa recomendação com `affectedSlots`, o grid destaca esses slots
      com borda pulsante e centraliza o mapa neles.
- Botão “Aplicar sugestões ao plano” faz `setParams(...)` nos campos que já existem no store.
- Sugestões de câmera ficam como **texto** (não há estado interno para ISO/shutter).
- **[Novo]** Badge no grid: cada slot pode exibir um ícone de severidade
  (`⚠` warning, `✕` critical) derivado das recomendações espaciais.

### Critérios de aceite

- Dataset de regressão: N casos simulados, cada um deve acionar a recomendação esperada (tabela de teste).
- Recomendações sempre vêm com **justificativa** (“porque 18% dos pixéis do céu estão saturados”).
- **[Novo]** Recomendações espaciais: ao clicar, os slots afetados são destacados no grid.
- **[Novo]** Testes de padrão espacial com grids sintéticos (ex.: blur crescente da esquerda
  para direita) devem acionar a regra correta com `confidence > 0.7`.

---

## Fase 6 — Contexto solar e horário

**Objetivo:** melhorar sugestões sem depender de upload.

### Escopo

- Calcular posição solar (elevação / azimute) para:
  - centroide do polígono,
  - data/hora atual e por hora nas próximas 24 h.
- Integrar no painel e no modal pré-voo:
  - “Nas próximas 2 h, sol abaixo de 20° — sombras longas.”
  - “Janela ideal estimada: 10h–14h (sol alto, céu previsto parcialmente nublado).”
- Recomendação de ND contextual:
  - **Sol alto + céu limpo + modelo sem shutter mecânico** → “ND leve pode ajudar, valide com voo-teste.”
  - **Céu encoberto** → “ND provavelmente desnecessário.”

### Frontend

- `features/flight-planner/utils/solarPosition.ts` (NOAA ou `suncalc`).
- Novo card no painel principal: **“Janela de voo estimada”**.

### Backend

- Opcional: endpoint de utilidade `GET /solar-position?lat&lon&hours=24` (cache).
- Como `suncalc` é leve, pode rodar no frontend sem backend.

### Critérios de aceite

- Cálculo bate com referência NOAA dentro de ±1° nos testes.
- Mensagens não se contradizem com a análise de pixel quando ambas existem.

---

## Fase 7 — Camada de IA (explicação + classificação)

**Objetivo:** enriquecer, não substituir o motor de regras.

### Sub-fase 7.1 — Classificador de cena / superfície

- Modelo leve (MobileNet / EfficientNet quantizado) identifica:
  - vegetação densa, água, solo exposto, urbano, cultura homogênea, neve/areia.
- Ajusta heurísticas:
  - **água** → overlap maior + ND raramente útil + atenção a reflexos;
  - **cultura homogênea** → overlap muito alto recomendado;
  - **urbano com vidros** → evitar CPL, cuidado com hot spots.

### Sub-fase 7.2 — LLM multimodal (explicação)

- Gera parágrafo em linguagem natural a partir do `report`.
- Executa apenas depois do motor de regras (não decide, só explica).
- Feature flag + rate limit + redaction de EXIF sensível.

### Sub-fase 7.3 — Métricas perceptuais sem treino

- **NIQE / BRISQUE** para qualidade perceptual geral.
- **Dehazing score** estimado por contraste global.

### Critérios de aceite

- IA desligada por padrão em self-host; ativável por configuração.
- Nenhuma recomendação da IA sobrescreve regra determinística.

---

## Fase 8 — Pós-MVP / evoluções

- **Voos com GCP / checkpoints** integrados ao fluxo.
- **Terrain following** baseado em DEM (SRTM / Copernicus).
- **Feedback loop**: usuário marca “gostei / não gostei” da recomendação; estatísticas ajustam pesos.
- **Perfil por equipamento**: usuário salva câmera customizada (sensor, shutter mecânico, pixel pitch).
- **Histórico de voos** com comparação entre sessões.
- **Exportação de relatório PDF** da calibração.

---

## Modelos de dados (alto nível)

### Novos (backend)

```
CalibrationSession
  id: UUID
  project_id: UUID
  flight_plan_id: UUID (snapshot em params_snapshot)
  params_snapshot: JSONB
  polygon_snapshot: JSONB (GeoJSON)
  weather_snapshot: JSONB (opcional)
  theoretical_grid: JSONB          ← [novo] lista de GridSlot gerada na criação
  status: enum(pending, uploading, analyzing, ready, failed)
  created_at, updated_at

GridSlot                           ← ✅ embutido em `theoretical_grid` JSONB (não tabela separada)
  id: UUID
  session_id: UUID
  col: int                         ← índice de coluna no grid (para detectar padrões espaciais)
  row: int                         ← índice de linha no grid
  center_lat: float
  center_lon: float
  footprint_polygon: JSONB (GeoJSON Polygon)
  status: enum(empty, covered, gap, warning, critical)
  primary_image_id: UUID | null
  best_score: float | null
  blur_score: float | null
  clipping_ratio: float | null
  shadow_noise: float | null
  feature_overlap_score: float | null   ← ORB vs slots adjacentes
  recommendations: JSONB           ← recomendações específicas deste slot

CalibrationImage
  id, session_id
  filename, storage_key, size_bytes
  thumbnail_storage_key: string   ← miniatura (hoje ~1280px max side para Fase 4)
  primary_slot_id: string | null   ← ✅ UUID do slot em `theoretical_grid.slots[].id`
  is_primary_core: bool | null      ← ✅ True se GPS cai no «núcleo» do slot (dist ≤ tol/2)
  (planejado) thumbnail preview 320×240, is_best_for_slot — Fases 3–4
  exif: JSONB
  metrics: JSONB
  created_at

CalibrationReport
  session_id (PK/FK)
  exif_summary: JSONB
  pixel_summary: JSONB
  slot_reports: JSONB              ← [novo] array de scores por slot (denormalizado para leitura rápida)
  spatial_patterns: JSONB          ← [novo] padrões detectados pelo spatial_pattern_detector
  recommendations: JSONB
  generated_at
```

### Store frontend

- `useCalibrationStore` (novo) paralelo ao `useFlightStore`, para não inflar o store principal.
- Chave persistida por `projectId`.
- **[Novo]** campos adicionais:
  ```ts
  interface CalibrationStore {
    sessionId: string | null;
    gridSlots: CalibrationSlot[];          // atualizado via SSE
    selectedSlotId: string | null;         // slot clicado no grid
    highlightedSlotIds: string[];          // slots de uma recomendação em foco
    report: CalibrationReport | null;
  }
  ```

---

## Diretrizes transversais

### Segurança / privacidade

- Consentimento antes de armazenar qualquer imagem.
- Opção **“análise volátil”** (imagens apagadas após a análise).
- Hash + EXIF GPS opcionais podem ser removidos antes do armazenamento.

### Observabilidade

- Métricas Prometheus: tempo por tarefa Celery, falhas de análise, taxa de “skip”.
- Logs estruturados em `session_id`.

### UX

- Toda recomendação mostra:
  - gravidade,
  - justificativa curta,
  - ação sugerida (botão quando aplicável ao store).
- Consistência entre modal pré-voo e painel lateral (mesmos componentes).

### Testes

- Dataset sintético com casos conhecidos (pasto homogêneo, água, sol raso, ISO alto...).
- Testes de snapshot do `recommendation_engine` para evitar regressões quando ajustarem pesos.

### Performance

- Análise pixel com miniaturas 1280 px (suficiente e barato).
- Backpressure: fila limita N sessões simultâneas por workspace.
- Tarefas idempotentes; permite re-análise sem perder custo de upload.

---

## Roadmap sugerido (ordem e dependências)

> ✅ = já implementado · 🟡 = parcial

1. ✅ **Fase 1** (modal pré-KMZ).
2. ✅ **Fase 6** (posição solar).
3. ✅ **Fase 2** (KMZ calibração + `compute_theoretical_grid` + `DRONE_SENSOR_DB` em `app/services/calibration/calibration_grid.py`, coluna `theoretical_grid`, migração `009_calibration_theoretical_grid`).
4. ✅ **Fase 3** (upload + EXIF + matching GPS→slot) — depende da Fase 2.
   - Sub-entregável 3a: ✅ upload + EXIF (diagnóstico + relatório; métricas globais).
   - Sub-entregável 3b: ✅ matching + estados no JSON + `CalibrationGridMap` básico (coberto/gap).
5. 🟡 **Fase 3-A** (visualização rica do grid) — base feita com 3b; refinamentos (hover, clique, footprints DJI, rota dedicada) pendentes; integração completa com recomendações espaciais na **Fase 5**.
6. **Fase 4** (pixel por slot + seleção da foto representativa) — depende da Fase 3b.
7. **Fase 5** (motor de recomendações + spatial pattern detector) — depende das Fases 3 e 4.
8. **Fase 7** (IA) — só faz sentido depois que o motor de regras estiver estável.
9. **Fase 8** (evoluções) — contínuo.

---

## Marcos de valor entregue

- ✅ **Após Fase 1+6:** usuário já sente o ganho — checklist inteligente, melhor janela de voo, menos erros bobos.
- ✅ **Após Fase 3a (atual):** EXIF + heurísticas globais (exposição, shutter vs GSD, WB, altitude GPS, intervalo vs overlap planejado, etc.).
- ✅ **Após Fase 2+3b (atual):** mapa de **cobertura por slot** (cinza / verde / vermelho) no modal pré-voo e no upload; contagens `slot_counts` no relatório EXIF após a fila Celery.
- 🟡 **Fase 3-A completa:** hover/clique/preview por slot e rota standalone — ainda em aberto; quando fechado, fecha o ciclo «buracos no terreno» sem depender da Fase 4.
- **Após Fase 4:** cada slot do grid tem score visual; piloto sabe exatamente **onde** re-voar.
- **Após Fase 5:** recomendações espaciais (“borda norte tem desfoque → vento lateral”) transformam o grid num diagnóstico acionável; diferencial competitivo real.
- **Após Fase 7:** explicação em linguagem natural e adaptação por tipo de cena.
