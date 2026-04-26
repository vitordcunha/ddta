# Plano de Implementação — 3D Maps, Drone Intelligence & Route Planning

**Versão:** 1.1  
**Data:** 2026-04-26  
**Escopo:** Integração de múltiplos provedores de mapa (Leaflet, Mapbox, Google Maps) com visualização 3D, sistema de waypoints inteligente com terrain-following, câmera/gimbal por waypoint, POI, frustum 3D, modelos de drone parametrizados, reconstrução de rota real via EXIF/XMP, e otimizações de performance para tablets Android mid-range.

---

## Princípios de Implementação

Toda implementação deve seguir rigorosamente os seguintes princípios:

- **SOLID**: cada módulo tem uma única responsabilidade, interfaces definem contratos, dependências injetadas via contexto/props
- **Consistência**: nomenclatura uniforme em toda a stack (snake_case no backend, camelCase no frontend, kebab-case em arquivos)
- **Precisão geoespacial**: usar `pyproj.Geod` para cálculos de distância/área, nunca multiplicadores aproximados
- **Separação de concerns**: lógica de negócio separada de lógica de UI; stores gerenciam estado, hooks gerenciam efeitos, componentes renderizam
- **Sem over-engineering**: abstrações criadas apenas quando há 2+ implementações reais; sem feature flags ou compat shims desnecessários
- **Testabilidade**: funções puras para cálculos geométricos e de rota; efeitos colaterais isolados em services

---

## Visão Geral das Fases

| Fase | Nome | Dependências |
|------|------|-------------|
| 1 | Fundação: Map Engine & Configurações | — |
| 2 | Modelo de Dados de Waypoints | Fase 1 |
| 3 | Terrain-Following | Fase 2 |
| 4 | Integração Mapbox 3D | Fase 1 |
| 5 | deck.gl — Visualização 3D da Rota | Fase 4 |
| 6 | Editor de Waypoints | Fase 2, 5 |
| 7 | Sistema de POI | Fase 6 |
| 8 | Câmera/Gimbal & Frustum 3D | Fase 7 |
| 9 | Modelos de Drone | Fase 1 |
| 10 | Integração Google Maps | Fase 5 |
| 11 | Telemetria Real via EXIF/XMP | Fase 9 |

---

## Fase 1 — Fundação: Map Engine & Configurações

**Objetivo:** Criar a abstração do motor de mapas e a infraestrutura de configurações de API keys. Toda fase subsequente depende desta fundação.

### 1.1 — Map Engine Abstraction (Frontend)

**Localização:** `/app/src/features/map-engine/`

Criar uma interface `IMapEngine` que todos os provedores implementam. O contexto `MapEngineContext` fornece o provedor ativo para toda a aplicação.

```
/app/src/features/map-engine/
  types.ts              # MapProvider enum, MapMode enum, IMapEngine interface
  MapEngineContext.tsx  # React context + provider
  useMapEngine.ts       # Hook de consumo do contexto
  index.ts              # Barrel export
```

**`types.ts`** deve definir:

```typescript
export type MapProvider = 'leaflet' | 'mapbox' | 'google';
export type MapMode = '2d' | '3d';

export interface MapEngineState {
  provider: MapProvider;
  mode: MapMode;
  center: [number, number];      // [lat, lng]
  zoom: number;
}
```

**`MapEngineContext.tsx`** deve:
- Persistir `provider` e `mode` no `localStorage` (preferência do usuário)
- Expor `setProvider(p: MapProvider)` e `setMode(m: MapMode)`
- Sincronizar `center` e `zoom` entre provedores ao trocar

**Regra arquitetural:** nenhum componente fora de `map-engine/` deve importar diretamente `leaflet`, `mapbox-gl` ou a API do Google Maps — toda interação passa pelo contexto ou pelos componentes de cada provedor.

### 1.2 — WorkspaceMapView como Dispatcher

Refatorar `/app/src/components/map/WorkspaceMapView.tsx` para:

```tsx
// Renderiza o componente correto com base no provider ativo
switch (provider) {
  case 'leaflet':  return <LeafletMapView />;
  case 'mapbox':   return <MapboxMapView />;
  case 'google':   return <GoogleMapsView />;
}
```

Cada view é responsável por renderizar seus próprios layers (rota, waypoints, ortofoto, etc.) usando os dados dos stores existentes.

### 1.3 — Map Style Popover (Frontend)

Estender o popover de estilos de mapa existente com:

- **Seletor de provedor**: três botões — Leaflet / Mapbox / Google Maps
- **Toggle 2D / 3D**: disponível apenas para Mapbox e Google (desabilitado para Leaflet)
- **Feedback visual**: ícone de lock no toggle 3D quando Leaflet está ativo

### 1.4 — Settings Page: API Keys (Frontend + Backend)

Adicionar na tela de configurações (junto ao OpenWeather API Key):

- Campo `Mapbox API Key`
- Campo `Google Maps API Key`

**Backend:** Adicionar dois campos na tabela `settings` (ou criar tabela `api_keys` separada):

```sql
ALTER TABLE settings ADD COLUMN mapbox_api_key TEXT;
ALTER TABLE settings ADD COLUMN google_maps_api_key TEXT;
```

**Endpoint:** `GET/PUT /api/v1/settings/api-keys`

