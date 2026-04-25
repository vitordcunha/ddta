# Estudo Tecnico - DroneData Platform

**Data:** 2026-04-24
**Escopo:** Validacao de waypoints/rotacao, voo de calibracao, sugestoes de melhorias

---

## 1. WAYPOINTS, ROTACAO E QUALIDADE DO MAPEAMENTO

### 1.1 A quantidade de waypoints afeta a qualidade?

**Resposta curta: Nao diretamente.** A qualidade do mapeamento depende de:

| Fator                       | Impacto na qualidade                | Relacao com waypoints |
| --------------------------- | ----------------------------------- | --------------------- |
| **GSD (resolucao no solo)** | Direto - quanto menor, mais detalhe | Nenhuma               |
| **Overlap (sobreposicao)**  | Direto - garante reconstrucao 3D    | Nenhuma               |
| **Cobertura total da area** | Direto - areas sem foto = buracos   | Indireta              |
| **Estabilidade da foto**    | Direto - blur = perda de detalhe    | Nenhuma               |
| **Numero de waypoints**     | Indireto                            | -                     |

Waypoints sao apenas **pontos de navegacao** (curvas do serpentine). O drone tira fotos **entre** os waypoints, em intervalos calculados pelo `photoSpacing`. Entao:

- **Menos waypoints = menos curvas = menos faixas = MESMA cobertura** (desde que o overlap seja mantido)
- O que muda e a **eficiencia**: menos curvas = menos tempo parado girando = voo mais rapido

### 1.2 O problema da rotacao diagonal

Analisando suas screenshots:

| Metrica   | Rotacao 0 (diagonal) | Rotacao 26 (vertical) |
| --------- | -------------------- | --------------------- |
| Waypoints | 18                   | 14                    |
| Faixas    | 9                    | 7                     |
| Fotos     | 98                   | 98                    |
| Tempo     | 6 min                | 5 min                 |
| Distancia | 1,73 km              | 1,60 km               |

**Conclusao:** Com rotacao 26 voce obteve:

- **-22% waypoints** (14 vs 18)
- **-22% faixas** (7 vs 9)
- **Mesma quantidade de fotos** (98)
- **-17% tempo** (5 vs 6 min)
- **-8% distancia** (1,60 vs 1,73 km)

Isso acontece porque o poligono da sua area tem o eixo longo alinhado ~26 graus. Quando voce voa com rotacao 0, as faixas cortam o poligono "na diagonal" em relacao ao formato dele, gerando faixas mais curtas e mais numerosas. Com 26, as faixas ficam alinhadas ao eixo longo, resultando em faixas mais longas e menos curvas.

### 1.3 Analise do codigo atual (`waypointCalculator.ts`)

O algoritmo de geracao de rota funciona assim:

```
1. Recebe poligono + rotationDeg
2. Rotaciona o poligono por -rotationDeg (desrotaciona)
3. Gera linhas verticais paralelas no espaco desrotacionado
4. Calcula intersecoes das linhas com o poligono
5. Rotaciona tudo de volta por +rotationDeg
6. Alterna direcao das faixas (serpentine/lawnmower)
```

**Problemas identificados:**

#### Problema 1: Nao existe otimizacao automatica do angulo

O usuario precisa manualmente ajustar a rotacao. O codigo em `waypointCalculator.ts` aceita `rotationDeg` como parametro fixo - nao ha nenhuma funcao que teste multiplos angulos e escolha o melhor.

**Solucao proposta - Auto-rotate:**

```
Para cada angulo de 0 a 175 (passo de 5):
  1. Gerar grid
  2. Calcular distancia total
  3. Calcular numero de faixas
Escolher o angulo com menor distancia total
```

Uma abordagem mais eficiente: calcular o **Minimum Bounding Rectangle (MBR)** do poligono. O angulo otimo e o angulo do eixo longo do MBR. Turf.js ja tem funcoes para isso.

#### Problema 2: Otimizacao de inicio considera apenas 4 combinacoes

A funcao `optimizeFlightPlanStart()` (linha 133-164) testa apenas:

