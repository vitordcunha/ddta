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
  - cria uma sessão vazia com `id`, `project_id`, `params_snapshot`, `created_at`.
  - Retorna `{ sessionId, uploadUrl }`.

### Critérios de aceite

- KMZ de calibração abre corretamente em DJI Fly / Pilot 2 (manual, sem validação automatizada).
- Um “Voo de calibração” aparece vinculado ao projeto e pode ser reaberto no histórico.

---

## Fase 3 — Upload e extração de metadados

**Objetivo:** receber as amostras e já entregar diagnóstico barato só com **EXIF**.

### Escopo

- Upload de 5 a 30 imagens por sessão (JPEG). RAW fica para Fase 4.
- Pipeline mínimo **sem abrir pixel**:
  - `ISO`, `ExposureTime`, `FNumber`, `WhiteBalance`, `FocalLength`, `GPSAltitude`,
    `DateTimeOriginal`, `Make`, `Model`, `Software`, `Orientation`.
  - Verificações imediatas:
    - **Exposição consistente**: desvio-padrão de `log2(ExposureTime)`, `log2(ISO)`, `FNumber` entre fotos.
    - **Shutter coerente com GSD/velocidade**: compara com recomendação da Fase 1.
    - **White balance automático** vs fixo.
    - **Altitude GPS** vs `params.altitudeM` (sanity).
    - **Intervalo temporal** entre disparos vs overlap planejado.
- Resultado já é suficiente para diagnósticos valiosos (exposição inconstante = causa mais comum de datasets ruins).

### Backend

- `POST /calibration-sessions/{id}/images`
  - multipart com N arquivos (limite por config).
  - Persiste apenas EXIF e caminho S3/local; imagem original opcionalmente apagada após análise (política configurável).
- Tarefa Celery `analyze_exif_task(session_id)`:
  - agrega métricas;
  - grava em `calibration_session.exif_report`;
  - emite evento SSE para o frontend.
- Schemas Pydantic em `schemas/calibration.py`.

### Frontend

- `features/flight-planner/components/CalibrationUploadDialog.tsx` (drag & drop).
- `hooks/useCalibrationSession.ts` (polling + SSE quando disponível).
- Exibir painel de resultados simples (verde/amarelo/vermelho por métrica).

### Dependências

- Backend: `exifread` ou `pyexiv2` (ou já usar `pillow` para EXIF básico).
- Armazenamento: reaproveitar caminho já previsto no `boto3`.

### Critérios de aceite

- Upload de 10 fotos termina em < 10 s em rede local.
- Relatório EXIF identifica corretamente auto-exposição (teste com dataset sintético).
- Nenhuma imagem é salva sem consentimento explícito (LGPD/RGPD).

---

## Fase 4 — Análise de pixel (métricas clássicas de CV)

**Objetivo:** explicar **porque** as fotos estão ruins, não só o que o EXIF diz.

### Métricas implementadas (MVP)

| Métrica | Implementação proposta | Indicação para o usuário |
|---|---|---|
| Histograma / clipping | percentis P1/P99 por canal; contagem de pixéis em 0/255 | “X% dos pixéis estouraram no canal vermelho” |
| Desfocagem global | `var(Laplacian)` em patch central | “Desfoque acima do esperado; reduza velocidade ou aumente shutter” |
| Ruído em sombras | desvio-padrão em regiões de baixa luminância | “ISO alto em áreas escuras; desça ISO” |
| Variação inter-imagem | luminância média por foto → desvio no conjunto | “Exposição não travada; use manual” |
| Cobertura / sharpness local | grid de patches + `var(Laplacian)` por patch | “Bordas da imagem fora de foco” |
| Contagem de features ORB/AKAZE | overlap de features em pares adjacentes | “Overlap insuficiente para costura” |
| Hot spots / reflexos | detecção de blobs brilhantes por luminância | “Reflexos fortes; considere horário ou ângulo” |

### Backend

- Novo módulo `backend/app/services/image_quality/`:
  - `exposure.py`, `blur.py`, `consistency.py`, `coverage.py`, `features.py`.
  - Funções puras aceitam `np.ndarray`; fáceis de testar.