**Frontend:** As keys são carregadas uma vez no boot da aplicação e injetadas no `MapEngineContext`. Nenhum componente individual deve fazer fetch de API key.

---

## Fase 2 — Modelo de Dados de Waypoints

**Objetivo:** Transformar waypoints de coordenadas simples em entidades ricas com altitude, câmera e metadados individuais.

### 2.1 — Tipo `Waypoint` (Frontend)

**Arquivo:** `/app/src/features/flight-planner/types/waypoint.ts`

```typescript
export interface Waypoint {
  id: string;                     // uuid gerado no cliente
  lat: number;
  lng: number;
  altitude: number;               // metros AMSL (ou AGL se terrain-following desligado)
  altitudeMode: 'agl' | 'amsl';   // modo de altitude
  terrainElevation?: number;      // elevação do terreno neste ponto (metros, cache local)
  gimbalPitch: number;            // graus, -90 (nadir) a 0 (horizonte)
  heading: number;                // graus, 0-359, sentido do drone
  poiOverride: boolean;           // se true, ignora POI global e usa gimbal/heading deste waypoint
  speed?: number;                 // m/s, opcional (sobrescreve velocidade global)
  hoverTime?: number;             // segundos de pausa neste waypoint
  index: number;                  // posição na rota
}
```

### 2.2 — Atualização do FlightStore

**Arquivo:** `/app/src/features/flight-planner/stores/useFlightStore.ts`

Adicionar ao estado:

```typescript
interface FlightState {
  // ... existente ...
  waypoints: Waypoint[];          // substituir array de lat/lng por Waypoint[]
  terrainFollowing: boolean;
  poi: PointOfInterest | null;
  selectedWaypointId: string | null;
}
```

Adicionar actions:
- `updateWaypoint(id: string, patch: Partial<Waypoint>)`
- `setTerrainFollowing(enabled: boolean)`
- `setSelectedWaypoint(id: string | null)`
- `setPoi(poi: PointOfInterest | null)`

### 2.3 — Atualização do `waypointCalculator.ts`

O calculador deve retornar `Waypoint[]` em vez de arrays de coordenadas. Para cada waypoint calculado:

1. Definir `lat`, `lng` a partir da grade
2. Definir `altitude` = parâmetro de altitude do voo (inicial)
3. Definir `altitudeMode` = `'agl'` por padrão
4. Definir `gimbalPitch` = -90 por padrão (nadir, fotogrametria)
5. Definir `heading` = calculado pela direção do strip
6. Definir `index`, `id` único

### 2.4 — Atualização do KMZ Builder

**Arquivo:** `/app/src/features/flight-planner/utils/kmzBuilder.ts`

Por waypoint, incluir no XML WPML:
- `<wpml:gimbalPitchAngle>` com o valor de `gimbalPitch`
- `<wpml:waypointHeadingMode>` = `fixed` quando POI inativo, `towardPOI` quando ativo
- `<wpml:waypointHeadingAngle>` com o valor de `heading`
- `<wpml:waypointSpeed>` se `speed` definido

---

## Fase 3 — Terrain-Following

**Objetivo:** Adaptar a altitude de cada waypoint à elevação do terreno sob ele, com possibilidade de ativar/desativar.

### 3.1 — Elevation Service (Frontend)

**Arquivo:** `/app/src/features/flight-planner/services/elevationService.ts`

Interface única com implementação via **Mapbox Terrain RGB**:

```typescript
interface IElevationService {
  getElevations(points: Array<[number, number]>): Promise<number[]>;
}
```

**Implementação `MapboxElevationService`:**
- Usa a API `mapbox.mapbox-terrain-dem-v1` (raster DEM)
- Decodifica valores RGB: `elevation = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1`
- Batch de múltiplos pontos em uma única requisição (bounding box → tile único quando possível)
- Cache em memória `Map<string, number>` com chave `"${lat.toFixed(5)},${lng.toFixed(5)}"`

**Fallback:** Se API key não disponível, retornar `0` para todos os pontos (voo plano).

### 3.2 — Integração no FlightStore

Ao calcular/recalcular waypoints com `terrainFollowing = true`:

1. Chamar `elevationService.getElevations(waypoints.map(w => [w.lat, w.lng]))`
2. Para cada waypoint: `altitude = terrainElevation + params.flightAltitude`
3. Armazenar `terrainElevation` no waypoint para exibição no editor
4. Marcar `altitudeMode = 'amsl'`

Ao desativar terrain-following:
- Reverter todos os waypoints sem `poiOverride` para `altitude = params.flightAltitude`
- Marcar `altitudeMode = 'agl'`

**Waypoint com altitude editada manualmente** não é alterado pelo terrain-following (flag interna `manualAltitude: boolean`).

### 3.3 — UI: Toggle Terrain-Following

No painel de parâmetros de voo, adicionar:

- Toggle **Terrain Following** (on/off)
- Quando ativado: indicador de loading enquanto busca elevações
- Chip de status: "AGL uniforme" vs "Adaptado ao terreno"

---

## Fase 4 — Integração Mapbox 3D

**Objetivo:** Implementar o provedor Mapbox com suporte a 2D e 3D nativo.

### 4.1 — Dependências

```bash
npm install mapbox-gl react-map-gl
npm install -D @types/mapbox-gl
```