- LTR vs RTL (esquerda-direita vs direita-esquerda)
- Forward vs Reverse (percurso normal vs invertido)

**Nao testa angulos diferentes.** Se o usuario esta ao sul da area, mas a rotacao gera o primeiro waypoint ao norte, a otimizacao apenas inverte a ordem - nao considera que rotacionar 180 graus poderia ser identico mas com inicio mais proximo.

**Solucao proposta:**

1. Calcular MBR para angulo otimo base
2. Testar angulo otimo + angulo otimo + 90 (ambas orientacoes do MBR)
3. Para cada angulo, testar as 4 combinacoes atuais (LTR/RTL x Forward/Reverse)
4. Escolher a combinacao com menor distancia ate o usuario

#### Problema 3: Nao considera direcao do vento

Voar contra o vento em cada faixa vs perpendicular ao vento tem impacto em:

- Consumo de bateria
- Estabilidade da foto (vento lateral causa drift)
- Tempo de voo

**Solucao proposta:** Quando dados de vento estao disponiveis (ja temos via Open-Meteo), ponderar o angulo otimo entre:

- Formato da area (MBR) - peso 60%
- Direcao do vento (perpendicular) - peso 25%
- Posicao do usuario - peso 15%

### 1.4 Recomendacao final sobre waypoints

| Situacao                | Recomendacao                                             |
| ----------------------- | -------------------------------------------------------- |
| Area retangular simples | Alinhar faixas ao eixo longo (auto-rotate resolve)       |
| Area irregular/em L     | Auto-rotate por MBR e ajuste fino pelo usuario           |
| Vento forte (>5 m/s)    | Alinhar faixas paralelas ao vento                        |
| Area grande (>10 ha)    | Priorizar menor numero de faixas para economizar bateria |
| Area pequena (<2 ha)    | Angulo quase nao importa, diferenca sera minima          |

---

## 2. VOO DE CALIBRACAO

### 2.1 Arquitetura atual

O sistema de calibracao tem 5 fases:

```
Fase 1: Planejamento do mini-voo (frontend - calibrationPlan.ts)
   |
Fase 2: Geracao do grid teorico (backend - calibration_grid.py)
   |
Fase 3: Upload de fotos + atribuicao aos slots (backend)
   |
Fase 4a: Analise EXIF (Celery task)
Fase 4b: Analise de pixels (Celery task)
   |
Fase 5: Motor de recomendacoes (backend - recommendation_engine.py)
```

### 2.2 Fase 1 - Planejamento do mini-voo

**Como funciona (`calibrationPlan.ts`):**

1. Calcula `sideM = sqrt(area_total * 0.11)` (~10% da area)
2. Limita entre 80m e 140m de lado
3. Itera ate 28 vezes ajustando tamanho:
   - Cria quadrado centrado no centroide do poligono
   - Intersecta com o poligono da missao
   - Verifica se tem >= 5 waypoints e duracao < 3.2 min
   - Se poucos pontos: aumenta 14%; se muito longo: reduz 14%
4. Retorna melhor tentativa

**Status: Funcional**, mas com limitacoes:

- Sempre centra no centroide (pode nao ser a area mais representativa)
- Nao considera heterogeneidade do terreno (agua, sombra, vegetacao)
- O tamanho fixo de ~10% pode ser insuficiente para areas muito grandes

### 2.3 Fase 2 - Grid teorico

**Como funciona (`calibration_grid.py`):**

1. Converte poligono para UTM (precisao metrica)
2. Calcula dimensoes do footprint: `footprint_w = (sensor_mm / focal_mm) * altitude_m`
3. Calcula step: `step_along = footprint_h * (1 - forward_overlap)`
4. Itera em 2D (along x cross) criando slots retangulares
5. Cada slot tem: centro lat/lon, poligono do footprint, row/col, status

**Status: Funcional e correto.** A subdivisao em grid esta matematicamente correta.

### 2.4 Fase 3 - Upload e atribuicao

**Como funciona:**