- Tarefa Celery `analyze_pixels_task(session_id)`:
  - baixa miniaturas 1280 px (suficiente para métricas e barato);
  - agrega resultado em `calibration_session.pixel_report`.
- Endpoint `GET /calibration-sessions/{id}/report` consolida EXIF + pixel.

### Dependências

- `opencv-python-headless`, `numpy`, `scikit-image` (para `measure` e filtros).
- Opcional: `imageio` para RAW via `rawpy` (Fase 4.1, se houver demanda).

### Critérios de aceite

- Dataset de validação com ~50 imagens anotadas (ok / desfocado / superexposto / inconsistente).
- Precisão / recall mínimos documentados por métrica.
- Análise de 15 fotos 1280 px em < 20 s em máquina dev.

---

## Fase 5 — Motor de recomendações

**Objetivo:** transformar métricas + plano atual em **ajustes concretos**.

### Regras (exemplos, não exaustivo)

- **Clipping em realces alto + shutter já rápido + ISO base** → sugerir **ND** (caso raro e explicitado).
- **Clipping em realces + shutter lento** → subir shutter antes de pensar em ND.
- **Desfoque acima do limiar** → aumentar shutter, baixar velocidade do drone ou reforçar aviso de vento.
- **Variação de exposição > N EV** → alertar que está em automático.
- **Features ORB insuficientes entre pares adjacentes** → sugerir subir `forwardOverlap` e/ou baixar altitude.
- **Altitude GPS inconsistente** → recomendar `terrain-follow` ou revisar ponto de decolagem.
- **Ruído em sombras + ISO alto** → reduzir ISO (se shutter permitir) ou voar com luz melhor.

### Estrutura

- `services/recommendation_engine.py` no backend:
  - entrada: `params`, `weather` (opcional), `exif_report`, `pixel_report`.
  - saída: lista `Recommendation { kind, severity, text, paramChanges? }`.
- `paramChanges` descreve um diff aplicável no `FlightParams` / câmera (texto + valores quando cabem no modelo).

### Frontend

- `PreFlightChecklistModal` ganha aba **“Resultado do voo-teste”** quando há sessão vinculada.
- Botão “Aplicar sugestões ao plano” faz `setParams(...)` nos campos que já existem no store.
- Sugestões de câmera ficam como **texto** (não há estado interno para ISO/shutter).

### Critérios de aceite

- Dataset de regressão: N casos simulados, cada um deve acionar a recomendação esperada (tabela de teste).
- Recomendações sempre vêm com **justificativa** (“porque 18% dos pixéis do céu estão saturados”).

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
  status: enum(pending, uploading, analyzing, ready, failed)
  created_at, updated_at

CalibrationImage
  id, session_id
  filename, storage_key, size_bytes
  exif: JSONB
  metrics: JSONB
  created_at

CalibrationReport
  session_id (PK/FK)
  exif_summary: JSONB
  pixel_summary: JSONB
  recommendations: JSONB
  generated_at
```

### Store frontend

- `useCalibrationStore` (novo) paralelo ao `useFlightStore`, para não inflar o store principal.
- Chave persistida por `projectId`.

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

1. **Fase 1** (modal pré-KMZ) — 1–2 sprints, autossuficiente.
2. **Fase 6** (posição solar) — pode ir em paralelo à Fase 1.
3. **Fase 2** (KMZ calibração) — depende da Fase 1.
4. **Fase 3** (upload + EXIF) — depende da Fase 2; começa a dar valor sozinho.
5. **Fase 4** (pixel) — depende da Fase 3.
6. **Fase 5** (motor de recomendação) — usa saída das Fases 3 e 4.
7. **Fase 7** (IA) — só faz sentido depois que o motor de regras estiver estável.
8. **Fase 8** (evoluções) — contínuo.

---

## Marcos de valor entregue

- **Após Fase 1+6:** usuário já sente o ganho — checklist inteligente, melhor janela de voo, menos erros bobos.
- **Após Fase 3:** só com EXIF já capturamos ~70% dos problemas comuns (auto-exposição, shutter lento, altitude inconsistente).
- **Após Fase 4+5:** plataforma passa a “ensinar” o piloto; diferencial competitivo real.
- **Após Fase 7:** explicação em linguagem natural e adaptação por tipo de cena.