### 4.2 — `MapboxMapView` Component

**Arquivo:** `/app/src/features/map-engine/providers/mapbox/MapboxMapView.tsx`

```
/app/src/features/map-engine/providers/
  mapbox/
    MapboxMapView.tsx       # Componente principal (react-map-gl Map)
    MapboxLayers.tsx        # Layers Mapbox nativas (terrain, buildings)
    MapboxControls.tsx      # NavigationControl, ScaleControl
    useMapboxSync.ts        # Sincroniza center/zoom com MapEngineContext
  leaflet/
    LeafletMapView.tsx      # Refactor do WorkspaceMapView atual
  google/
    GoogleMapsView.tsx      # Fase 10
```

**`MapboxMapView.tsx`** deve:
- Ler API key do `MapEngineContext`
- Em modo **2D**: estilo `mapbox://styles/mapbox/satellite-streets-v12`, sem terrain
- Em modo **3D**: adicionar `mapbox-dem` source, `sky` layer, `pitch: 45`, `bearing: 0`
- Adicionar layer `fill-extrusion` para prédios 3D em modo 3D
- Montar `<DeckGLOverlay>` sobre o mapa (Fase 5)

### 4.3 — Sincronização de Estado

`useMapboxSync.ts` deve:
- Ao mover o mapa Mapbox: atualizar `center` e `zoom` no `MapEngineContext`
- Ao receber `center`/`zoom` do contexto (troca de provedor): mover o mapa para a posição

---

## Fase 5 — deck.gl: Visualização 3D da Rota

**Objetivo:** Renderizar a rota do drone e waypoints em 3D sobre o Mapbox (e futuramente Google Maps) usando deck.gl.

### 5.1 — Dependências

```bash
npm install @deck.gl/core @deck.gl/layers @deck.gl/react @deck.gl/mapbox
```

### 5.2 — Arquitetura dos Layers

**Arquivo:** `/app/src/features/map-engine/layers/`

```
layers/
  DroneRouteLayer.ts       # PathLayer com coordenadas 3D da rota
  WaypointLayer.ts         # ScatterplotLayer com esferas nos waypoints
  FrustumLayer.ts          # PolygonLayer do cone de câmera (Fase 8)
  PointCloudLayer.ts       # PointCloudLayer da nuvem sparse (resultados)
  useDroneRouteLayers.ts   # Hook que compõe os layers com dados do FlightStore
```

**Regra:** cada arquivo de layer exporta apenas uma função `create<Name>Layer(data, options)` que retorna uma instância configurada do layer deck.gl. Nenhum layer tem acesso direto ao store — recebe dados via props.

### 5.3 — `DroneRouteLayer`

```typescript
// Converte Waypoint[] para PathLayer data
// path: [[lng, lat, altitude_metros], ...]
// getColor: [255, 200, 0, 220] (amarelo, como na visualização 2D atual)
// getWidth: 2
// widthUnits: 'pixels'
```

### 5.4 — `WaypointLayer`

```typescript
// ScatterplotLayer
// getPosition: [lng, lat, altitude_metros]
// getRadius: 4 (pixels)
// getColor: baseado no índice (primeiro = verde, último = vermelho, demais = branco)
// pickable: true → ao clicar, dispatch setSelectedWaypoint(id)
```

### 5.5 — `DeckGLOverlay` Component

**Arquivo:** `/app/src/features/map-engine/providers/mapbox/DeckGLOverlay.tsx`

Usa `@deck.gl/mapbox` `MapboxOverlay` para sincronizar deck.gl com o viewport Mapbox. Recebe `layers[]` como prop.

### 5.6 — Toggle de Visibilidade

No painel de resultados e planejamento, adicionar:

- Checkbox **Mostrar Rota** (default: on no planejamento, off nos resultados)
- Checkbox **Mostrar Waypoints** (default: on)

---

## Fase 6 — Editor de Waypoints

**Objetivo:** Permitir edição individual de waypoints via painel lateral, acionado por clique no waypoint (2D ou 3D).

### 6.1 — `WaypointEditorPanel` Component

**Arquivo:** `/app/src/features/flight-planner/components/WaypointEditorPanel.tsx`

Renderizado como drawer lateral quando `selectedWaypointId !== null`.

**Campos do editor:**

| Campo | Controle | Validação |
|-------|----------|-----------|
| Índice | Read-only | — |
| Latitude | Input numérico | ±90 |
| Longitude | Input numérico | ±180 |
| Altitude (m) | Slider + input | min: 10, max: 500 |
| Modo altitude | Toggle AGL / AMSL | — |
| Elevação terreno | Read-only (cache) | — |
| Gimbal Pitch | Slider -90° a +30° | step: 1° |
| Heading | Input 0-359° + seta visual | — |
| Sobrescrever POI | Toggle | — |
| Velocidade | Input m/s (opcional) | — |
| Tempo de pausa | Input segundos | — |

**Botões:**
- **Aplicar a todos**: copia gimbal pitch e heading para todos os waypoints sem `poiOverride`
- **Resetar**: reverte para valores calculados pelo `waypointCalculator`
- **Fechar** (X)

### 6.2 — Drag de Waypoints no Leaflet