1. Valida: consentimento LGPD, 5-30 JPEGs, max 20 MB cada
2. Extrai EXIF: GPS, ISO, exposicao, f-number, WB
3. Para cada foto, encontra slot mais proximo por Haversine
4. Se distancia <= tolerance_m (~5m): atribui ao slot
5. Gera thumbnails (1280px para analise, 320px para preview)
6. Enfileira tasks asincronas

**Status: Funcional.**

### 2.5 Fase 4a - Analise EXIF

**Metricas extraidas:**

- `exposure_consistency`: Detecta auto-exposicao (variancia alta nos tempos de exposicao)
- `shutter_vs_motion`: Risco de motion blur (velocidade shutter vs parametros de voo)
- `gps_altitude`: Desvio de altitude em relacao ao plano
- `white_balance`: Deteccao de WB manual vs automatico

**Status: Funcional.**

### 2.6 Fase 4b - Analise de pixels

**Analises realizadas:**

- **Variancia Laplaciana**: Deteccao de blur (foco e motion blur)
- **Histograma de clipping**: Superexposicao (canais saturados em 255)
- **Ruido em sombras**: ISO alto causando banding
- **ORB feature matching**: Sobreposicao de features entre imagens adjacentes
- **Agregacao por slot**: Melhor imagem, blur score, clipping, cobertura

**Status: Funcional**, mas com pontos de atencao:

- A analise usa thumbnails de 1280px (nao imagem completa) - pode perder detalhes finos
- ORB matching entre pares adjacentes pode ser lento com muitas imagens
- Nao ha deteccao de textura homogenea (areas de agua/areia que confundem ODM)

### 2.7 Fase 5 - Recomendacoes

**Recomendacoes produzidas (rule-based, nao ML):**

| Tipo            | Trigger                       | Acao sugerida                              |
| --------------- | ----------------------------- | ------------------------------------------ |
| `exposure`      | Clipping alto + shutter lento | Aumentar velocidade shutter                |
| `exposure_auto` | Variancia alta de exposicao   | Usar modo manual (M) ou semi-auto          |
| `motion`        | Laplacian < 20 (blur)         | Aumentar shutter; reduzir velocidade drone |
| `overlap_orb`   | ORB match < 0.05              | Aumentar overlap; reduzir altitude         |
| `navigation`    | Altitude GPS >> plano         | Verificar datum; usar terrain follow       |
| `camera_iso`    | Ruido alto + ISO >= 400       | Reduzir ISO se shutter permitir            |
| `camera_nd`     | Clipping severo               | Considerar filtro ND                       |
| `white_balance` | WB misto no EXIF              | Travar WB manualmente                      |

**Deteccao de padroes espaciais:**

- **Edge blur**: Blur concentrado nas bordas do grid (sombra, reflexo, crosswind)
- **Alternating strips**: Blur alterna entre faixas pares/impares (auto-exposure no retorno)
- **Progressive gradient**: Blur aumenta/diminui ao longo de rows/cols (drift de altitude, vento)
- **Gap cluster**: Slots vazios concentrados em uma borda (drone nao alcancou margem)
- **Feature starvation**: Baixo overlap ORB em row/col (superficie homogenea)

**Agregacao de parametros (`mergeCalibrationParamChanges`):**

- Velocidade: usa o **minimo** sugerido (conservador)
- Overlaps: usa o **maximo** sugerido (seguranca)
- Altitude: usa o **minimo** sugerido (mais GSD/features)

### 2.8 Problemas identificados no voo de calibracao

#### Problema 1: Falta recomendacao de configuracao de camera completa

O sistema recomenda ajustes de shutter, ISO e WB, mas **nao recomenda**:

- Abertura (f-number) - crucial para profundidade de campo
- Formato de imagem (RAW vs JPEG) - impacta processamento
- Modo de foco (AF-S vs manual infinito) - comum falha de foco em mapping
- Resolucao/aspect ratio - relacionado ao GSD calculado

**Solucao:** Adicionar regras para:

```
SE altitude > 60m E foco != infinito:
  RECOMENDAR "Configurar foco para infinito manual"

SE formato = JPEG E qualidade_preset = "high":
  RECOMENDAR "Considerar RAW para processamento de alta qualidade"

SE f-number < 4.0 E altitude < 50m:
  RECOMENDAR "Aumentar f-number para f/5.6+ para maior profundidade de campo"
```

#### Problema 2: Area de calibracao nao e representativa

O mini-voo sempre usa o centroide. Se a area tem partes com terreno variado (ex: metade vegetacao, metade edificacoes), o centroide pode cair numa area homogenea.

**Solucao:** Oferecer opcao de o usuario escolher a posicao do mini-voo no mapa, ou usar heuristica:

- Se dados de elevacao disponiveis: escolher area com maior variacao de elevacao
- Se imagem de satelite disponivel: escolher area com maior variacao de textura
- Default: centroide (como esta hoje)

#### Problema 3: Nao ha re-calibracao apos mudanca de parametros

Se o usuario aplica as recomendacoes e muda altitude de 80m para 60m, o GSD e footprint mudam. Nao ha indicacao de que uma nova calibracao pode ser necessaria.

**Solucao:** Mostrar badge "Calibracao desatualizada" quando parametros criticos mudam apos calibracao.

#### Problema 4: Nao valida se o numero de fotos cobre slots suficientes

O sistema aceita 5-30 fotos, mas se o grid tem 40 slots, 5 fotos so cobrem ~12%. Deveria haver um alerta.

**Solucao:** Apos grid generation, calcular `coverage_ratio = fotos_atribuidas / total_slots`. Se < 50%, alertar.

#### Problema 5: Falta feedback visual durante analise

O usuario faz upload e precisa esperar as tasks Celery. Se o worker esta parado ou Redis caiu, nao ha timeout ou feedback de erro.

**Solucao:** Implementar timeout de 5 minutos no frontend. Se `analyzing` por mais de 5 min, mostrar "Analise demorando mais que o esperado - verifique o servidor."

---

## 3. SUGESTOES DE MELHORIAS

### 3.1 PRIORIDADE ALTA (impacto direto na qualidade e usabilidade)

#### 3.1.1 Auto-rotacao inteligente do grid

**O que:** Calcular automaticamente o angulo otimo baseado no formato da area.
**Por que:** Como demonstrado nas screenshots, a diferenca entre angulo bom e ruim e de ~20% em distancia/tempo.
**Como:** Usar Minimum Bounding Rectangle (MBR) via Turf.js. O angulo do eixo longo do MBR e o angulo otimo.
**Complexidade:** Baixa (2-4 horas)

```typescript
// Pseudocodigo
import * as turf from "@turf/turf";

function calculateOptimalRotation(polygon: Feature<Polygon>): number {
  // Convex hull para simplificar
  const hull = turf.convex(turf.explode(polygon));
  const coords = hull.geometry.coordinates[0];

  let bestAngle = 0;
  let minWidth = Infinity;

  // Rotating calipers: testa angulo de cada aresta do convex hull
  for (let i = 0; i < coords.length - 1; i++) {
    const angle =
      (Math.atan2(
        coords[i + 1][1] - coords[i][1],
        coords[i + 1][0] - coords[i][0],
      ) *
        180) /
      Math.PI;

    // Gera grid com este angulo e mede largura (numero de faixas)
    const strips = generateFlightGrid(polygon, spacings, angle);
    if (strips.length < minWidth) {
      minWidth = strips.length;
      bestAngle = angle;
    }
  }
  return bestAngle;
}
```

#### 3.1.2 Modo AGL (Above Ground Level) com terreno

**O que:** Ajustar altitude do drone conforme elevacao do terreno para manter GSD constante.
**Por que:** Em terrenos inclinados, a altitude relativa varia, causando GSD inconsistente.
**Como:** Integrar API de elevacao (SRTM via Open-Meteo Elevation API, gratuito).
**Complexidade:** Alta (1-2 semanas)

#### 3.1.3 Zonas de exclusao aerea (No-fly zones)