No `FlightPlannerMapContent.tsx`, os marcadores de waypoints devem ser `draggable: true`.

Ao soltar:
1. Atualizar `lat`/`lng` via `updateWaypoint`
2. Se terrain-following ativo: buscar nova elevação para o ponto
3. Se POI ativo: recalcular heading e gimbal pitch em direção ao POI

### 6.3 — Clique em Waypoint no deck.gl (Mapbox/Google)

O `WaypointLayer` já define `pickable: true`. No handler `onClick` do `DeckGLOverlay`:

```typescript
onLayerClick: (info) => {
  if (info.layer?.id === 'waypoints') {
    setSelectedWaypoint(info.object.id);
  }
}
```

O `WaypointEditorPanel` abre como drawer sobreposto ao mapa.

---

## Fase 7 — Sistema de POI (Point of Interest)

**Objetivo:** Definir um ponto no espaço para o qual todos os waypoints (por padrão) devem apontar a câmera.

### 7.1 — Tipo `PointOfInterest`

**Arquivo:** `/app/src/features/flight-planner/types/poi.ts`

```typescript
export interface PointOfInterest {
  id: string;
  lat: number;
  lng: number;
  altitude: number;   // metros AMSL
  label?: string;
}
```

### 7.2 — POI no Mapa

**Leaflet:** Marcador especial (ícone de alvo/crosshair) arrastável no mapa.  
**Mapbox/Google:** `ScatterplotLayer` separado no deck.gl, cor ciano, `pickable: true`.

Para adicionar um POI: botão "Adicionar POI" no toolbar do planner → próximo clique no mapa define a posição.

### 7.3 — `poiCalculator.ts`

**Arquivo:** `/app/src/features/flight-planner/utils/poiCalculator.ts`

```typescript
// Para cada waypoint, calcula:
// bearing (heading) = azimute geodésico do waypoint até o POI (via turf.bearing)
// pitch = -atan2(Δalt, distância_horizontal) em graus
//   onde Δalt = poi.altitude - waypoint.altitude
//   e distância_horizontal = turf.distance(waypoint, poi) em metros
```

Ao definir/mover o POI:
1. Para todos os waypoints com `poiOverride = false`:
   - Calcular e aplicar `heading` e `gimbalPitch`
2. Waypoints com `poiOverride = true` não são alterados

### 7.4 — Exportação para KMZ

O POI é exportado como `<wpml:pointOfInterest>` no WPML quando ativo.

---

## Fase 8 — Câmera/Gimbal & Frustum 3D

**Objetivo:** Visualizar o cone de visão da câmera do drone em 3D quando um waypoint está selecionado.

### 8.1 — Parâmetros de Câmera

Virão do modelo de drone ativo (Fase 9). Fallback para valores padrão (FOV 84° x 70°, DJI Mavic 3).

### 8.2 — `frustumCalculator.ts`

**Arquivo:** `/app/src/features/flight-planner/utils/frustumCalculator.ts`

Dado um waypoint, o modelo de drone e o gimbal pitch/heading, calcular os 4 vértices do frustum projetados no terreno:

```typescript
interface FrustumGeometry {
  apex: [number, number, number];      // posição do drone (lng, lat, alt)
  footprintPolygon: [number, number][] // 4 cantos no terreno
  sidePolygons: [number, number, number][][] // 4 faces laterais do cone
}
```

Cálculo:
1. Calcular distância de projeção: `d = altitude / cos(gimbalPitch_rad)`
2. Half-widths no plano da câmera: `hw = d * tan(HFOV/2)`, `hh = d * tan(VFOV/2)`
3. Rotacionar pelos ângulos de heading e pitch
4. Converter offsets métricos para lat/lng usando `pyproj.Geod` (ou turf no frontend)

### 8.3 — `FrustumLayer` (deck.gl)

```typescript
// PolygonLayer para footprint no terreno: cor amarela semi-transparente
// PolygonLayer para faces laterais: cor branca com baixa opacidade (wireframe)
// Visível apenas quando selectedWaypointId !== null
// Atualiza em tempo real ao mover slider de gimbal pitch/heading no editor
```

### 8.4 — Integração com `DeckGLOverlay`

O `useDroneRouteLayers` hook passa o frustum layer apenas quando `selectedWaypointId !== null` e `mode === '3d'`.

---

## Fase 9 — Modelos de Drone

**Objetivo:** Criar uma tabela parametrizada de modelos de drone que alimenta cálculos de rota, GSD, frustum e overlap.

### 9.1 — Backend: Tabela `drone_models`