**O que:** Overlay no mapa com aeroportos, areas restritas, helipads.
**Por que:** Seguranca e conformidade ANAC (RBAC-E 94, ICA 100-40).
**Como:** Integrar com DECEA/AIS (dados publicos) ou OpenDroneMap airspace data.
**Complexidade:** Media (3-5 dias)

#### 3.1.4 GCP (Ground Control Points)

**O que:** Permitir marcar pontos de controle no mapa com coordenadas de alta precisao.
**Por que:** Sem GCPs, a precisao absoluta depende apenas do GPS do drone (erro de 1-5m). Com GCPs, chega a 1-3cm.
**Como:** UI para adicionar pontos + import CSV + passar para ODM como `--gcp`.
**Complexidade:** Media (1 semana)

### 3.2 PRIORIDADE MEDIA (diferenciais competitivos)

#### 3.2.1 Planejamento de voo corredor/linear

**O que:** Alem de areas poligonais, suportar linhas (estradas, rios, linhas de transmissao).
**Por que:** Comum em inspeoes de infraestrutura.
**Como:** Input de polyline + buffer automatico + grid ao longo do eixo.
**Complexidade:** Media (1 semana)

#### 3.2.2 Multi-zona por projeto

**O que:** Permitir multiplos poligonos em um mesmo projeto com sequenciamento automatico.
**Por que:** Areas grandes precisam ser divididas por limite de bateria.
**Como:** Detectar automaticamente quando area excede autonomia e sugerir divisao.
**Complexidade:** Media (1 semana)

#### 3.2.3 Ferramentas de medicao nos resultados

**O que:** Medir distancias, areas e alturas diretamente no ortomosaico/nuvem de pontos.
**Por que:** Feature basica esperada por profissionais de topografia.
**Como:** Ferramentas de desenho sobre o mapa + calculo usando coordenadas georreferenciadas.
**Complexidade:** Media (3-5 dias)

#### 3.2.4 Relatorio PDF de voo

**O que:** Gerar PDF com plano de voo, mapa, parametros, checklist, clima.
**Por que:** Documentacao para clientes e reguladores.
**Como:** Library como jsPDF ou Puppeteer no backend.
**Complexidade:** Baixa (2-3 dias)

#### 3.2.5 Estimativa de precisao pre-voo

**O que:** Mostrar precisao esperada (XY e Z) com base em GSD, overlap, GCPs, tipo de terreno.
**Por que:** Permite ao usuario saber se os parametros atendem o requisito do projeto.
**Como:** Formulas empiricas baseadas em literatura de fotogrametria.
**Complexidade:** Baixa (1-2 dias)

```
Precisao horizontal ~= 1-2x GSD (sem GCP) ou 0.5-1x GSD (com GCP)
Precisao vertical ~= 1.5-3x GSD (sem GCP) ou 1-2x GSD (com GCP)

Exemplo: GSD 1.6 cm/px
  Sem GCP: XY = 1.6-3.2 cm, Z = 2.4-4.8 cm
  Com GCP: XY = 0.8-1.6 cm, Z = 1.6-3.2 cm
```

#### 3.2.6 Historico de voos e comparacao temporal

**O que:** Salvar cada voo com data e permitir comparacao side-by-side.
**Por que:** Monitoramento de obras, evolucao de culturas, erosao.
**Como:** Slider temporal + overlay com transparencia.
**Complexidade:** Media (1 semana)

### 3.3 PRIORIDADE BAIXA (nice-to-have / futuro)

#### 3.3.1 Suporte multispectral

**O que:** Suportar cameras multispectrais (MicaSense, DJI P1 MS).
**Por que:** Agricultura de precisao (NDVI, NDRE).
**Como:** Indices espectrais no processamento ODM + visualizacao com paleta de cores.
**Complexidade:** Alta

#### 3.3.2 Suporte RTK/PPK

**O que:** Importar dados RTK/PPK para correcao pos-processamento.
**Por que:** Precisao centimetrica sem GCPs fisicos.
**Como:** Parse RINEX/UBX + correao de coordenadas EXIF.
**Complexidade:** Alta

#### 3.3.3 Webhooks e API publica

**O que:** Notificacoes automaticas (processamento concluido) e API para integracao.
**Por que:** Integracao com ERPs, CRMs, dashboards de obra.
**Como:** Event system + API keys + rate limiting.
**Complexidade:** Media

#### 3.3.4 Machine Learning para qualidade

**O que:** Treinar modelo para prever qualidade do mapeamento antes de processar.
**Por que:** Evitar processar horas de ODM para descobrir que as fotos estao ruins.
**Como:** Dataset de calibracoes passadas + metricas de qualidade ODM.
**Complexidade:** Alta

#### 3.3.5 Drones customizados

**O que:** Permitir usuario cadastrar specs de drones nao listados.
**Por que:** Mercado tem dezenas de modelos alem dos 5 DJI suportados.
**Como:** Formulario com campos: sensor, focal length, resolucao, bateria.
**Complexidade:** Baixa (1-2 dias)

#### 3.3.6 Modo offline completo

**O que:** Funcionar 100% offline com sync posterior.
**Por que:** Mapeamento rural frequentemente sem internet.
**Como:** Service Worker + IndexedDB + fila de sync.
**Complexidade:** Alta

---

## 4. MODELOS DE PRECISAO

### 4.1 GSD (Ground Sample Distance)

Formula atual (correta):

```
GSD = (H * Sw) / (f * Iw)

Onde:
  H  = altitude (mm)
  Sw = largura do sensor (mm)
  f  = distancia focal (mm)
  Iw = largura da imagem (px)
```

### 4.2 Modelo de Motion Blur

**Nao implementado atualmente.** Sugestao:

```
blur_px = (velocidade_ms * tempo_exposicao_s) / GSD_m

Se blur_px > 0.5:  WARN "Motion blur detectavel"
Se blur_px > 1.5:  CRITICAL "Motion blur severo"

Velocidade maxima segura = (0.5 * GSD_m) / tempo_exposicao_s
```

Exemplo: GSD=1.6cm, Shutter=1/500s

```
V_max = (0.5 * 0.016) / 0.002 = 4.0 m/s
```

Se velocidade configurada = 5 m/s -> WARN

### 4.3 Modelo de Cobertura de Overlap

```
Overlap frontal efetivo = 1 - (V * dt) / footprint_h
Overlap lateral efetivo = 1 - sideSpacing / footprint_w

Onde:
  V  = velocidade (m/s)
  dt = intervalo entre fotos (s)
```

Problemas que reduzem overlap real:

- Vento lateral: desloca faixas
- Variacao de altitude: muda footprint
- GPS drift: ate 2-3m sem RTK

### 4.4 Modelo de Autonomia com Vento

**Nao implementado.** Sugestao:

```
V_efetiva = V_drone - V_vento * cos(angulo_relativo)
Tempo_real = Distancia / V_efetiva (para cada segmento)
Consumo_extra = (V_vento / V_max_drone)^2 * 15%  // empirico
```

### 4.5 Modelo de Precisao Posicional

```
Sem GCP:
  RMSE_XY = 1.5 * GSD * sqrt(1 + (sigma_GPS / GSD)^2)
  RMSE_Z  = 2.5 * GSD * sqrt(1 + (sigma_GPS / GSD)^2)

Com GCP (>= 5 pontos bem distribuidos):
  RMSE_XY = 0.7 * GSD
  RMSE_Z  = 1.2 * GSD

Com RTK:
  RMSE_XY = 0.5 * GSD + 0.02m
  RMSE_Z  = 1.0 * GSD + 0.03m
```

---

## 5. COMPARACAO COM CONCORRENTES