```sql
CREATE TABLE drone_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,           -- "DJI Mavic 3"
  manufacturer  TEXT NOT NULL,           -- "DJI"
  is_default    BOOLEAN DEFAULT FALSE,
  is_custom     BOOLEAN DEFAULT FALSE,   -- criado pelo usuário
  
  -- Sensor & óptica
  sensor_width_mm     FLOAT NOT NULL,    -- ex: 17.3
  sensor_height_mm    FLOAT NOT NULL,    -- ex: 13.0
  focal_length_mm     FLOAT NOT NULL,    -- ex: 12.29
  image_width_px      INTEGER NOT NULL,  -- ex: 5280
  image_height_px     INTEGER NOT NULL,  -- ex: 3956
  
  -- Câmera
  fov_horizontal_deg  FLOAT NOT NULL,    -- calculável, mas armazenado explicitamente
  fov_vertical_deg    FLOAT NOT NULL,
  
  -- Gimbal
  gimbal_pitch_min    FLOAT DEFAULT -90,
  gimbal_pitch_max    FLOAT DEFAULT 30,
  
  -- Voo
  max_speed_ms        FLOAT NOT NULL,    -- m/s
  max_altitude_m      FLOAT NOT NULL,    -- metros AMSL
  
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Dados pré-populados (seed):**

| Modelo | Fabricante | Sensor (mm) | Focal (mm) | Resolução | FOV H |
|--------|-----------|-------------|------------|-----------|-------|
| Mavic 3 | DJI | 17.3 × 13.0 | 12.29 | 5280×3956 | 84° |
| Air 2S | DJI | 13.2 × 8.8 | 8.38 | 5472×3648 | 88° |
| Mini 4 Pro | DJI | 9.6 × 7.2 | 6.7 | 4032×3024 | 82.1° |
| Mini 5 Pro | DJI | 13.2 × 8.8 | 7.33 | 8192×6144 | 84° |
| Phantom 4 Pro | DJI | 13.2 × 8.8 | 8.8 | 5472×3648 | 84° |
| M300 RTK | DJI | 13.2 × 8.8 | 8.4 | 5472×3648 | 84° |

### 9.2 — Backend: API de Drone Models

```
GET  /api/v1/drone-models          # lista todos (defaults + custom do usuário)
POST /api/v1/drone-models          # criar custom
PUT  /api/v1/drone-models/{id}     # editar (apenas is_custom=true)
DELETE /api/v1/drone-models/{id}   # deletar (apenas is_custom=true)
```

Schema Pydantic: `DroneModelRead`, `DroneModelCreate`, `DroneModelUpdate`.

### 9.3 — Frontend: Drone Model Selector

**Localização:** painel de parâmetros de voo (junto a altitude, overlap, velocidade)

- Dropdown com lista de modelos agrupados: **Modelos padrão** / **Meus modelos**
- Botão "Gerenciar modelos" → abre modal `DroneModelManager`

**`DroneModelManager` modal:**
- Lista de modelos custom com edição inline
- Formulário para criar novo modelo custom
- Visualização de parâmetros dos modelos padrão (read-only)

### 9.4 — Integração com Cálculos

O modelo de drone ativo (armazenado no FlightStore) alimenta:

- `waypointCalculator.ts`: usar `sensor_width_mm`, `focal_length_mm` para GSD e spacing
- `frustumCalculator.ts`: usar `fov_horizontal_deg`, `fov_vertical_deg`
- `exif_aggregate.py` (backend): validar focal length e sensor do EXIF vs modelo configurado

---

## Fase 10 — Integração Google Maps

**Objetivo:** Adicionar Google Maps como terceiro provedor com suporte a 3D (prédios, terreno, árvores).

### 10.1 — Dependências

```bash
npm install @react-google-maps/api @deck.gl/google-maps
```

### 10.2 — `GoogleMapsView` Component

**Arquivo:** `/app/src/features/map-engine/providers/google/GoogleMapsView.tsx`

```
providers/google/
  GoogleMapsView.tsx          # Componente principal
  GoogleMapsLayers.tsx        # Layers nativos (WebGL overlay)
  DeckGLGoogleOverlay.tsx     # GoogleMapsOverlay do deck.gl
  useGoogleMapsSync.ts        # Sincroniza com MapEngineContext
```

**Configuração em modo 3D:**
- `mapTypeId: 'satellite'`
- `tilt: 45`
- `heading: 0`
- `mapId: '<mapId_com_3D_habilitado>'` — necessário para prédios e árvores 3D

**`DeckGLGoogleOverlay`** usa `GoogleMapsOverlay` do `@deck.gl/google-maps`. Recebe os mesmos layers do `useDroneRouteLayers` hook (reaproveitamento total das Fases 5, 7, 8).

### 10.3 — Reaproveitamento de Layers

Os layers deck.gl criados nas Fases 5, 7 e 8 são **agnósticos de provedor** — as mesmas instâncias de `DroneRouteLayer`, `WaypointLayer` e `FrustumLayer` funcionam tanto no `DeckGLOverlay` (Mapbox) quanto no `DeckGLGoogleOverlay` (Google Maps), pois deck.gl abstrai o viewport.

---

## Fase 11 — Telemetria Real via EXIF/XMP

**Objetivo:** Reconstruir o trajeto real voado a partir dos metadados das imagens carregadas, exibindo-o na visualização de resultados.

### 11.1 — Backend: XMP Parser

**Arquivo:** `/backend/app/services/exif/xmp_parser.py`

```python
class DjiXmpParser:
    """Extrai metadados do namespace drone-dji: de imagens DJI."""
    
    XMP_NAMESPACE = "http://www.dji.com/drone-dji/1.0/"
    
    def parse(self, image_path: Path) -> DjiXmpData | None:
        # Lê bytes do arquivo, localiza bloco XMP (<x:xmpmeta>)
        # Parseia XML com ElementTree
        # Extrai campos do namespace drone-dji:
        ...