| Feature                | DroneData       | DroneDeploy   | Pix4D         | DJI Terra     |
| ---------------------- | --------------- | ------------- | ------------- | ------------- |
| Planejamento de voo    | Sim             | Sim           | Sim           | Sim           |
| Auto-rotacao grid      | **Nao**         | Sim           | Sim           | Sim           |
| Modo AGL/terreno       | **Nao**         | Sim           | Sim           | Sim           |
| GCPs                   | **Nao**         | Sim           | Sim           | Sim           |
| RTK/PPK                | **Nao**         | Sim           | Sim           | Sim           |
| Voo corredor           | **Nao**         | Sim           | Sim           | Sim           |
| No-fly zones           | **Nao**         | Sim           | Parcial       | Sim           |
| Calibracao inteligente | **Sim**         | Nao           | Nao           | Nao           |
| Weather integration    | **Sim**         | Parcial       | Nao           | Nao           |
| Pre-flight checklist   | **Sim**         | Parcial       | Nao           | Nao           |
| Processamento (ODM)    | Sim             | Sim (proprio) | Sim (proprio) | Sim (proprio) |
| NDVI/multispectral     | Nao             | Sim           | Sim           | Sim           |
| Medicoes em resultados | Nao             | Sim           | Sim           | Sim           |
| Relatorio PDF          | Nao             | Sim           | Sim           | Sim           |
| API publica            | Parcial         | Sim           | Sim           | Nao           |
| Mobile app             | Sim (Capacitor) | Sim (nativo)  | Sim           | Sim           |

**Diferenciais do DroneData:**

- Voo de calibracao com analise de qualidade (unico no mercado)
- Integracao meteorologica com go/no-go
- Pre-flight checklist contextual
- Open source (ODM backend)

**Gaps criticos:**

- Auto-rotacao (facil de resolver)
- GCPs (essencial para profissionais)
- Modo AGL (essencial para terrenos inclinados)
- No-fly zones (essencial para seguranca)

---

## 6. ROADMAP SUGERIDO

### Sprint 1 (1-2 semanas) - Quick wins

- [ ] Auto-rotacao por MBR (2-4h)
- [ ] Modelo de motion blur com alerta (1 dia)
- [ ] Estimativa de precisao pre-voo (1-2 dias)
- [ ] Badge "calibracao desatualizada" (2h)
- [ ] Cobertura minima de slots no upload (2h)
- [ ] Timeout de analise no frontend (1h)

### Sprint 2 (2-3 semanas) - Profissionalizacao

- [ ] GCPs: UI + backend + integracao ODM
- [ ] Relatorio PDF de voo
- [ ] Ferramentas de medicao nos resultados
- [ ] Drones customizados

### Sprint 3 (3-4 semanas) - Diferenciais

- [ ] Modo AGL com API de elevacao
- [ ] Zonas de exclusao aerea
- [ ] Multi-zona por projeto
- [ ] Planejamento corredor/linear

### Sprint 4 (4+ semanas) - Avancado

- [ ] Suporte multispectral
- [ ] RTK/PPK
- [ ] ML para predicao de qualidade
- [ ] Modo offline completo
- [ ] Webhooks + API publica

---

## ANEXO A: ARQUIVOS-CHAVE DO PROJETO

| Arquivo                                                                   | Funcao                      |
| ------------------------------------------------------------------------- | --------------------------- |
| `app/src/features/flight-planner/utils/waypointCalculator.ts`             | Geracao de waypoints e grid |
| `app/src/features/flight-planner/utils/droneSpecs.ts`                     | Specs dos 5 drones DJI      |
| `app/src/features/flight-planner/utils/kmzBuilder.ts`                     | Exportacao KMZ/WPML         |
| `app/src/features/flight-planner/hooks/useFlightCalculator.ts`            | Hook reativo de calculo     |
| `app/src/features/flight-planner/stores/useFlightStore.ts`                | Estado global (Zustand)     |
| `app/src/features/flight-planner/components/FlightPlannerConfigPanel.tsx` | Painel de configuracao      |
| `backend/app/core/calibration/calibration_grid.py`                        | Grid de calibracao (UTM)    |
| `backend/app/core/calibration/recommendation_engine.py`                   | Motor de recomendacoes      |
| `backend/app/core/calibration/spatial_pattern_detector.py`                | Deteccao de padroes no grid |
| `backend/app/tasks/calibration_tasks.py`                                  | Tasks Celery (EXIF + pixel) |