@dataclass
class DjiXmpData:
    relative_altitude: float | None      # metros acima do takeoff (barômetro)
    absolute_altitude: float | None      # AMSL (menos preciso)
    gimbal_pitch: float | None
    gimbal_yaw: float | None
    gimbal_roll: float | None
    flight_yaw: float | None
    flight_pitch: float | None
    flight_roll: float | None
```

**Dependência:** apenas stdlib (`xml.etree.ElementTree`, `re`) — sem `python-xmp-toolkit` para evitar dependência de `libexempi`. O XMP é um bloco XML embutido no JPEG que pode ser extraído por busca de bytes.

### 11.2 — Backend: Atualização do Pipeline de Upload

**Arquivo:** `/backend/app/api/v1/projects.py`

Na função de upload de imagem (pós-chunk-merge):

1. Parsear EXIF GPS (já existente) → `lat`, `lng`
2. Parsear XMP DJI → `relative_altitude`, `gimbal_pitch`, `flight_yaw`
3. Atualizar `ProjectImage` com novos campos

**Migração de banco:**

```sql
ALTER TABLE project_images ADD COLUMN relative_altitude FLOAT;
ALTER TABLE project_images ADD COLUMN gimbal_pitch FLOAT;
ALTER TABLE project_images ADD COLUMN flight_yaw FLOAT;
ALTER TABLE project_images ADD COLUMN captured_at TIMESTAMPTZ;
```

### 11.3 — Backend: Endpoint de Flight Path

**Arquivo:** `/backend/app/api/v1/projects.py`

```
GET /api/v1/projects/{project_id}/flight-path
```

**Response:** GeoJSON `FeatureCollection` com:
- `LineString` com coordenadas `[lng, lat, relative_altitude]` (rota reconstruída)
- `Feature` por waypoint real com properties: `gimbal_pitch`, `flight_yaw`, `captured_at`, `filename`

Ordenação por `captured_at` (timestamp do EXIF) para garantir ordem correta.

**Fallback:** se menos de 3 imagens têm GPS, retorna 404 com mensagem explicativa.

### 11.4 — Frontend: Telemetry Layer nos Resultados

**Arquivo:** `/app/src/features/results/components/ResultsMapLayers.tsx`

Adicionar toggle **"Rota Real do Voo"** no `LayerSelector`.

Quando ativo:
- Fetch `GET /projects/{id}/flight-path`
- Renderizar como `PathLayer` no deck.gl (cor ciano, para diferenciar da rota planejada em amarelo)
- No modo 3D: linha corre na altitude real registrada pelas fotos
- No modo 2D (Leaflet): renderizar como `Polyline` react-leaflet

---

## Considerações Transversais

### Gerenciamento de Estado Entre Fases

O `useFlightStore` cresce ao longo das fases. Seguir o princípio de colocação: cada sub-domínio deve ter seu próprio slice ou store derivado:

- `useFlightStore`: estado de voo, polygon, strips
- `useWaypointStore`: waypoints individuais, selectedWaypointId, terrainFollowing
- `usePoiStore`: POI ativo
- `useMapEngineStore`: provider, mode, center, zoom, deviceTier

### Testes

- `frustumCalculator.ts`: testar com waypoints conhecidos e verificar que footprint tem dimensão correta de acordo com altitude e FOV
- `poiCalculator.ts`: testar bearing e pitch com coordenadas conhecidas
- `elevationService.ts`: mock da API Mapbox nos testes, verificar cache
- `xmp_parser.py`: fixtures de imagens DJI reais (ou bytes sintéticos com XML XMP embutido)
- `drone_models` API: testes de CRUD com validação de que modelos padrão não são editáveis

---

## Otimizações de Performance — Tablets Android

> **Contexto:** O app roda via Capacitor WebView em tablets Android mid-range. WebGL dentro de WebView tem ~30–50% da performance de um browser nativo no mesmo hardware (Adreno 610, Mali-G52, etc.). Sem as otimizações abaixo, o modo 3D pode resultar em 15–20fps, travamentos ao arrastar waypoints e bateria drenando rapidamente.

### O.1 — Detecção de Capacidade WebGL (Fase 1, obrigatório)

**Arquivo:** `/app/src/features/map-engine/utils/detectDeviceTier.ts`

```typescript
export type DeviceTier = 'high' | 'low' | 'none';

export function detectDeviceTier(): DeviceTier {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) return 'none';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string
    : '';

  // GPUs com boa performance WebGL em WebView
  const highTierPattern = /Adreno (6[0-9]{2}|7\d{2})|Mali-G(7[0-9]|8[0-9]|9[0-9])/i;
  if (highTierPattern.test(renderer)) return 'high';

  // GPUs mid-range: 3D disponível mas com limitações
  const midTierPattern = /Adreno [45]\d{2}|Mali-G[34567]\d|PowerVR/i;
  if (midTierPattern.test(renderer)) return 'low';

  return 'low'; // desconhecido = tratar como low
}
```

`deviceTier` é armazenado no `MapEngineContext` e consultado em toda decisão de renderização.

**Comportamento por tier:**

| Tier | 3D disponível | Animações | Terrain | Prédios 3D |
|------|--------------|-----------|---------|-----------|
| `high` | Sim | Sim (flyTo) | Sim | Sim |
| `low` | Sim (com aviso) | Não (jumpTo) | Sim | Não |
| `none` | Não (bloqueado) | — | — | — |

Quando `low` ou `none`, o toggle 3D na UI aparece com tooltip: *"Seu dispositivo pode não suportar visualização 3D com performance adequada."*

### O.2 — Leaflet como Provedor Padrão (Fase 1, obrigatório)

O usuário sempre inicia em **Leaflet 2D**, independente de qualquer configuração. Mapbox e Google Maps são opt-in explícito. Para trabalho de campo (planejamento de missão no tablet antes do voo), Leaflet é suficiente e opera a 60fps em qualquer hardware.

A preferência de provedor persiste via `localStorage`, mas na **primeira abertura** o default é sempre Leaflet.

### O.3 — Lazy Loading dos Provedores Pesados (Fase 4 e 10, obrigatório)

Mapbox GL JS (~500KB gzipped) e Google Maps JS API não devem estar no bundle inicial. Carregar sob demanda apenas quando o usuário selecionar o provedor:

```typescript
// MapEngineContext.tsx — ao trocar de provedor
async function loadProvider(provider: MapProvider) {
  switch (provider) {
    case 'mapbox':
      const { MapboxMapView } = await import('./providers/mapbox/MapboxMapView');
      // deck.gl também carregado aqui, não no bundle inicial
      const { DeckGLOverlay } = await import('./providers/mapbox/DeckGLOverlay');
      return MapboxMapView;
    case 'google':
      const { GoogleMapsView } = await import('./providers/google/GoogleMapsView');
      return GoogleMapsView;
    case 'leaflet':
      // Leaflet já está no bundle principal (provedor default)
      return LeafletMapView;
  }
}
```

**Impacto esperado:** redução do bundle inicial em ~800KB. O tempo de carregamento do app no tablet melhora significativamente.

Exibir skeleton/spinner com mensagem *"Carregando mapa 3D..."* durante o dynamic import.

### O.4 — Animações Adaptativas (Fases 4 e 10)

Substituir `flyTo` por `jumpTo` em devices `low`:

```typescript
// useMapboxSync.ts
function navigateTo(center: [number, number], zoom: number) {
  if (deviceTier === 'high') {
    map.flyTo({ center, zoom, duration: 800 });
  } else {
    map.jumpTo({ center, zoom });
  }
}
```

O mesmo padrão se aplica ao Google Maps: `map.panTo` vs `map.setCenter`.

### O.5 — LOD de Waypoints em 3D (Fase 5)

Para missões com grade densa (> 200 waypoints), renderizar apenas um subconjunto em 3D:

```typescript
// useDroneRouteLayers.ts
function getLODWaypoints(waypoints: Waypoint[], tier: DeviceTier): Waypoint[] {
  if (tier === 'high' || waypoints.length <= 200) return waypoints;
  // tier 'low': renderizar a cada N waypoints para reduzir draw calls
  const step = Math.ceil(waypoints.length / 150);
  return waypoints.filter((_, i) => i % step === 0 || i === 0 || i === waypoints.length - 1);
}
```

A rota (`PathLayer`) sempre usa todos os pontos — só os marcadores de waypoint são amostrados.

### O.6 — `updateTriggers` Corretos no deck.gl (Fase 5, obrigatório)

Erro comum que causa re-upload completo de buffers GPU a cada render:

```typescript
// ERRADO — recria o layer inteiro em cada render
new ScatterplotLayer({ data: waypoints, getPosition: w => [w.lng, w.lat, w.altitude] })

// CORRETO — deck.gl reutiliza o buffer GPU, só atualiza o que mudou
new ScatterplotLayer({
  data: waypoints,
  getPosition: (w: Waypoint) => [w.lng, w.lat, w.altitude],
  updateTriggers: {
    getPosition: waypointsHash,      // hash dos dados de posição
    getColor: selectedWaypointId,    // só recalcula cores quando seleção muda
  }
})
```

O hook `useDroneRouteLayers` deve calcular hashes leves (ex: `waypoints.length + waypoints[0]?.altitude`) como triggers em vez de passar objetos novos a cada render.

### O.7 — Layers Renderizados Sob Demanda (Fases 5, 7, 8)

Nenhum layer deck.gl é instanciado se não estiver visível. O array `layers` passado ao `DeckGLOverlay` só inclui:

- `DroneRouteLayer`: apenas se toggle **Mostrar Rota** está ativo
- `WaypointLayer`: apenas se toggle **Mostrar Waypoints** está ativo
- `FrustumLayer`: apenas se `selectedWaypointId !== null` e `mode === '3d'`
- `PoiLayer`: apenas se `poi !== null`

Em `low` tier: `FrustumLayer` desabilitado por padrão (pode ser ativado manualmente pelo usuário nas configurações avançadas).

### O.8 — Cache de Elevações com Persistência (Fase 3)

O cache in-memory de elevações (`Map<string, number>`) é perdido ao recarregar o app. Em tablets de campo, o usuário pode trabalhar offline ou em área com conexão instável.

Estender o cache para **IndexedDB** via `idb-keyval` (1KB gzipped):

```typescript
// elevationService.ts
// 1. Verificar cache IndexedDB primeiro
// 2. Se não encontrado: fetch Mapbox Terrain RGB
// 3. Armazenar no IndexedDB com TTL de 7 dias
// Chave: "elev:${lat.toFixed(4)},${lng.toFixed(4)}"
```

Isso permite que missões recorrentes na mesma área não façam fetch de elevação novamente.

Debounce de **300ms** no fetch ao arrastar waypoints para evitar rajada de requisições.

### O.9 — Configurações WebView no Android (Capacitor, Fase 1)

Garantir as seguintes configurações no projeto Android (`android/app/src/main/java/.../MainActivity.java` ou via plugin Capacitor):

```java
// Hardware acceleration explícita
getWindow().setFlags(
  WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
  WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
);

// WebView settings
WebView webView = getBridge().getWebView();
webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
webView.getSettings().setRenderPriority(WebSettings.RenderPriority.HIGH);
webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
```

E no `AndroidManifest.xml`:

```xml
<application android:hardwareAccelerated="true">
  <activity
    android:hardwareAccelerated="true"
    android:windowSoftInputMode="adjustResize" />
</application>
```

### O.10 — Nuvem de Pontos Sparse com LOD 3D (Fase 11)

O cap atual de 50k pontos é adequado para Leaflet 2D (circle markers). Em 3D via `PointCloudLayer` deck.gl, o impacto é maior pois cada ponto é uma geometria GPU.

Por tier:

| Tier | Cap de pontos (3D) | Cap de pontos (2D) |
|------|-------------------|--------------------|
| `high` | 50.000 | 50.000 |
| `low` | 15.000 | 50.000 |
| `none` | N/A | 50.000 |

O backend já tem o parâmetro de amostragem em `sparse_cloud_converter.py` — adicionar parâmetro `?max_points=` no endpoint `/sparse-cloud` para o frontend controlar conforme o tier.

### O.11 — Consideração Futura: SDK Nativo Mapbox (pós-MVP)

Se após testes reais em tablets a performance do WebView ainda for insatisfatória, considerar migrar o provedor Mapbox para o **Mapbox Maps SDK for Android** via plugin Capacitor (ex: `@capacitor-community/capacitor-mapbox`).

A diferença: o SDK nativo acessa a GPU diretamente via Kotlin/Java, sem overhead de WebView. Performance 2–3x superior para rendering de mapas. O trade-off é build Android mais complexa e código nativo adicional.

A abstração criada na Fase 1 (`IMapEngine`, `MapEngineContext`) permite essa troca sem alterar componentes de feature — apenas o provider `mapbox/` seria substituído por uma ponte para o SDK nativo. Isso deve ser planejado como uma fase separada se necessário.

### Testes

- `frustumCalculator.ts`: testar com waypoints conhecidos e verificar que footprint tem dimensão correta de acordo com altitude e FOV
- `poiCalculator.ts`: testar bearing e pitch com coordenadas conhecidas
- `elevationService.ts`: mock da API Mapbox nos testes, verificar cache e IndexedDB
- `xmp_parser.py`: fixtures de imagens DJI reais (ou bytes sintéticos com XML XMP embutido)
- `drone_models` API: testes de CRUD com validação de que modelos padrão não são editáveis
- `detectDeviceTier.ts`: testar com mock de `WEBGL_debug_renderer_info` para cada tier

---

## Resumo de Novas Dependências

**Frontend:**

| Pacote | Versão | Finalidade |
|--------|--------|-----------|
| `mapbox-gl` | ^3.x | Renderer Mapbox (lazy loaded) |
| `react-map-gl` | ^7.x | Wrapper React para Mapbox (lazy loaded) |
| `@deck.gl/core` | ^9.x | Core deck.gl (lazy loaded) |
| `@deck.gl/layers` | ^9.x | PathLayer, ScatterplotLayer, etc. (lazy loaded) |
| `@deck.gl/react` | ^9.x | Componente React DeckGL (lazy loaded) |
| `@deck.gl/mapbox` | ^9.x | Overlay para Mapbox (lazy loaded) |
| `@deck.gl/google-maps` | ^9.x | Overlay para Google Maps (lazy loaded) |
| `@react-google-maps/api` | ^2.x | Wrapper React para Google Maps (lazy loaded) |
| `idb-keyval` | ^6.x | Cache de elevações em IndexedDB (~1KB gzipped) |

**Backend:**

| Pacote | Finalidade |
|--------|-----------|
| Nenhum novo | XMP parsing via stdlib `xml.etree.ElementTree` |

---

## Ordem de Implementação Recomendada

```
Fase 1 (+ O.1, O.2, O.9) → Fase 2 → Fase 9 → Fase 3 (+ O.8)
                                                      ↓
                                  Fase 4 (+ O.3, O.4) → Fase 5 (+ O.5, O.6, O.7) → Fase 6 → Fase 7 → Fase 8 (+ O.7)
                                                                                                              ↓
                                                                                                         Fase 10 (+ O.3)
                                                                                                              ↓
                                                                                                    Fase 11 (+ O.10)
```

As otimizações marcadas com `O.x` devem ser implementadas **junto** com a fase correspondente, não como etapa posterior. Fase 9 (modelos de drone) deve ser implementada cedo pois alimenta o frustum (Fase 8) e os cálculos de rota (Fase 2/3). As fases 4–8 formam um bloco coeso de 3D e devem ser implementadas em sequência sem intercalar outras features.
