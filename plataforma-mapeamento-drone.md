# Plataforma de Mapeamento com Drone — Guia Técnico Completo

> Documento de arquitetura e implementação para desenvolvimento de plataforma similar à Maps4me  
> Stack: **React + Python (FastAPI) + OpenDroneMap**

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Stack Recomendada e Justificativa](#2-stack-recomendada-e-justificativa)
3. [Módulo 1 — Planejamento de Voo (Mapa Interativo)](#3-módulo-1--planejamento-de-voo)
4. [Módulo 2 — Cálculo de Waypoints e Grid de Voo](#4-módulo-2--cálculo-de-waypoints-e-grid-de-voo)
5. [Módulo 3 — Exportação de KMZ (Formato DJI WPML)](#5-módulo-3--exportação-de-kmz)
6. [Módulo 4 — Substituição no DJI Fly (Trick do KMZ)](#6-módulo-4--substituição-no-dji-fly)
7. [Módulo 5 — Upload e Importação de Imagens](#7-módulo-5--upload-e-importação-de-imagens)
8. [Módulo 6 — Processamento Fotogramétrico (ODM)](#8-módulo-6--processamento-fotogramétrico)
9. [Módulo 7 — Visualização dos Resultados](#9-módulo-7--visualização-dos-resultados)
10. [Módulo 8 — Download de Produtos](#10-módulo-8--download-de-produtos)
11. [Estrutura de Pastas do Projeto](#11-estrutura-de-pastas)
12. [Banco de Dados](#12-banco-de-dados)
13. [Infraestrutura e Deploy](#13-infraestrutura-e-deploy)
14. [Roadmap de Desenvolvimento](#14-roadmap-de-desenvolvimento)
15. [Funcionalidades Avançadas](#15-funcionalidades-avançadas)
16. [Aplicativo Android (Capacitor)](#16-aplicativo-android-capacitor)
17. [Integração Meteorológica](#17-integração-meteorológica)

---

## 1. Visão Geral da Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Mapa/Draw  │  │  Upload Imgs │  │  Visualização ODM   │ │
│  │  (Leaflet)  │  │  (Chunked)   │  │  (GeoTIFF + Tiles)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────┘
          │  REST/WS        │                      │
┌─────────▼────────────────▼──────────────────────▼───────────┐
│                     BACKEND (FastAPI)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  /flightplan│  │  /projects   │  │  /tasks (NodeODM)   │ │
│  │  waypoints  │  │  /upload     │  │  WebSocket status   │ │
│  │  KMZ gen    │  │  storage     │  │  download assets    │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────┘
          │                │  S3/MinIO             │
┌─────────▼────────────────▼──────┐  ┌────────────▼──────────┐
│         PostgreSQL               │  │  NodeODM (Docker)     │
│   projetos, tarefas, usuários    │  │  ODM Engine           │
└──────────────────────────────────┘  └───────────────────────┘
```

**Fluxo completo do usuário:**
1. Desenha polígono no mapa → backend calcula grid de waypoints
2. Configura parâmetros (altitude, overlap, GSD) → exporta KMZ
3. Transfere KMZ para o controle DJI → executa o voo
4. Faz upload das fotos → backend envia para NodeODM
5. ODM processa → ortomosaico, MDT, MDS, nuvem de pontos
6. Visualiza no mapa → baixa os produtos

---

## 2. Stack Recomendada e Justificativa

### Por que Python (FastAPI) no backend?

Python é **a escolha correta** para este projeto. Motivos:

- A biblioteca `drone-flightplan` (HOTOSM) calcula waypoints/grids em Python nativo
- `PyODM` é o SDK oficial para controlar NodeODM — escrito em Python
- `GDAL`, `rasterio`, `shapely`, `pyproj` — toda a stack geoespacial é Python-first
- FastAPI é async, tem tipagem, documentação automática (Swagger) e performance próxima a Node.js
- Celery + Redis para processar tarefas em background (upload, ODM job)

### Frontend

| Lib | Uso |
|-----|-----|
| React + Vite | SPA principal |
| React Leaflet | Mapa interativo |
| leaflet-draw | Desenho de polígonos/retângulos |
| @turf/turf | Cálculos geoespaciais no frontend |
| react-dropzone | Upload de imagens |
| react-query | Cache e sync de estado server |
| Zustand | State management local |
| shadcn/ui | Componentes UI |
| recharts | Gráficos de progresso |

### Backend

| Lib | Uso |
|-----|-----|
| FastAPI | API REST + WebSocket |
| PyODM | Controle do NodeODM |
| drone-flightplan | Geração de waypoints |
| shapely | Operações geoespaciais |
| pyproj | Conversão de coordenadas |
| GDAL/rasterio | Manipulação de GeoTIFF |
| rio-cogeo | Conversão para Cloud Optimized GeoTIFF |
| sse-starlette | Server-Sent Events para progresso de jobs |
| Celery + Redis | Tarefas assíncronas |
| SQLAlchemy | ORM |
| PostgreSQL + PostGIS | Banco com suporte geoespacial |
| MinIO (ou S3) | Armazenamento de imagens/resultados |

### Processamento

| Serviço | Uso |
|---------|-----|
| NodeODM (Docker) | API REST para controlar ODM |
| ODM (Docker) | Engine de fotogrametria (open source) |
| ClusterODM (opcional) | Scale horizontal para múltiplos jobs |
| TiTiler | Tile server para GeoTIFF COG (ortomosaico, DSM, DTM) |
| Martin | Vector tile server para PostGIS (AOI, waypoints, anotações) |

---

## 3. Módulo 1 — Planejamento de Voo

### O que o usuário faz:
- Busca endereço/localização
- Desenha um **polígono** (área a mapear) no mapa
- Define parâmetros: altitude de voo, sobreposição frontal/lateral, ângulo da grade
- Visualiza o grid de waypoints calculado em tempo real
- Baixa o KMZ para importar no drone

### Frontend — Componente do Mapa

```jsx
// src/components/FlightPlanner/FlightMap.jsx
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet'
import { EditControl } from 'react-leaflet-draw'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

export function FlightMap({ onPolygonChange }) {
  const handleCreated = (e) => {
    const layer = e.layer
    const geojson = layer.toGeoJSON()
    // Passa o GeoJSON do polígono para o componente pai
    onPolygonChange(geojson)
  }

  return (
    <MapContainer center={[-15.77, -47.93]} zoom={13} style={{ height: '100vh' }}>
      {/* Tile layer com satélite para melhor visualização */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri World Imagery"
      />
      <FeatureGroup>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          onEdited={(e) => {
            e.layers.eachLayer(layer => onPolygonChange(layer.toGeoJSON()))
          }}
          draw={{
            rectangle: true,    // retângulo simples
            polygon: true,      // polígono livre
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false,
          }}
        />
      </FeatureGroup>
    </MapContainer>
  )
}
```

### Frontend — Painel de Parâmetros

```jsx
// src/components/FlightPlanner/FlightParams.jsx
export function FlightParams({ params, onChange, flightStats }) {
  return (
    <div className="flight-params-panel">
      <label>
        Altitude AGL (m)
        <input type="range" min={30} max={300} 
          value={params.altitude}
          onChange={e => onChange({ ...params, altitude: +e.target.value })} />
        <span>{params.altitude}m</span>
      </label>

      <label>
        Sobreposição Frontal (%)
        <input type="range" min={60} max={95}
          value={params.forwardOverlap}
          onChange={e => onChange({ ...params, forwardOverlap: +e.target.value })} />
        <span>{params.forwardOverlap}%</span>
      </label>

      <label>
        Sobreposição Lateral (%)
        <input type="range" min={60} max={90}
          value={params.sideOverlap}
          onChange={e => onChange({ ...params, sideOverlap: +e.target.value })} />
        <span>{params.sideOverlap}%</span>
      </label>

      <label>
        Ângulo da Grade (°)
        <input type="range" min={0} max={180}
          value={params.rotationAngle}
          onChange={e => onChange({ ...params, rotationAngle: +e.target.value })} />
        <span>{params.rotationAngle}°</span>
      </label>

      {/* Drone preset */}
      <select value={params.droneModel} 
        onChange={e => onChange({ ...params, droneModel: e.target.value })}>
        <option value="dji_mini_4_pro">DJI Mini 4 Pro</option>
        <option value="dji_mini_5_pro">DJI Mini 5 Pro</option>
        <option value="dji_air_3">DJI Air 3</option>
        <option value="dji_mavic_3">DJI Mavic 3</option>
        <option value="dji_phantom_4">DJI Phantom 4 Pro</option>
        <option value="custom">Câmera customizada</option>
      </select>

      {/* Estatísticas calculadas */}
      {flightStats && (
        <div className="flight-stats">
          <div>GSD: <strong>{flightStats.gsd} cm/px</strong></div>
          <div>Área: <strong>{flightStats.area_ha} ha</strong></div>
          <div>Waypoints: <strong>{flightStats.waypoint_count}</strong></div>
          <div>Faixas: <strong>{flightStats.strip_count}</strong></div>
          <div>Fotos estimadas: <strong>{flightStats.photo_count}</strong></div>
          <div>Tempo estimado: <strong>{flightStats.estimated_time} min</strong></div>
          <div>Baterias: <strong>{flightStats.batteries_needed}</strong></div>
        </div>
      )}
    </div>
  )
}
```

---

## 4. Módulo 2 — Cálculo de Waypoints e Grid de Voo

### Conceitos fundamentais

**GSD (Ground Sampling Distance)** = tamanho real de 1 pixel no terreno

```
GSD (m/px) = (altitude × sensor_width_mm) / (focal_length_mm × image_width_px)
```

**Footprint da câmera** = área coberta por cada foto

```
footprint_width = GSD × image_width_px   (metros)
footprint_height = GSD × image_height_px (metros)
```

**Espaçamento entre faixas** (side spacing):
```
side_spacing = footprint_width × (1 - side_overlap/100)
```

**Espaçamento entre fotos** (trigger interval):
```
photo_spacing = footprint_height × (1 - forward_overlap/100)
```

### Especificações de drones DJI (presets)

```python
DRONE_SPECS = {
    "dji_mini_4_pro": {
        "sensor_width_mm": 9.6,
        "sensor_height_mm": 7.2,
        "focal_length_mm": 24,   # equivalente 35mm
        "image_width_px": 4032,
        "image_height_px": 3024,
        "max_speed_ms": 15,
        "battery_time_min": 34,
    },
    "dji_mini_5_pro": {
        "sensor_width_mm": 13.2,   # 1" (especificações reportadas)
        "sensor_height_mm": 8.8,
        "focal_length_mm": 24,
        "image_width_px": 8192,    # 50 MP (4:3)
        "image_height_px": 6144,
        "max_speed_ms": 18,        # bateria padrão (19 m/s com bateria Plus)
        "battery_time_min": 36,    # bateria padrão (até 52 min com bateria Plus)
    },
    "dji_air_3": {
        "sensor_width_mm": 9.6,
        "sensor_height_mm": 7.2,
        "focal_length_mm": 24,
        "image_width_px": 4056,
        "image_height_px": 3040,
        "max_speed_ms": 19,
        "battery_time_min": 46,
    },
    "dji_mavic_3": {
        "sensor_width_mm": 17.3,
        "sensor_height_mm": 13.0,
        "focal_length_mm": 24,
        "image_width_px": 5280,
        "image_height_px": 3956,
        "max_speed_ms": 21,
        "battery_time_min": 46,
    },
    "dji_phantom_4": {
        "sensor_width_mm": 13.2,
        "sensor_height_mm": 8.8,
        "focal_length_mm": 24,
        "image_width_px": 5472,
        "image_height_px": 3648,
        "max_speed_ms": 16,
        "battery_time_min": 30,
    },
}
```

### Backend — Endpoint de cálculo de waypoints

```python
# backend/app/routers/flightplan.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import math
from shapely.geometry import shape, mapping, LineString, Point
from shapely.affinity import rotate
import pyproj
from functools import partial

router = APIRouter(prefix="/flightplan", tags=["flightplan"])

class FlightPlanRequest(BaseModel):
    polygon_geojson: dict       # GeoJSON Feature do polígono
    altitude_m: float = 100     # Altitude AGL em metros
    forward_overlap: float = 80 # % sobreposição frontal
    side_overlap: float = 70    # % sobreposição lateral
    rotation_angle: float = 0   # Ângulo da grade em graus
    drone_model: str = "dji_mini_4_pro"
    speed_ms: float = 8         # Velocidade de voo (m/s)

class WaypointResponse(BaseModel):
    waypoints: List[dict]       # lista de {lat, lon, alt}
    waylines: List[dict]        # linhas de voo para visualização
    stats: dict                 # estatísticas calculadas

@router.post("/calculate", response_model=WaypointResponse)
async def calculate_flight_plan(req: FlightPlanRequest):
    specs = DRONE_SPECS.get(req.drone_model)
    if not specs:
        raise HTTPException(400, "Drone model not found")

    polygon = shape(req.polygon_geojson["geometry"])

    # Projeção local UTM para cálculos métricos
    centroid = polygon.centroid
    utm_zone = int((centroid.x + 180) / 6) + 1
    hemisphere = "north" if centroid.y >= 0 else "south"
    utm_crs = pyproj.CRS(f"+proj=utm +zone={utm_zone} +{hemisphere} +ellps=WGS84")
    wgs84 = pyproj.CRS("EPSG:4326")
    
    project_to_utm = pyproj.Transformer.from_crs(wgs84, utm_crs, always_xy=True).transform
    project_to_wgs = pyproj.Transformer.from_crs(utm_crs, wgs84, always_xy=True).transform

    # Calcula GSD
    gsd_m = (req.altitude_m * specs["sensor_width_mm"]) / \
            (specs["focal_length_mm"] * specs["image_width_px"]) / 1000
    
    # Footprint da câmera
    fp_width = gsd_m * specs["image_width_px"]   # metros
    fp_height = gsd_m * specs["image_height_px"]  # metros

    # Espaçamentos
    side_spacing = fp_width * (1 - req.side_overlap / 100)
    photo_spacing = fp_height * (1 - req.forward_overlap / 100)

    # Converte polígono para UTM
    from shapely.ops import transform
    poly_utm = transform(project_to_utm, polygon)
    
    # Rotaciona polígono para alinhar com ângulo da grade
    rotated_poly = rotate(poly_utm, req.rotation_angle, origin='centroid')
    minx, miny, maxx, maxy = rotated_poly.bounds

    # Gera faixas de voo (strips)
    strips = []
    x = minx
    strip_idx = 0
    while x <= maxx + side_spacing:
        # Linha vertical nesta faixa
        line = LineString([(x, miny - 50), (x, maxy + 50)])
        # Clip na área de interesse
        clipped = line.intersection(rotated_poly.buffer(10))
        if not clipped.is_empty:
            # Inverte a direção em faixas alternadas (serpentina)
            coords = list(clipped.coords) if hasattr(clipped, 'coords') else []
            if strip_idx % 2 == 1:
                coords = coords[::-1]
            strips.append(coords)
        x += side_spacing
        strip_idx += 1

    # Gera waypoints ao longo das faixas
    waypoints = []
    for strip in strips:
        if len(strip) >= 2:
            start = strip[0]
            end = strip[-1]
            line = LineString([start, end])
            length = line.length
            # Waypoints a cada photo_spacing metros
            distances = [i * photo_spacing for i in range(int(length / photo_spacing) + 1)]
            distances.append(length)  # Garante que o último ponto está incluído
            for d in distances:
                pt = line.interpolate(d)
                # Rotaciona de volta para UTM original
                pt_original = rotate(pt, -req.rotation_angle, 
                                      origin=poly_utm.centroid)
                # Converte para WGS84
                lon, lat = project_to_wgs(pt_original.x, pt_original.y)
                waypoints.append({
                    "lat": round(lat, 8),
                    "lon": round(lon, 8),
                    "alt": req.altitude_m,
                })

    # Calcula estatísticas
    # CORRETO: usa elipsoide WGS84 diretamente — sem distorção em qualquer latitude
    # ATENÇÃO: polygon.area retorna graus quadrados (não m²) — nunca usar para área real
    geod = pyproj.Geod(ellps="WGS84")
    area_m2, _ = geod.geometry_area_perimeter(polygon)
    area_m2 = abs(area_m2)
    area_ha = round(area_m2 / 10_000, 2)

    # CORRETO: distância geodésica real via pyproj.Geod.inv()
    # ATENÇÃO: o multiplicador 111320 (m/grau) só é preciso no equador;
    #          a 60° de latitude o erro no eixo E-W ultrapassa 50%
    def _geodesic_dist(lat1, lon1, lat2, lon2) -> float:
        _, _, d = geod.inv(lon1, lat1, lon2, lat2)
        return d

    flight_distance = sum(
        _geodesic_dist(waypoints[i]["lat"], waypoints[i]["lon"],
                       waypoints[i+1]["lat"], waypoints[i+1]["lon"])
        for i in range(len(waypoints) - 1)
    ) if len(waypoints) > 1 else 0

    est_time_min = round(flight_distance / (req.speed_ms * 60), 1)
    battery_time = specs["battery_time_min"] * 0.8  # 80% segurança
    batteries = math.ceil(est_time_min / battery_time)

    stats = {
        "gsd_cm": round(gsd_m * 100, 2),
        "area_ha": area_ha,
        "waypoint_count": len(waypoints),
        "strip_count": len(strips),
        "photo_count": len(waypoints),
        "side_spacing_m": round(side_spacing, 1),
        "photo_spacing_m": round(photo_spacing, 1),
        "footprint_width_m": round(fp_width, 1),
        "footprint_height_m": round(fp_height, 1),
        "flight_distance_m": round(flight_distance),
        "estimated_time_min": est_time_min,
        "batteries_needed": batteries,
    }

    # Waylines para visualização no frontend
    waylines = [{"coords": strip} for strip in strips[:5]]  # primeiras 5 para preview

    return WaypointResponse(
        waypoints=waypoints,
        waylines=waylines,
        stats=stats
    )
```

---

## 5. Módulo 3 — Exportação de KMZ

### Formato DJI WPML

O KMZ da DJI é um **arquivo ZIP** com dois XMLs dentro:

```
missao.kmz
├── wpmz/
│   ├── template.kml    ← define os parâmetros da missão
│   └── waylines.wpml   ← define os waypoints executáveis
```

### Backend — Gerador de KMZ

```python
# backend/app/services/kmz_generator.py
import zipfile
import io
from datetime import datetime
from typing import List, Dict

def generate_dji_kmz(
    waypoints: List[Dict],
    altitude: float,
    speed: float = 8.0,
    drone_model: str = "Mavic3",
    finish_action: str = "goHome",
) -> bytes:
    """
    Gera um KMZ compatível com DJI Fly / DJI Pilot 2 no formato WPML.
    
    Args:
        waypoints: lista de {lat, lon, alt}
        altitude: altitude AGL em metros
        speed: velocidade de cruzeiro em m/s
        drone_model: modelo do drone DJI
        finish_action: goHome | autoLand | noAction
    
    Returns:
        bytes do arquivo KMZ
    """
    timestamp = int(datetime.now().timestamp() * 1000)
    
    # ─── template.kml ─────────────────────────────────────────────────
    template_kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>DroneMapper Platform</wpml:author>
  <wpml:createTime>{timestamp}</wpml:createTime>
  <wpml:updateTime>{timestamp}</wpml:updateTime>
  
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>{finish_action}</wpml:finishAction>
    <wpml:exitOnRCLost>goContinue</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>hover</wpml:executeRCLostAction>
    <wpml:globalTransitionalSpeed>{speed}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>67</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
    </wpml:droneInfo>
  </wpml:missionConfig>

  <Folder>
    <wpml:templateId>0</wpml:templateId>
    <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
    </wpml:waylineCoordinateSysParam>
    <wpml:autoFlightSpeed>{speed}</wpml:autoFlightSpeed>
    <wpml:templateType>waypoint</wpml:templateType>
    <wpml:globalWaypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:globalWaypointTurnMode>
    <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>
    <wpml:gimbalPitchMode>usePointSetting</wpml:gimbalPitchMode>
    
    {''.join(_waypoint_placemark(i, wp) for i, wp in enumerate(waypoints))}
  </Folder>
</Document>
</kml>"""

    # ─── waylines.wpml ────────────────────────────────────────────────
    waylines_wpml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <Folder>
    <wpml:templateId>0</wpml:templateId>
    <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
    <wpml:waylineId>0</wpml:waylineId>
    <wpml:distance>{_total_distance(waypoints):.1f}</wpml:distance>
    <wpml:duration>{_total_duration(waypoints, speed):.1f}</wpml:duration>
    <wpml:autoFlightSpeed>{speed}</wpml:autoFlightSpeed>
    
    {''.join(_waypoint_placemark(i, wp) for i, wp in enumerate(waypoints))}
  </Folder>
</Document>
</kml>"""

    # ─── Empacota como KMZ (ZIP) ──────────────────────────────────────
    kmz_buffer = io.BytesIO()
    with zipfile.ZipFile(kmz_buffer, 'w', zipfile.ZIP_DEFLATED) as kmz:
        kmz.writestr("wpmz/template.kml", template_kml)
        kmz.writestr("wpmz/waylines.wpml", waylines_wpml)
    
    return kmz_buffer.getvalue()


def _waypoint_placemark(index: int, wp: Dict) -> str:
    """Gera o XML de um waypoint individual."""
    return f"""
    <Placemark>
      <Point>
        <coordinates>{wp['lon']},{wp['lat']},{wp['alt']}</coordinates>
      </Point>
      <wpml:index>{index}</wpml:index>
      <wpml:executeHeight>{wp['alt']}</wpml:executeHeight>
      <wpml:waypointSpeed>8</wpml:waypointSpeed>
      <wpml:waypointHeadingParam>
        <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
      </wpml:waypointHeadingParam>
      <wpml:waypointTurnParam>
        <wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode>
        <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
      </wpml:waypointTurnParam>
      <wpml:useStraightLine>1</wpml:useStraightLine>
      <wpml:actionGroup>
        <wpml:actionGroupId>{index}</wpml:actionGroupId>
        <wpml:actionGroupStartIndex>{index}</wpml:actionGroupStartIndex>
        <wpml:actionGroupEndIndex>{index}</wpml:actionGroupEndIndex>
        <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
        <wpml:actionTrigger>
          <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
        </wpml:actionTrigger>
        <wpml:action>
          <wpml:actionId>0</wpml:actionId>
          <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
          <wpml:actionActuatorFuncParam>
            <wpml:fileSuffix>drone_mapper</wpml:fileSuffix>
            <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
          </wpml:actionActuatorFuncParam>
        </wpml:action>
      </wpml:actionGroup>
    </Placemark>"""


def _total_distance(waypoints: List[Dict]) -> float:
    import math
    total = 0
    for i in range(len(waypoints) - 1):
        lat1, lon1 = waypoints[i]["lat"], waypoints[i]["lon"]
        lat2, lon2 = waypoints[i+1]["lat"], waypoints[i+1]["lon"]
        total += math.sqrt((lat2 - lat1)**2 + (lon2 - lon1)**2) * 111320
    return total

def _total_duration(waypoints: List[Dict], speed: float) -> float:
    return _total_distance(waypoints) / speed
```

### Endpoint FastAPI para download

```python
# backend/app/routers/flightplan.py (adição)
from fastapi.responses import StreamingResponse
import io

@router.post("/export-kmz")
async def export_kmz(req: FlightPlanRequest):
    # Primeiro calcula os waypoints
    plan = await calculate_flight_plan(req)
    
    # Gera o KMZ
    kmz_bytes = generate_dji_kmz(
        waypoints=plan.waypoints,
        altitude=req.altitude_m,
        speed=8.0,
    )
    
    return StreamingResponse(
        io.BytesIO(kmz_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=missao_drone.kmz"}
    )
```

---

## 6. Módulo 4 — Substituição no DJI Fly

### Como funciona (sem SDK)

Para drones **sem suporte SDK** (Mini 4 Pro, Mini 5 Pro, Air 3, Mavic 3 Classic, etc.), o fluxo é:

1. **Criar missão dummy no DJI Fly** — qualquer missão com alguns waypoints
2. **Conectar o controle remoto no PC** via USB-C
3. **Localizar o arquivo** em: `Android/data/dji.go.v5/files/waypoint/{UUID}/`
4. **Copiar o nome do arquivo** (é um UUID, ex: `550E8400-E29B-41D4-A716-446655440000`)
5. **Renomear o KMZ gerado** para esse mesmo UUID
6. **Substituir o arquivo** no controle
7. **Reabrir a missão** no DJI Fly — ela aparece atualizada com os waypoints do nosso KMZ

### Como documentar isso na plataforma

```jsx
// src/components/FlightPlanner/TransferGuide.jsx
export function TransferGuide({ kmmDownloadUrl }) {
  const steps = [
    {
      step: 1,
      title: "Crie uma missão dummy no DJI Fly",
      detail: "No seu controle remoto, abra DJI Fly → Waypoints → adicione alguns pontos → salve."
    },
    {
      step: 2,
      title: "Conecte o controle no PC via USB-C",
      detail: "Habilite 'Transferência de arquivos' quando o prompt aparecer."
    },
    {
      step: 3,
      title: "Localize o arquivo da missão",
      detail: "No Explorador de Arquivos: Android/data/dji.go.v5/files/waypoint/[UUID]/"
    },
    {
      step: 4,
      title: "Copie o nome da pasta (UUID)",
      detail: "Exemplo: 550E8400-E29B-41D4-A716-446655440000"
    },
    {
      step: 5,
      title: "Baixe e renomeie o KMZ",
      detail: "Baixe o KMZ gerado aqui e renomeie para o mesmo UUID copiado."
    },
    {
      step: 6,
      title: "Substitua o arquivo",
      detail: "Cole o KMZ renomeado na pasta do controle, substituindo o arquivo antigo."
    },
    {
      step: 7,
      title: "Reabra no DJI Fly",
      detail: "Abra a missão — ela deve aparecer com todos os waypoints do plano gerado."
    },
  ]

  return (
    <div className="transfer-guide">
      <h3>Como transferir para o DJI Fly</h3>
      {steps.map(s => (
        <div key={s.step} className="step">
          <span className="step-number">{s.step}</span>
          <div>
            <strong>{s.title}</strong>
            <p>{s.detail}</p>
          </div>
        </div>
      ))}
      <a href={kmmDownloadUrl} className="btn-download">
        ⬇ Baixar KMZ
      </a>
    </div>
  )
}
```

---

## 7. Módulo 5 — Upload e Importação de Imagens

### Upload em chunks (chunked upload)

Para uploads de centenas de fotos (1-10 GB), use upload multipart em chunks.

> **Alternativa recomendada para uso em campo: protocolo tus.io**
> O tus é um protocolo de upload **resumível** sobre HTTP — se a conexão cair no meio do upload
> (comum em campo com 4G instável), o cliente retoma do ponto onde parou sem re-enviar os chunks anteriores.
>
> - Client: `tus-js-client` ou `@uppy/tus`
> - Server: `pip install tuspy` (servidor tus para Python/FastAPI)
>
> A implementação abaixo (chunks manuais via POST) funciona bem em redes estáveis.
> Para uso em campo, migre para tus.

```python
# backend/app/routers/projects.py
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, File, Form, HTTPException

UPLOAD_DIR = Path("/data/uploads")

@router.post("/projects/{project_id}/images/upload-chunk")
async def upload_image_chunk(
    project_id: str,
    file: UploadFile = File(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    file_id: str = Form(...),
):
    """Upload de uma imagem em chunks para suportar arquivos grandes."""
    
    project_dir = UPLOAD_DIR / project_id
    temp_dir = project_dir / "temp" / file_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Salva o chunk
    chunk_path = temp_dir / f"chunk_{chunk_index:05d}"
    async with aiofiles.open(chunk_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Se for o último chunk, remonta o arquivo
    if chunk_index == total_chunks - 1:
        final_path = project_dir / "images" / filename
        final_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(final_path, 'wb') as final_file:
            for i in range(total_chunks):
                chunk = temp_dir / f"chunk_{i:05d}"
                async with aiofiles.open(chunk, 'rb') as cf:
                    await final_file.write(await cf.read())
        
        # Limpa chunks temporários
        import shutil
        shutil.rmtree(temp_dir)
        
        return {"status": "complete", "filename": filename}
    
    return {"status": "partial", "chunk": chunk_index}
```

### Frontend — Componente de Upload

```jsx
// src/components/Upload/ImageUploader.jsx
import { useDropzone } from 'react-dropzone'
import { useState, useCallback } from 'react'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB por chunk

export function ImageUploader({ projectId, onComplete }) {
  const [files, setFiles] = useState([])
  const [progress, setProgress] = useState({})
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/tiff': ['.tif', '.tiff'] },
    multiple: true,
  })

  const uploadFile = async (file) => {
    const fileId = crypto.randomUUID()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const chunk = file.slice(start, start + CHUNK_SIZE)
      
      const formData = new FormData()
      formData.append('file', chunk)
      formData.append('chunk_index', i)
      formData.append('total_chunks', totalChunks)
      formData.append('filename', file.name)
      formData.append('file_id', fileId)
      
      await fetch(`/api/projects/${projectId}/images/upload-chunk`, {
        method: 'POST',
        body: formData,
      })
      
      setProgress(prev => ({
        ...prev,
        [file.name]: Math.round(((i + 1) / totalChunks) * 100)
      }))
    }
  }

  const handleUploadAll = async () => {
    setUploading(true)
    // Upload em paralelo (máximo 3 simultâneos)
    const queue = [...files]
    const workers = 3
    
    const processQueue = async () => {
      while (queue.length > 0) {
        const file = queue.shift()
        await uploadFile(file)
      }
    }
    
    await Promise.all(Array(workers).fill(null).map(processQueue))
    setUploading(false)
    onComplete()
  }

  return (
    <div className="uploader">
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
        <input {...getInputProps()} />
        <p>Arraste as fotos do drone aqui, ou clique para selecionar</p>
        <p className="hint">JPG, JPEG, TIF, TIFF — com metadados GPS (EXIF)</p>
      </div>

      {files.length > 0 && (
        <>
          <div className="file-list">
            {files.map(f => (
              <div key={f.name} className="file-item">
                <span>{f.name}</span>
                <span>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <progress value={progress[f.name] || 0} max={100} />
              </div>
            ))}
          </div>
          <button onClick={handleUploadAll} disabled={uploading}>
            {uploading ? 'Enviando...' : `Fazer upload de ${files.length} imagens`}
          </button>
        </>
      )}
    </div>
  )
}
```

---

## 8. Módulo 6 — Processamento Fotogramétrico

### Arquitetura de processamento

```
Frontend → POST /tasks → FastAPI → Celery Worker → NodeODM → ODM → resultados
                ↑                                              ↓
           SSE stream ←────────────── push a cada 3s ─────────┘
```

### Backend — Serviço de processamento com PyODM

```python
# backend/app/services/processing.py
from pyodm import Node, exceptions
from celery import shared_task
import asyncio
import logging

ODM_NODE_HOST = "localhost"
ODM_NODE_PORT = 3000

# ─── CONFIGURAÇÃO CRÍTICA PARA JOBS LONGOS ───────────────────────────────────
# O visibility_timeout padrão do Redis é 1 hora.
# Um job ODM de 4h será re-enfileirado automaticamente sem esta config,
# causando processamento duplicado ou falha silenciosa.
# Configure no celery app ou via variável CELERY_BROKER_TRANSPORT_OPTIONS.
#
# celery_app.conf.update(
#     task_acks_late=True,
#     broker_transport_options={"visibility_timeout": 43200},  # 12 horas
# )
# ─────────────────────────────────────────────────────────────────────────────

@shared_task(bind=True, acks_late=True)
def process_images_task(self, project_id: str, image_paths: list, options: dict):
    """
    Task Celery para processar imagens com ODM via NodeODM.
    """
    node = Node(ODM_NODE_HOST, ODM_NODE_PORT)
    
    try:
        # Verifica disponibilidade do nó
        info = node.info()
        logging.info(f"NodeODM v{info.version} disponível")
        
        # Opções de processamento ODM
        odm_options = {
            "orthophoto-resolution": options.get("resolution", 5),  # cm/px
            "dsm": True,          # Gera Modelo Digital de Superfície
            "dtm": True,          # Gera Modelo Digital de Terreno
            "pc-las": True,       # Gera nuvem de pontos em .las
            "3d-tiles": True,     # Gera tiles 3D
            "feature-quality": options.get("feature_quality", "high"),
            "min-num-features": 8000,
            "matcher-neighbors": 8,
            "mesh-size": 200000,
            "ignore-gsd": False,
        }
        
        # Adiciona GCPs se disponíveis
        extra_files = []
        gcp_path = f"/data/uploads/{project_id}/gcp_list.txt"
        if Path(gcp_path).exists():
            extra_files.append(gcp_path)
            odm_options["use-3dmesh"] = True
        
        # Cria task no NodeODM
        task = node.create_task(
            files=image_paths + extra_files,
            options=odm_options,
            name=f"Projeto {project_id}"
        )
        
        logging.info(f"Task ODM criada: {task.uuid}")
        
        # Atualiza status no banco (via callback)
        update_project_status(project_id, "processing", {"task_uuid": task.uuid})
        
        # Aguarda conclusão com callback de progresso
        def on_status(info):
            progress = info.progress or 0
            update_project_status(project_id, "processing", {
                "progress": progress,
                "task_uuid": task.uuid
            })
            self.update_state(state='PROGRESS', meta={'progress': progress})
        
        task.wait_for_completion(
            status_callback=on_status,
            interval=5  # verifica a cada 5 segundos
        )
        
        # Faz download dos resultados
        results_dir = f"/data/results/{project_id}"
        task.download_assets(results_dir)

        # Converte ortomosaico para COG (Cloud Optimized GeoTIFF)
        # Obrigatório para TiTiler funcionar via HTTP range requests —
        # sem COG o TiTiler precisa ler o arquivo inteiro a cada tile
        convert_to_cog(
            Path(results_dir) / "odm_orthophoto" / "odm_orthophoto.tif"
        )
        
        # Organiza os arquivos de resultado
        assets = organize_results(project_id, results_dir)
        update_project_status(project_id, "completed", {"assets": assets})
        
        return {"status": "completed", "assets": assets}
        
    except exceptions.TaskFailedError as e:
        logging.error(f"ODM task failed: {e}")
        update_project_status(project_id, "failed", {"error": str(e)})
        raise
    except Exception as e:
        logging.error(f"Processing error: {e}")
        update_project_status(project_id, "failed", {"error": str(e)})
        raise


def convert_to_cog(tif_path: Path) -> None:
    """
    Converte um GeoTIFF para Cloud Optimized GeoTIFF (COG) in-place.

    COG é obrigatório para o TiTiler servir tiles eficientemente:
    o servidor lê apenas os bytes do tile requisitado via HTTP range requests,
    sem carregar o arquivo inteiro em memória.
    Usa compressão Deflate com overview pyramid embutida.
    """
    from rio_cogeo.cogeo import cog_translate
    from rio_cogeo.profiles import cog_profiles

    if not tif_path.exists():
        return

    tmp = tif_path.with_suffix(".cog.tif")
    cog_translate(str(tif_path), str(tmp), cog_profiles.get("deflate"),
                  overview_resampling="average", quiet=True)
    tmp.replace(tif_path)  # substitui o original pelo COG


def organize_results(project_id: str, results_dir: str) -> dict:
    """Organiza e registra os assets gerados pelo ODM."""
    base = Path(results_dir)
    assets = {}
    
    # Ortomosaico
    ortho = base / "odm_orthophoto" / "odm_orthophoto.tif"
    if ortho.exists():
        assets["orthophoto"] = str(ortho)
    
    # DSM (Modelo Digital de Superfície)
    dsm = base / "odm_dem" / "dsm.tif"
    if dsm.exists():
        assets["dsm"] = str(dsm)
    
    # DTM (Modelo Digital de Terreno)
    dtm = base / "odm_dem" / "dtm.tif"
    if dtm.exists():
        assets["dtm"] = str(dtm)
    
    # Nuvem de pontos
    pc = base / "odm_pointcloud" / "odm_pointcloud.las"
    if pc.exists():
        assets["point_cloud"] = str(pc)
    
    # Modelo 3D texturizado
    model_3d = base / "odm_texturing" / "odm_textured_model_geo.obj"
    if model_3d.exists():
        assets["model_3d"] = str(model_3d)
    
    # Relatório
    report = base / "odm_report" / "report.pdf"
    if report.exists():
        assets["report"] = str(report)
    
    # Curvas de nível (requer pós-processamento)
    contours = generate_contours(dtm, project_id)
    if contours:
        assets["contours"] = contours
    
    return assets


def generate_contours(dtm_path, project_id, interval_m=1.0):
    """
    Gera curvas de nível a partir do DTM usando GDAL Python bindings.

    Prefira as bindings Python ao invés de subprocess(gdal_contour) porque:
    - Tratamento de erro via exceções Python (sem checar returncode)
    - Sem risco de shell injection
    - Mesmo algoritmo e output — apenas API mais segura e testável
    - Output em GeoJSON (leitura direta no frontend) ao invés de .shp
    """
    from osgeo import gdal, ogr

    if not dtm_path or not Path(dtm_path).exists():
        return None

    output = f"/data/results/{project_id}/contours.geojson"

    try:
        ds = gdal.Open(str(dtm_path))
        band = ds.GetRasterBand(1)

        drv = ogr.GetDriverByName("GeoJSON")
        dst_ds = drv.CreateDataSource(output)
        dst_layer = dst_ds.CreateLayer("contours", srs=None)
        dst_layer.CreateField(ogr.FieldDefn("elevation", ogr.OFTReal))

        gdal.ContourGenerate(
            band,
            interval_m,   # intervalo entre curvas (metros)
            0,            # base offset
            [],           # fixed levels (vazio = usa intervalo)
            0,            # useNoData flag
            0,            # noDataValue
            dst_layer,
            -1,           # idField (-1 = não gera ID)
            0,            # elevField (índice do campo elevation)
        )

        dst_ds = None  # flush e fecha o arquivo
        ds = None
        return output
    except Exception as e:
        logging.error(f"Erro ao gerar curvas de nível: {e}")
        return None
```

### Opções de processamento ODM (configuráveis pelo usuário)

```python
PROCESSING_PRESETS = {
    "fast": {
        "feature-quality": "medium",
        "orthophoto-resolution": 10,
        "min-num-features": 4000,
        "dsm": True,
        "dtm": False,
        "pc-las": False,
    },
    "standard": {
        "feature-quality": "high",
        "orthophoto-resolution": 5,
        "min-num-features": 8000,
        "dsm": True,
        "dtm": True,
        "pc-las": True,
    },
    "ultra": {
        "feature-quality": "ultra",
        "orthophoto-resolution": 2,
        "min-num-features": 12000,
        "pc-quality": "ultra",
        "dsm": True,
        "dtm": True,
        "dtm-resolution": 5,
        "pc-las": True,
        "3d-tiles": True,
    }
}
```

### SSE (Server-Sent Events) para progresso em tempo real

> **Por que SSE ao invés de WebSocket?**
> O progresso de processamento é **unidirecional** — o servidor envia, o cliente só recebe.
> SSE é a ferramenta correta para este padrão:
> - Reconexão automática com `Last-Event-ID` (se o browser fechar e reabrir, retoma de onde parou)
> - Funciona por qualquer proxy/load balancer sem configuração especial (é HTTP puro)
> - Sem overhead de masking que o protocolo WebSocket impõe em cada frame
> - `pip install sse-starlette`
>
> Use WebSocket apenas se precisar de comunicação bidirecional (ex: usuário pausar/cancelar job).

```python
# backend/app/routers/sse.py
import json
import asyncio
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

router = APIRouter()

@router.get("/projects/{project_id}/status/stream")
async def project_status_stream(project_id: str):
    """
    SSE endpoint — o cliente se conecta uma vez e recebe updates em push.
    Reconecta automaticamente se a conexão cair (comportamento nativo do browser).
    """
    async def event_generator():
        while True:
            project = await db.get_project(project_id)
            yield {
                "event": "status",
                "data": json.dumps({
                    "status": project.status,
                    "progress": project.progress,
                    "assets": project.assets,
                }),
            }
            if project.status in ["completed", "failed"]:
                break
            await asyncio.sleep(3)

    return EventSourceResponse(event_generator())
```

```jsx
// Frontend — hook para consumir o SSE
// src/hooks/useProjectStatus.js
import { useEffect, useState } from 'react'

export function useProjectStatus(projectId) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!projectId) return
    // EventSource reconecta automaticamente em caso de queda de rede
    const es = new EventSource(`/api/projects/${projectId}/status/stream`)
    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      setStatus(data)
      if (['completed', 'failed'].includes(data.status)) {
        es.close()
      }
    })
    return () => es.close()
  }, [projectId])

  return status
}
```

---

## 9. Módulo 7 — Visualização dos Resultados

### Visualização de GeoTIFF (ortomosaico) no browser

O GeoTIFF é grande demais para carregar direto. Use **TiTiler** como tile server para rasters
e **Martin** para vector tiles do PostGIS (polígonos de voo, waypoints, anotações):

> **Pré-requisito**: o ortomosaico deve estar em formato **COG** (Cloud Optimized GeoTIFF).
> A função `convert_to_cog()` no módulo de processamento faz essa conversão automaticamente.
> Sem COG, o TiTiler precisa ler o arquivo inteiro para cada tile — inviável para arquivos de 1-5 GB.

```yaml
# docker-compose.yml
services:
  # TiTiler — tiles raster (ortomosaico COG, DSM, DTM)
  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "8001:8000"
    environment:
      - GDAL_CACHEMAX=512
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=1000000000  # 1GB cache para COGs
    volumes:
      - ./data:/data

  # Martin — tiles vetoriais do PostGIS (Rust, binário único, alta performance)
  # Serve polígonos de AOI, waypoints e anotações diretamente do banco
  martin:
    image: ghcr.io/maplibre/martin:latest
    ports:
      - "3002:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dronemapper
    command: --config /config/martin.yaml
```

```jsx
// src/components/Results/OrthophotoViewer.jsx
import { TileLayer } from 'react-leaflet'

export function OrthophotoLayer({ projectId }) {
  // TiTiler lê o COG diretamente do MinIO via HTTP range requests
  // Substitua localhost pelo endereço do MinIO em produção
  const tileUrl = `http://localhost:8001/cog/tiles/{z}/{x}/{y}.png` +
    `?url=/data/results/${projectId}/odm_orthophoto/odm_orthophoto.tif` +
    `&rescale=0,255`

  return (
    <TileLayer
      url={tileUrl}
      opacity={0.9}
      maxZoom={22}
    />
  )
}
```

### Visualização de Nuvem de Pontos 3D

Use **Potree 1.8.2** (open source, WebGL, suporte nativo a COPC):

> **Formato recomendado: COPC (Cloud Optimized Point Cloud)**
> COPC é um único arquivo `.copc.laz` com índice espacial embutido.
> O Potree baixa apenas os nós do octree que estão na view atual via HTTP range requests —
> o mesmo princípio do COG para raster. Elimina a complexidade do EPT (dezenas de milhares de arquivos).
>
> **Conversão**: use `pdal pipeline` com o writer COPC, ou `untwine` (mais rápido para arquivos grandes):
> ```bash
> # Com untwine (recomendado para grandes nuvens de pontos)
> untwine --files odm_pointcloud.las --output_dir pointcloud_copc/
>
> # Com PDAL
> pdal translate odm_pointcloud.las odm_pointcloud.copc.laz --writer copc
> ```
>
> **PotreeConverter 2.0**: se quiser o formato octree Potree nativo (alternativa ao COPC),
> use a versão 2.0 — gera apenas 3 arquivos (vs milhões na v1.7) e é 10-50x mais rápida.

```jsx
// src/components/Results/PointCloudViewer.jsx
// Potree 1.8.2 lê COPC diretamente — sem conversão de formato adicional
export function PointCloudViewer({ projectId }) {
  return (
    <iframe
      src={`/static/potree/index.html?project=${projectId}`}
      style={{ width: '100%', height: '600px', border: 'none' }}
    />
  )
}
```

### Painel de resultados completo

```jsx
// src/components/Results/ResultsDashboard.jsx
import { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'

export function ResultsDashboard({ project }) {
  const [activeLayer, setActiveLayer] = useState('orthophoto')
  const { assets, stats } = project

  const layers = {
    orthophoto: { label: 'Ortomosaico', available: !!assets.orthophoto },
    dsm: { label: 'MDS (Superfície)', available: !!assets.dsm },
    dtm: { label: 'MDT (Terreno)', available: !!assets.dtm },
    contours: { label: 'Curvas de Nível', available: !!assets.contours },
  }

  return (
    <div className="results-dashboard">
      {/* Mapa com camadas */}
      <div className="map-container">
        <MapContainer>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {activeLayer === 'orthophoto' && assets.orthophoto && (
            <OrthophotoLayer projectId={project.id} />
          )}
        </MapContainer>

        {/* Seletor de camadas */}
        <div className="layer-selector">
          {Object.entries(layers).map(([key, layer]) => (
            <button
              key={key}
              className={activeLayer === key ? 'active' : ''}
              disabled={!layer.available}
              onClick={() => setActiveLayer(key)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Painel de downloads */}
      <div className="downloads-panel">
        <h3>Produtos disponíveis</h3>
        
        {assets.orthophoto && (
          <DownloadCard
            title="Ortomosaico (GeoTIFF)"
            description="Imagem aérea georreferenciada, pronta para medições"
            filename="odm_orthophoto.tif"
            projectId={project.id}
            assetKey="orthophoto"
          />
        )}
        
        {assets.dsm && (
          <DownloadCard
            title="MDS — Modelo Digital de Superfície"
            description="Representação 3D incluindo vegetação e construções"
            filename="dsm.tif"
            projectId={project.id}
            assetKey="dsm"
          />
        )}
        
        {assets.dtm && (
          <DownloadCard
            title="MDT — Modelo Digital de Terreno"
            description="Terreno sem objetos sobre ele, para projetos topográficos"
            filename="dtm.tif"
            projectId={project.id}
            assetKey="dtm"
          />
        )}
        
        {assets.point_cloud && (
          <DownloadCard
            title="Nuvem de Pontos (.LAS)"
            description="Coordenadas 3D para uso em AutoCAD Civil 3D, software BIM"
            filename="odm_pointcloud.las"
            projectId={project.id}
            assetKey="point_cloud"
          />
        )}
        
        {assets.contours && (
          <DownloadCard
            title="Curvas de Nível (.SHP)"
            description="Vetores altimétricos para uso em QGIS, AutoCAD"
            filename="contours.shp"
            projectId={project.id}
            assetKey="contours"
          />
        )}
        
        {assets.report && (
          <DownloadCard
            title="Relatório de Qualidade (.PDF)"
            description="Métricas de processamento, precisão, cobertura"
            filename="report.pdf"
            projectId={project.id}
            assetKey="report"
          />
        )}
      </div>

      {/* Estatísticas do processamento */}
      {stats && (
        <div className="processing-stats">
          <h3>Estatísticas do Processamento</h3>
          <div className="stats-grid">
            <div><label>GSD</label><value>{stats.gsd} cm/px</value></div>
            <div><label>Área coberta</label><value>{stats.area_ha} ha</value></div>
            <div><label>Imagens processadas</label><value>{stats.image_count}</value></div>
            <div><label>Pontos na nuvem</label><value>{stats.point_count?.toLocaleString()}</value></div>
            <div><label>Resolução ortomosaico</label><value>{stats.ortho_resolution} cm/px</value></div>
            <div><label>Tempo de processamento</label><value>{stats.processing_time}</value></div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 10. Módulo 8 — Download de Produtos

```python
# backend/app/routers/projects.py (adição)
from fastapi.responses import FileResponse
import mimetypes

@router.get("/projects/{project_id}/assets/{asset_key}/download")
async def download_asset(project_id: str, asset_key: str, current_user=Depends(get_current_user)):
    project = await db.get_project(project_id)
    
    if project.user_id != current_user.id:
        raise HTTPException(403, "Acesso negado")
    
    if project.status != "completed":
        raise HTTPException(400, "Processamento ainda não concluído")
    
    asset_path = project.assets.get(asset_key)
    if not asset_path or not Path(asset_path).exists():
        raise HTTPException(404, "Asset não encontrado")
    
    filename = Path(asset_path).name
    media_type, _ = mimetypes.guess_type(filename)
    media_type = media_type or "application/octet-stream"
    
    return FileResponse(
        path=asset_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

---

## 11. Estrutura de Pastas

```
drone-mapper/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FlightPlanner/
│   │   │   │   ├── FlightMap.jsx         # Mapa com leaflet-draw
│   │   │   │   ├── FlightParams.jsx      # Painel de parâmetros
│   │   │   │   ├── WaypointPreview.jsx   # Visualização do grid
│   │   │   │   └── TransferGuide.jsx     # Guia de transferência DJI
│   │   │   ├── Upload/
│   │   │   │   ├── ImageUploader.jsx     # Dropzone + chunked upload
│   │   │   │   └── UploadProgress.jsx    # Barra de progresso
│   │   │   ├── Results/
│   │   │   │   ├── ResultsDashboard.jsx  # Dashboard de resultados
│   │   │   │   ├── OrthophotoLayer.jsx   # Layer TiTiler
│   │   │   │   ├── PointCloudViewer.jsx  # Potree iframe
│   │   │   │   └── DownloadCard.jsx      # Cards de download
│   │   │   └── common/
│   │   │       ├── StatusBadge.jsx
│   │   │       └── ProgressBar.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── NewProject.jsx
│   │   │   └── ProjectDetail.jsx
│   │   ├── hooks/
│   │   │   ├── useFlightPlan.js
│   │   │   ├── useProjectStatus.js      # WebSocket hook
│   │   │   └── useUpload.js
│   │   ├── services/
│   │   │   └── api.js                   # Axios client
│   │   └── store/
│   │       └── projectStore.js          # Zustand store
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app
│   │   ├── config.py                    # Settings
│   │   ├── database.py                  # SQLAlchemy
│   │   ├── models/
│   │   │   ├── project.py
│   │   │   ├── user.py
│   │   │   └── task.py
│   │   ├── routers/
│   │   │   ├── flightplan.py            # /flightplan/* endpoints
│   │   │   ├── projects.py              # /projects/* endpoints
│   │   │   ├── auth.py                  # /auth/* endpoints
│   │   │   └── ws.py                    # WebSocket endpoints
│   │   └── services/
│   │       ├── kmz_generator.py         # Gerador de KMZ DJI WPML
│   │       ├── processing.py            # Celery tasks + PyODM
│   │       ├── waypoint_calculator.py   # Cálculo do grid
│   │       └── storage.py               # MinIO/S3 helpers
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## 12. Banco de Dados

```sql
-- PostgreSQL com PostGIS
CREATE EXTENSION postgis;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'created',   -- created, uploading, processing, completed, failed
    progress FLOAT DEFAULT 0,
    
    -- Área de voo (GeoJSON)
    flight_area GEOMETRY(POLYGON, 4326),
    
    -- Parâmetros de voo
    altitude_m FLOAT,
    forward_overlap FLOAT,
    side_overlap FLOAT,
    rotation_angle FLOAT,
    drone_model VARCHAR,
    
    -- Estatísticas calculadas
    stats JSONB,
    
    -- Assets resultantes
    assets JSONB,           -- paths dos arquivos gerados
    
    -- Task ODM
    odm_task_uuid VARCHAR,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size BIGINT,
    has_gps BOOLEAN DEFAULT TRUE,
    lat FLOAT,
    lon FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices geoespaciais
CREATE INDEX idx_projects_flight_area ON projects USING GIST(flight_area);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_images_project ON project_images(project_id);
```

---

## 13. Infraestrutura e Deploy

### docker-compose.yml completo

```yaml
version: '3.8'

services:
  # Frontend React
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000

  # Backend FastAPI
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dronemapper
      - REDIS_URL=redis://redis:6379
      - ODM_NODE_HOST=nodeodm
      - ODM_NODE_PORT=3000
      - STORAGE_PATH=/data
    volumes:
      - ./data:/data
    depends_on:
      - db
      - redis
      - nodeodm

  # Celery Worker
  worker:
    build: ./backend
    command: celery -A app.celery worker --loglevel=info --concurrency=2
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dronemapper
      - REDIS_URL=redis://redis:6379
      - ODM_NODE_HOST=nodeodm
      - ODM_NODE_PORT=3000
    volumes:
      - ./data:/data
    depends_on:
      - redis
      - nodeodm

  # NodeODM — API para controlar ODM
  nodeodm:
    image: opendronemap/nodeodm
    ports:
      - "3001:3000"
    volumes:
      - ./data/odm:/var/www/data

  # TiTiler — Tile server para GeoTIFF (COG raster: ortomosaico, DSM, DTM)
  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "8001:8000"
    environment:
      - GDAL_CACHEMAX=512
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=1000000000
    volumes:
      - ./data:/data

  # Martin — Vector tile server do PostGIS (Rust, alto desempenho)
  # Serve polígonos de AOI, waypoints e anotações como MVT (Mapbox Vector Tiles)
  martin:
    image: ghcr.io/maplibre/martin:latest
    ports:
      - "3002:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/dronemapper
    depends_on:
      - db

  # PostgreSQL + PostGIS
  db:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_DB=dronemapper
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis (Celery broker + cache)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # MinIO (armazenamento de arquivos)
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

---

## 14. Roadmap de Desenvolvimento

### Fase 1 — MVP (4-6 semanas)
- [ ] Mapa interativo com desenho de polígono (Leaflet + leaflet-draw)
- [ ] Cálculo de waypoints e grid de voo
- [ ] Exportação de KMZ (formato DJI WPML)
- [ ] Guia de transferência para DJI Fly
- [ ] Upload de imagens (chunked, com progresso)
- [ ] Integração básica com NodeODM
- [ ] Download do ortomosaico (.tif)

### Fase 2 — Processamento completo (3-4 semanas)
- [ ] Geração de MDT, MDS, nuvem de pontos, curvas de nível
- [ ] Visualização do ortomosaico no mapa via TiTiler
- [ ] Relatório de qualidade do processamento
- [ ] Status em tempo real via SSE (Server-Sent Events)
- [ ] Múltiplos presets de qualidade (rápido / padrão / ultra)

### Fase 3 — Features avançadas (4-6 semanas)
- [ ] Suporte a GCPs (Ground Control Points)
- [ ] Visualização 3D da nuvem de pontos (Potree)
- [ ] Medições no mapa (área, distância, volume)
- [ ] Histórico de projetos com busca geoespacial
- [ ] Export para QGIS, AutoCAD (formatos adicionais)

### Fase 4 — Polimento
- [ ] Autenticação JWT + multi-usuário
- [ ] Armazenamento em S3/MinIO com presigned URLs
- [ ] Notificações por email ao concluir processamento
- [ ] Dashboard de uso e métricas
- [ ] API pública documentada (Swagger)

---

## 15. Funcionalidades Avançadas

Esta seção descreve funcionalidades presentes nas principais plataformas do mercado (DroneDeploy, Pix4Dcloud, Propeller) que diferenciam uma plataforma básica de uma solução profissional. Cada item inclui o que é, para que serve e como implementar.

---

### 15.1 Cálculo de Volume de Stockpile (Pilhas de Material)

**O que é:** Calcula o volume de uma pilha de material (terra, minério, grãos, entulho) a partir do DSM gerado pelo drone, comparando a superfície real com uma superfície de referência (o chão).

**Para que serve:** Essencial para mineração, construção civil, agricultura e logística de pátio. Permite medir quanto material foi movimentado entre dois voos, calcular o volume de corte e aterro em uma obra, ou quantificar estoque sem precisar de pesagem manual.

**Como funciona:**
Três métodos de cálculo, do mais simples ao mais preciso:
- **Plano base**: o usuário define uma altitude de referência; volume = integral de (DSM - plano) sobre a área da pilha
- **Triangulado**: o algoritmo detecta automaticamente a borda da pilha e usa uma superfície triangulada interpolada como base
- **Ponto mais baixo**: usa o ponto mais baixo da pilha como referência de base

**Precisão típica:** ±1–3% para pilhas bem mapeadas com GSD < 5 cm/px.

```python
# backend/app/services/volume.py
import numpy as np
import rasterio
from shapely.geometry import shape

def calculate_stockpile_volume(
    dsm_path: str,
    polygon_geojson: dict,
    method: str = "triangulated",
) -> dict:
    """
    Calcula o volume de uma pilha de material dentro do polígono informado.

    Args:
        dsm_path: caminho para o DSM em formato COG
        polygon_geojson: GeoJSON Feature do polígono da pilha
        method: "base_plane" | "triangulated" | "lowest_point"

    Returns:
        dict com volume_m3, area_m2, avg_height_m, min_elev, max_elev
    """
    with rasterio.open(dsm_path) as src:
        # Recorta o DSM ao polígono da pilha
        from rasterio.mask import mask as rio_mask
        geom = [shape(polygon_geojson["geometry"]).__geo_interface__]
        dsm_clipped, transform = rio_mask(src, geom, crop=True, nodata=np.nan)
        dsm_data = dsm_clipped[0].astype(float)
        pixel_area_m2 = abs(transform.a * transform.e)  # largura × altura do pixel

    valid = dsm_data[~np.isnan(dsm_data)]
    if valid.size == 0:
        return {"volume_m3": 0, "error": "Nenhum dado válido na área"}

    if method == "base_plane":
        # Usuário define a altitude base — aqui usamos a mínima como padrão
        base_elevation = float(np.nanmin(dsm_data))
    elif method == "lowest_point":
        base_elevation = float(np.nanmin(dsm_data))
    else:  # triangulated — interpola a borda como superfície base
        from scipy.interpolate import griddata

        rows, cols = np.where(~np.isnan(dsm_data))
        # Pega os pixels do contorno (primeiros e últimos de cada linha/coluna)
        border_mask = np.zeros_like(dsm_data, dtype=bool)
        border_mask[0, :] = border_mask[-1, :] = True
        border_mask[:, 0] = border_mask[:, -1] = True
        border_rows, border_cols = np.where(border_mask & ~np.isnan(dsm_data))
        border_values = dsm_data[border_rows, border_cols]

        all_rows, all_cols = np.indices(dsm_data.shape)
        base_surface = griddata(
            (border_rows, border_cols), border_values,
            (all_rows, all_cols), method="linear", fill_value=np.nanmin(dsm_data)
        )
        heights = dsm_data - base_surface
        heights[heights < 0] = 0  # ignora valores abaixo da base
        volume_m3 = float(np.nansum(heights) * pixel_area_m2)
        area_m2 = float(np.sum(~np.isnan(dsm_data)) * pixel_area_m2)
        return {
            "volume_m3": round(volume_m3, 2),
            "area_m2": round(area_m2, 2),
            "avg_height_m": round(volume_m3 / area_m2, 3) if area_m2 > 0 else 0,
            "min_elev": round(float(np.nanmin(dsm_data)), 3),
            "max_elev": round(float(np.nanmax(dsm_data)), 3),
        }

    heights = dsm_data - base_elevation
    heights[heights < 0] = 0
    volume_m3 = float(np.nansum(heights) * pixel_area_m2)
    area_m2 = float(np.sum(~np.isnan(dsm_data)) * pixel_area_m2)
    return {
        "volume_m3": round(volume_m3, 2),
        "area_m2": round(area_m2, 2),
        "avg_height_m": round(volume_m3 / area_m2, 3) if area_m2 > 0 else 0,
        "min_elev": round(float(np.nanmin(dsm_data)), 3),
        "max_elev": round(float(np.nanmax(dsm_data)), 3),
    }
```

```python
# backend/app/routers/analysis.py
@router.post("/projects/{project_id}/analysis/volume")
async def compute_volume(project_id: str, body: VolumeRequest):
    project = await db.get_project(project_id)
    result = calculate_stockpile_volume(
        dsm_path=project.assets["dsm"],
        polygon_geojson=body.polygon_geojson,
        method=body.method,
    )
    return result
```

---

### 15.2 Comparação Temporal (Time-Lapse de Voos)

**O que é:** Permite sobrepor ortomosaicos de datas diferentes para visualizar a evolução de uma área ao longo do tempo — um "before/after" georreferenciado com precisão.

**Para que serve:** Acompanhamento de obras (progresso de construção), monitoramento ambiental (desmatamento, erosão), controle de movimentação de terra em mineração, comparação de safras em agricultura de precisão.

**Como funciona:** Os ortomosaicos de datas diferentes são servidos pelo TiTiler como layers sobrepostos. O frontend implementa um "swipe" ou slider de opacidade entre as duas camadas. Como ambas são COGs georreferenciados, o alinhamento é automaticamente preciso.

```jsx
// src/components/Results/TemporalComparison.jsx
import { useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'

export function TemporalComparison({ projectId, flights }) {
  // flights: [{date, orthophoto_path}, ...] ordenados por data
  const [dateA, setDateA] = useState(flights[0])
  const [dateB, setDateB] = useState(flights[flights.length - 1])
  const [splitPosition, setSplitPosition] = useState(50) // % da tela

  const tileUrl = (path) =>
    `http://localhost:8001/cog/tiles/{z}/{x}/{y}.png?url=${path}&rescale=0,255`

  return (
    <div className="temporal-comparison">
      <div className="controls">
        <select value={dateA.date} onChange={e => setDateA(flights.find(f => f.date === e.target.value))}>
          {flights.map(f => <option key={f.date} value={f.date}>{f.date}</option>)}
        </select>
        <span>→</span>
        <select value={dateB.date} onChange={e => setDateB(flights.find(f => f.date === e.target.value))}>
          {flights.map(f => <option key={f.date} value={f.date}>{f.date}</option>)}
        </select>
      </div>

      {/* Mapa A — data anterior, cortado pela posição do slider */}
      <div className="map-a" style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}>
        <MapContainer>
          <TileLayer url={tileUrl(dateA.orthophoto_path)} />
        </MapContainer>
      </div>

      {/* Mapa B — data posterior, sobreposto */}
      <div className="map-b">
        <MapContainer>
          <TileLayer url={tileUrl(dateB.orthophoto_path)} />
        </MapContainer>
      </div>

      {/* Slider divisor */}
      <input type="range" min={0} max={100} value={splitPosition}
        onChange={e => setSplitPosition(+e.target.value)}
        className="split-slider"
      />
    </div>
  )
}
```

**Modelo de dados** — adicionar ao schema:
```sql
-- Cada voo é uma "missão" dentro de um projeto recorrente
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    flight_date DATE NOT NULL,
    orthophoto_path VARCHAR,
    dsm_path VARCHAR,
    stats JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 15.3 NDVI e Suporte Multiespectral

**O que é:** NDVI (Normalized Difference Vegetation Index) é um índice calculado a partir das bandas NIR (infravermelho próximo) e Vermelho de câmeras multiespectrais. Varia de -1 a +1: valores altos (>0.6) indicam vegetação saudável e densa; valores baixos indicam solo exposto, água ou vegetação estressada.

**Para que serve:** Agricultura de precisão — identificar áreas com déficit hídrico, doenças, pragas ou nutrição inadequada antes que sejam visíveis a olho nu. Permite gerar mapas de prescrição para aplicação variável de insumos.

**Como funciona:** Requer câmera multiespectral (Micasense RedEdge, DJI Zenmuse P1 Multispectral, Parrot Sequoia). O ODM processa as bandas separadamente e gera um GeoTIFF multibanda. O backend faz o cálculo de banda math e o TiTiler renderiza com colormap.

```python
# backend/app/services/ndvi.py
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

def generate_ndvi(multispectral_tif: str, output_path: str, 
                  red_band: int = 3, nir_band: int = 5) -> str:
    """
    Gera raster NDVI a partir de imagem multiespectral ODM.

    Args:
        multispectral_tif: GeoTIFF multiespectral gerado pelo ODM
        output_path: caminho do NDVI COG de saída
        red_band: índice da banda vermelha (1-based, padrão Micasense = 3)
        nir_band: índice da banda NIR (1-based, padrão Micasense = 5)

    Returns:
        caminho do arquivo NDVI COG gerado
    """
    with rasterio.open(multispectral_tif) as src:
        red = src.read(red_band).astype(float)
        nir = src.read(nir_band).astype(float)
        profile = src.profile.copy()

    # Fórmula NDVI: (NIR - Red) / (NIR + Red)
    # Evita divisão por zero com np.where
    denominator = nir + red
    ndvi = np.where(denominator == 0, np.nan,
                    (nir - red) / denominator)

    # Escala para Int16 para economizar espaço (-10000 a +10000 = -1 a +1)
    ndvi_scaled = (ndvi * 10000).astype(np.int16)

    tmp_path = output_path.replace(".tif", "_tmp.tif")
    profile.update(count=1, dtype=np.int16, nodata=-32768)
    with rasterio.open(tmp_path, "w", **profile) as dst:
        dst.write(ndvi_scaled, 1)

    # Converte para COG para servir via TiTiler
    cog_translate(tmp_path, output_path, cog_profiles.get("deflate"), quiet=True)
    Path(tmp_path).unlink()
    return output_path
```

```jsx
// Frontend — renderiza NDVI com colormap (vermelho = baixo, verde = alto)
export function NdviLayer({ projectId }) {
  const tileUrl =
    `http://localhost:8001/cog/tiles/{z}/{x}/{y}.png` +
    `?url=/data/results/${projectId}/ndvi.tif` +
    `&rescale=-10000,10000` +       // escala Int16
    `&colormap_name=rdylgn`         // Red-Yellow-Green: colormap padrão NDVI

  return <TileLayer url={tileUrl} opacity={0.85} maxZoom={22} />
}
```

---

### 15.4 Gestão de GCPs (Ground Control Points)

**O que é:** GCPs são pontos de controle terrestre — alvos físicos colocados no campo com coordenadas GPS de alta precisão (medidos com GPS RTK/PPK, precisão < 3 cm). São marcados nas fotos do drone para corrigir o georreferenciamento do modelo fotogramétrico.

**Para que serve:** Sem GCPs, o ortomosaico pode ter erros horizontais de 1–5 metros (depende do GPS do drone). Com GCPs e GPS RTK, o erro cai para 3–5 cm — necessário para levantamentos topográficos, projetos de engenharia, laudos técnicos e processos de regularização.

**Formato ODM:** arquivo texto `gcp_list.txt`:
```
EPSG:4326
ponto_1  -23.5505  -46.6333  760.5  1243  874  foto_001.jpg
ponto_1  -23.5505  -46.6333  760.5  2156  1102 foto_002.jpg
ponto_2  -23.5512  -46.6341  762.1  3421  980  foto_007.jpg
```

```python
# backend/app/routers/gcps.py
import csv, io
from fastapi import UploadFile

@router.post("/projects/{project_id}/gcps/upload")
async def upload_gcps(project_id: str, file: UploadFile):
    """
    Aceita CSV com colunas: nome, lat, lon, altitude_m
    Armazena no banco para marcação manual nas fotos via frontend.
    """
    content = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    gcps = []
    for row in reader:
        gcps.append({
            "name": row["nome"],
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "alt": float(row["altitude_m"]),
            "image_coords": [],  # preenchido pelo usuário no frontend
        })
    await db.save_gcps(project_id, gcps)
    return {"count": len(gcps), "gcps": gcps}


@router.post("/projects/{project_id}/gcps/export-odm")
async def export_gcp_file(project_id: str):
    """Gera o gcp_list.txt no formato ODM para inclusão no processamento."""
    gcps = await db.get_gcps(project_id)
    lines = ["EPSG:4326"]
    for gcp in gcps:
        for img_coord in gcp["image_coords"]:
            lines.append(
                f"{gcp['name']}  {gcp['lat']}  {gcp['lon']}  {gcp['alt']}"
                f"  {img_coord['col']}  {img_coord['row']}  {img_coord['filename']}"
            )
    content = "\n".join(lines)
    output_path = f"/data/uploads/{project_id}/gcp_list.txt"
    Path(output_path).write_text(content)
    return {"path": output_path, "lines": len(lines) - 1}
```

**Tabela no banco:**
```sql
CREATE TABLE gcps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    name VARCHAR NOT NULL,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    alt_m FLOAT NOT NULL,
    -- coordenadas nas fotos (marcadas manualmente pelo usuário no frontend)
    image_coords JSONB DEFAULT '[]',  -- [{filename, col, row}, ...]
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 15.5 Ferramentas de Medição no Mapa

**O que é:** Ferramentas interativas sobrepostas ao ortomosaico para medir distâncias, áreas e diferenças de altura diretamente na plataforma, sem precisar exportar para QGIS ou AutoCAD.

**Para que serve:** Medição rápida in-browser para clientes e técnicos — largura de uma estrada, área de um talhão, distância entre dois pontos de interesse, diferença de cota entre dois locais (usando o DTM).

```jsx
// src/components/Results/MeasurementTools.jsx
import { useMap } from 'react-leaflet'
import * as turf from '@turf/turf'

export function MeasurementTools({ dtmPath }) {
  const map = useMap()
  const [mode, setMode] = useState(null) // 'distance' | 'area' | 'elevation'
  const [points, setPoints] = useState([])
  const [result, setResult] = useState(null)

  const handleMapClick = async (e) => {
    const newPoints = [...points, [e.latlng.lat, e.latlng.lng]]
    setPoints(newPoints)

    if (mode === 'distance' && newPoints.length >= 2) {
      const line = turf.lineString(newPoints.map(([lat, lon]) => [lon, lat]))
      const dist = turf.length(line, { units: 'meters' })
      setResult(`${dist.toFixed(2)} m`)
    }

    if (mode === 'area' && newPoints.length >= 3) {
      const polygon = turf.polygon([[...newPoints.map(([lat, lon]) => [lon, lat]),
                                     [newPoints[0][1], newPoints[0][0]]]])
      const area = turf.area(polygon)
      setResult(`${(area).toFixed(2)} m² (${(area / 10000).toFixed(4)} ha)`)
    }

    if (mode === 'elevation') {
      // Consulta a elevação no ponto clicado via TiTiler
      const res = await fetch(
        `http://localhost:8001/cog/point/${e.latlng.lng},${e.latlng.lat}` +
        `?url=${dtmPath}`
      )
      const data = await res.json()
      const elev = data.values?.[0]?.toFixed(2)
      setResult(elev ? `Cota: ${elev} m` : 'Sem dado de elevação')
    }
  }

  return (
    <div className="measurement-tools">
      <button onClick={() => { setMode('distance'); setPoints([]); setResult(null) }}
              className={mode === 'distance' ? 'active' : ''}>
        Distância
      </button>
      <button onClick={() => { setMode('area'); setPoints([]); setResult(null) }}
              className={mode === 'area' ? 'active' : ''}>
        Área
      </button>
      <button onClick={() => { setMode('elevation'); setPoints([]); setResult(null) }}
              className={mode === 'elevation' ? 'active' : ''}>
        Cota (DTM)
      </button>
      {result && <div className="measurement-result">{result}</div>}
    </div>
  )
}
```

---

### 15.6 Anotações e Inspeção

**O que é:** Camada vetorial de anotações sobrepostas ao ortomosaico — pontos, linhas e polígonos com título, descrição e fotos anexadas. Funcionam como "issues" georreferenciados.

**Para que serve:** Inspeção de infraestrutura (torres, dutos, telhados), marcação de anomalias em lavouras, controle de qualidade em obras, laudos técnicos com evidências geolocalizadas. Permite que equipes colaborem em campo e escritório sobre a mesma base cartográfica.

```sql
-- Tabela de anotações (geometria genérica: ponto, linha ou polígono)
CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    type VARCHAR NOT NULL,          -- 'point' | 'line' | 'polygon'
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    title VARCHAR,
    description TEXT,
    severity VARCHAR DEFAULT 'info', -- 'info' | 'warning' | 'critical'
    photos JSONB DEFAULT '[]',       -- [{url, caption}, ...]
    properties JSONB DEFAULT '{}',   -- campos customizáveis
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice espacial para queries de bounding box
CREATE INDEX idx_annotations_geom ON annotations USING GIST(geometry);
CREATE INDEX idx_annotations_project ON annotations(project_id);
```

```python
# backend/app/routers/annotations.py
from fastapi import APIRouter
from shapely.geometry import shape
from shapely.wkb import dumps as wkb_dumps

@router.post("/projects/{project_id}/annotations")
async def create_annotation(project_id: str, body: AnnotationCreate):
    geom = shape(body.geometry)
    await db.execute("""
        INSERT INTO annotations (project_id, user_id, type, geometry, title, description, severity)
        VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5, $6, $7)
    """, project_id, body.user_id, body.type, geom.wkt,
        body.title, body.description, body.severity)
    return {"status": "created"}

@router.get("/projects/{project_id}/annotations")
async def list_annotations(project_id: str, bbox: str = None):
    """
    Retorna anotações como GeoJSON FeatureCollection.
    bbox opcional: "minLon,minLat,maxLon,maxLat"
    """
    if bbox:
        min_lon, min_lat, max_lon, max_lat = map(float, bbox.split(","))
        rows = await db.fetch("""
            SELECT id, type, ST_AsGeoJSON(geometry) as geom,
                   title, description, severity, photos, created_at
            FROM annotations
            WHERE project_id = $1
              AND ST_Intersects(geometry,
                    ST_MakeEnvelope($2,$3,$4,$5, 4326))
        """, project_id, min_lon, min_lat, max_lon, max_lat)
    else:
        rows = await db.fetch("""
            SELECT id, type, ST_AsGeoJSON(geometry) as geom,
                   title, description, severity, photos, created_at
            FROM annotations WHERE project_id = $1
        """, project_id)

    features = [
        {"type": "Feature", "geometry": json.loads(r["geom"]),
         "properties": {k: v for k, v in r.items() if k != "geom"}}
        for r in rows
    ]
    return {"type": "FeatureCollection", "features": features}
```

---

### 15.7 Resumo — Prioridade de Implementação

| Feature | Impacto comercial | Complexidade | Fase sugerida |
|---|---|---|---|
| **Cálculo de volume** | Muito alto (mineração/construção) | Média | Fase 3 |
| **Comparação temporal** | Alto (obras, monitoramento) | Baixa | Fase 3 |
| **Ferramentas de medição** | Alto (todos os clientes) | Baixa | Fase 2 |
| **Anotações / inspeção** | Alto (inspeção industrial) | Média | Fase 3 |
| **Gestão de GCPs** | Alto (projetos técnicos) | Média | Fase 3 |
| **NDVI / multiespectral** | Médio (agrícola específico) | Alta | Fase 4 |

---

## 16. Aplicativo Android (Capacitor)

### Por que Capacitor (e não WebView puro ou React Native)?

WebView puro exige escrever um projeto Android do zero e gerenciar manualmente a ponte JS↔Android. React Native exige reescrever o frontend existente. **Capacitor** empacota o React existente em um APK e expõe plugins nativos chamáveis diretamente do JavaScript — reaproveitamento de ~100% do código web.

| Abordagem | Reuso do código React | Acesso nativo (arquivos, permissões) | Complexidade |
|-----------|----------------------|--------------------------------------|--------------|
| WebView puro | 100% | Manual (bridge JS↔Java) | Alta |
| Capacitor | 100% | Via plugins oficiais + plugins custom | Baixa |
| React Native | ~30% (reescrita) | Total | Alta |
| App nativo Kotlin | 0% | Total | Muito alta |

### Cenários de uso em campo

O DJI Fly armazena missões em:
```
Android/data/dji.go.v5/files/waypoint/{UUID}/{UUID}.kmz
```

| Cenário | Setup | Acesso ao arquivo |
|---------|-------|-------------------|
| **A** (mais comum) | RC-N1 + celular — DJI Fly roda no **mesmo** celular do app | Mesmo dispositivo, `MANAGE_EXTERNAL_STORAGE` resolve |
| **B** | RC 2 / RC Pro (Android embutido) — APK instalado no próprio controle | Mesmo dispositivo, mesmo caminho |
| **C** (fallback) | Celular separado do RC | Download manual do KMZ (fluxo atual já documentado) |

O cenário C (celular ↔ RC via USB OTG) é complexo demais para v1 — o fallback manual já documentado no Módulo 4 cobre esse caso.

### Fluxo completo no Android

```
Usuário desenha a área no app
        ↓
App gera waypoints + KMZ (via backend)
        ↓
App lista as missões salvas no DJI Fly
        ↓
Usuário seleciona qual missão substituir (ou cria nova)
        ↓
App escreve o KMZ direto no storage do DJI Fly
        ↓
Usuário abre DJI Fly → missão já atualizada
```

### Setup do Capacitor

```bash
# Na pasta frontend/
npm install @capacitor/core @capacitor/cli
npx cap init "DroneMapper" "com.dronemapper.app" --web-dir dist

npm install @capacitor/android
npx cap add android

# Build e sync (repetir após cada alteração no React)
npm run build
npx cap sync android

# Abre Android Studio para gerar APK / depurar
npx cap open android
```

### Plugin nativo Kotlin para operações de arquivo DJI

```kotlin
// android/app/src/main/java/com/dronemapper/app/DjiMissionPlugin.kt
package com.dronemapper.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.util.UUID

@CapacitorPlugin(name = "DjiMission")
class DjiMissionPlugin : Plugin() {

    companion object {
        // DJI Fly (v5 package)
        private const val DJI_FLY_WAYPOINT_PATH =
            "Android/data/dji.go.v5/files/waypoint"
        // DJI Pilot 2 (drones enterprise)
        private const val DJI_PILOT_WAYPOINT_PATH =
            "Android/data/dji.pilot2/files/waypoint"
    }

    /**
     * Lista as missões existentes no DJI Fly.
     * Retorna: [{uuid, filename, modified_at, app, path}]
     */
    @PluginMethod
    fun listMissions(call: PluginCall) {
        if (!hasAllFilesAccess()) {
            call.reject("PERMISSION_DENIED", "MANAGE_EXTERNAL_STORAGE required")
            return
        }

        val results = JSArray()
        val dirs = listOf(DJI_FLY_WAYPOINT_PATH, DJI_PILOT_WAYPOINT_PATH)

        for (dirPath in dirs) {
            val wayDir = File(Environment.getExternalStorageDirectory(), dirPath)
            if (!wayDir.exists()) continue

            wayDir.listFiles()?.forEach { uuidDir ->
                if (!uuidDir.isDirectory) return@forEach
                val kmzFile = uuidDir.listFiles()?.firstOrNull { it.extension == "kmz" }
                val entry = JSObject().apply {
                    put("uuid", uuidDir.name)
                    put("filename", kmzFile?.name ?: "${uuidDir.name}.kmz")
                    put("modified_at", kmzFile?.lastModified() ?: uuidDir.lastModified())
                    put("app", if (dirPath.contains("dji.go.v5")) "DJI Fly" else "DJI Pilot 2")
                    put("path", kmzFile?.absolutePath ?: "")
                }
                results.put(entry)
            }
        }

        call.resolve(JSObject().apply { put("missions", results) })
    }

    /**
     * Substitui (ou cria) uma missão com o KMZ gerado.
     * kmzBase64: conteúdo do KMZ em Base64
     * uuid: UUID da missão existente (null = cria nova com UUID aleatório)
     * app: "DJI Fly" | "DJI Pilot 2"
     */
    @PluginMethod
    fun replaceMission(call: PluginCall) {
        if (!hasAllFilesAccess()) {
            call.reject("PERMISSION_DENIED", "MANAGE_EXTERNAL_STORAGE required")
            return
        }

        val kmzBase64 = call.getString("kmzBase64")
            ?: return call.reject("INVALID_INPUT", "kmzBase64 required")
        val uuid = call.getString("uuid") ?: UUID.randomUUID().toString().uppercase()
        val app = call.getString("app") ?: "DJI Fly"

        val basePath = if (app == "DJI Pilot 2") DJI_PILOT_WAYPOINT_PATH else DJI_FLY_WAYPOINT_PATH
        val wayDir = File(Environment.getExternalStorageDirectory(), basePath)
        val missionDir = File(wayDir, uuid)

        try {
            missionDir.mkdirs()

            val kmzBytes = android.util.Base64.decode(kmzBase64, android.util.Base64.DEFAULT)
            val kmzFile = File(missionDir, "$uuid.kmz")
            kmzFile.writeBytes(kmzBytes)

            call.resolve(JSObject().apply {
                put("success", true)
                put("uuid", uuid)
                put("path", kmzFile.absolutePath)
            })
        } catch (e: Exception) {
            call.reject("WRITE_ERROR", e.message)
        }
    }

    /**
     * Solicita a permissão MANAGE_EXTERNAL_STORAGE (Android 11+).
     * Redireciona para a tela de configurações do sistema se necessário.
     */
    @PluginMethod
    fun requestAllFilesAccess(call: PluginCall) {
        if (hasAllFilesAccess()) {
            call.resolve(JSObject().apply { put("granted", true) })
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        }
        call.resolve(JSObject().apply { put("granted", false); put("redirected", true) })
    }

    private fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            // Android < 11: WRITE_EXTERNAL_STORAGE é suficiente
            true
        }
    }
}
```

### Registrar o plugin no MainActivity

```kotlin
// android/app/src/main/java/com/dronemapper/app/MainActivity.kt
package com.dronemapper.app

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(DjiMissionPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

### Permissões no AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest ...>
    <!-- Android < 11 -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="29" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <!-- Android 11+ — exige justificativa na Play Store -->
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.INTERNET" />
    ...
</manifest>
```

### Hook React para usar o plugin nativo

```typescript
// src/hooks/useDjiMissions.ts
import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

interface DjiMission {
  uuid: string
  filename: string
  modified_at: number
  app: 'DJI Fly' | 'DJI Pilot 2'
  path: string
}

interface DjiMissionPlugin {
  listMissions(): Promise<{ missions: DjiMission[] }>
  replaceMission(opts: {
    kmzBase64: string
    uuid?: string
    app?: string
  }): Promise<{ success: boolean; uuid: string; path: string }>
  requestAllFilesAccess(): Promise<{ granted: boolean; redirected?: boolean }>
}

const DjiMission = registerPlugin<DjiMissionPlugin>('DjiMission')

export function useDjiMissions() {
  const isNative = Capacitor.isNativePlatform()

  const requestPermission = async () => {
    if (!isNative) return true
    const { granted } = await DjiMission.requestAllFilesAccess()
    return granted
  }

  const listMissions = async (): Promise<DjiMission[]> => {
    if (!isNative) return []
    const { missions } = await DjiMission.listMissions()
    // Ordena pelas mais recentemente modificadas
    return missions.sort((a, b) => b.modified_at - a.modified_at)
  }

  const pushKmzToController = async (
    kmzBytes: ArrayBuffer,
    targetUuid?: string,
    app?: string
  ) => {
    if (!isNative) return null
    const uint8 = new Uint8Array(kmzBytes)
    const b64 = btoa(String.fromCharCode(...uint8))
    return DjiMission.replaceMission({ kmzBase64: b64, uuid: targetUuid, app })
  }

  return { isNative, requestPermission, listMissions, pushKmzToController }
}
```

### Componente de transferência automática

```tsx
// src/components/FlightPlanner/KmzTransfer.tsx
import { useState, useEffect } from 'react'
import { useDjiMissions } from '../../hooks/useDjiMissions'

export function KmzTransfer({ kmzBytes }: { kmzBytes: ArrayBuffer | null }) {
  const { isNative, requestPermission, listMissions, pushKmzToController } = useDjiMissions()
  const [missions, setMissions] = useState<any[]>([])
  const [selectedUuid, setSelectedUuid] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'pushing' | 'done' | 'error'>('idle')
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    if (!isNative) return
    requestPermission().then(granted => {
      setHasPermission(granted)
      if (granted) listMissions().then(setMissions)
    })
  }, [isNative])

  const handlePush = async () => {
    if (!kmzBytes) return
    setStatus('pushing')
    try {
      const result = await pushKmzToController(
        kmzBytes,
        selectedUuid || undefined
      )
      setStatus('done')
      listMissions().then(setMissions) // atualiza lista
      alert(`Missão atualizada!\nUUID: ${result?.uuid}\nAbra o DJI Fly para confirmar.`)
    } catch {
      setStatus('error')
    }
  }

  // Fallback web: download manual (fluxo do Módulo 4)
  if (!isNative) {
    return (
      <a
        href={kmzBytes ? URL.createObjectURL(new Blob([kmzBytes])) : '#'}
        download="missao_drone.kmz"
        className="btn-download"
      >
        Baixar KMZ (transferência manual)
      </a>
    )
  }

  if (!hasPermission) {
    return (
      <div className="permission-required">
        <p>Para substituir automaticamente a missão no DJI Fly, permita acesso a todos os arquivos.</p>
        <button onClick={() => requestPermission().then(setHasPermission)}>
          Conceder permissão
        </button>
      </div>
    )
  }

  return (
    <div className="kmz-transfer">
      <h3>Enviar para o DJI Fly</h3>

      {missions.length === 0 ? (
        <div className="no-missions">
          <p>Nenhuma missão encontrada no DJI Fly.</p>
          <p className="hint">
            Crie uma missão dummy no DJI Fly primeiro, depois volte aqui.
          </p>
          <button onClick={() => listMissions().then(setMissions)}>Recarregar</button>
        </div>
      ) : (
        <>
          <p>Selecione a missão que será substituída:</p>
          <select value={selectedUuid} onChange={e => setSelectedUuid(e.target.value)}>
            <option value="">— criar nova missão —</option>
            {missions.map(m => (
              <option key={m.uuid} value={m.uuid}>
                {m.app} · {new Date(m.modified_at).toLocaleString('pt-BR')} · {m.uuid.slice(0, 8)}…
              </option>
            ))}
          </select>
        </>
      )}

      <button onClick={handlePush} disabled={!kmzBytes || status === 'pushing'}>
        {status === 'pushing' ? 'Enviando…' : 'Substituir missão no DJI Fly'}
      </button>

      {status === 'done' && (
        <p className="success">Missão substituída com sucesso. Abra o DJI Fly.</p>
      )}
      {status === 'error' && (
        <p className="error">Erro ao substituir. Verifique a permissão e tente novamente.</p>
      )}
    </div>
  )
}
```

### Considerações de distribuição

| Ponto | Detalhe |
|-------|---------|
| **Android 11+** | `MANAGE_EXTERNAL_STORAGE` exige justificativa especial na Play Store. Para distribuição fora da Play (sideload no RC), sem restrição. |
| **Criar missão sem dummy** | Criar uma pasta com UUID novo e escrever o KMZ funciona na maioria das versões do DJI Fly, mas não é garantido em todas. Testar com o RC alvo antes de lançar. |
| **DJI RC 2 / RC Pro** | Rodam Android 10 — `WRITE_EXTERNAL_STORAGE` normal basta. Distribuir APK via sideload por ADB ou transferência USB. |
| **Modo offline** | O cálculo de waypoints pode rodar inteiramente no device (sem backend) com a lógica portada para TypeScript — útil em campo sem internet. |
| **iOS** | Capacitor também gera app iOS, mas a substituição automática do KMZ não é viável (sandbox do iOS impede acesso ao storage de outros apps). No iOS, o fluxo é sempre download manual. |

---

---

## 17. Integração Meteorológica

### Por que isso importa para fotogrametria

O clima afeta diretamente a **segurança do voo**, a **qualidade das imagens** e a **precisão do processamento**. A maioria das plataformas profissionais (DroneDeploy, Pix4Dcloud) exibe dados meteorológicos, mas nenhuma os usa para ajustar automaticamente o plano de voo.

| Variável | Impacto |
|----------|---------|
| Vento forte (> limite do drone) | Go/No-Go — voo inviável |
| Direção do vento | Ajuste do ângulo das faixas para minimizar deriva lateral |
| Vento em altitude (80–120m) | Mais relevante que o vento em superfície para estimar consumo e drift |
| Temperatura baixa | Redução de até 30% na autonomia das baterias LiPo |
| Cobertura de nuvens > 50% | **Ideal** para fotogrametria — luz difusa, sem sombras duras |
| Sol direto / parcialmente nublado | Sombras variáveis degradam a detecção de pontos de amarração |
| Chuva / névoa | Inviabiliza o voo (drones consumer não são impermeáveis) |

### APIs utilizadas

| API | Dados | Custo | API Key |
|-----|-------|-------|---------|
| **Open-Meteo** | Vento (velocidade + direção) em 10m, 80m, 120m, 180m. Temperatura, umidade, precipitação, cobertura de nuvens. Previsão horária 16 dias. | Gratuito (não-comercial) | Não necessária |
| **OpenWeatherMap** | Tiles de mapa: vento, chuva, nuvens, temperatura | Gratuito (1.000 req/dia) | Sim (gratuita) |
| **RainViewer** | Radar de precipitação em tempo real (tiles animados) | Gratuito | Não necessária |

### Como o vento afeta a geometria do voo

**Alinhamento das faixas com o vento** é a configuração mais eficiente:

```
Vento do Norte (0°) → faixas Norte-Sul (ângulo 0°)

     ↑ vento
  ← faixa 1 →    O drone voa alternando contra/a favor do vento
  ← faixa 2 →    Sem deriva lateral entre faixas
  ← faixa 3 →    Sobreposição frontal consistente
```

Voar **cruzado ao vento** causa deriva lateral: o drone é empurrado para fora da faixa planejada, criando gaps ou sobreposição irregular. O backend pode sugerir automaticamente o `rotation_angle` ideal com base na direção do vento na altitude de voo.

**Ajuste de velocidade por vento:**

```
velocidade_efetiva_contra = velocidade_voo - vento_ms
velocidade_efetiva_favor  = velocidade_voo + vento_ms
```

Se `velocidade_efetiva_contra < 2 m/s`, o drone quase para — a faixa leva o dobro do tempo previsto e o espaçamento entre fotos cai muito. O sistema deve alertar e recalcular o tempo de voo.

### Backend — Serviço meteorológico

```python
# backend/app/services/weather.py
import httpx
import asyncio
from functools import lru_cache
from datetime import datetime, timezone

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Especificações de vento máximo por drone (m/s)
DRONE_MAX_WIND = {
    "dji_mini_4_pro": 10.7,
    "dji_mini_5_pro": 12.0,
    "dji_air_3":      12.0,
    "dji_mavic_3":    12.0,
    "dji_phantom_4":  10.0,
}

async def get_weather_for_location(lat: float, lon: float) -> dict:
    """
    Busca condições meteorológicas atuais e previsão para as próximas 6h.
    Usa Open-Meteo: gratuito, sem API key, dados em altitude até 180m.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "cloud_cover",
            "wind_speed_10m",
            "wind_direction_10m",
        ],
        "hourly": [
            "wind_speed_80m",
            "wind_direction_80m",
            "wind_speed_120m",
            "wind_direction_120m",
            "precipitation_probability",
            "cloud_cover",
        ],
        "wind_speed_unit": "ms",
        "forecast_days": 1,
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Pega a hora atual para extrair o índice horário correto
    now_hour = datetime.now(timezone.utc).hour
    hourly = data["hourly"]

    return {
        "current": data["current"],
        "altitude_wind": {
            "80m":  {
                "speed_ms":    hourly["wind_speed_80m"][now_hour],
                "direction_deg": hourly["wind_direction_80m"][now_hour],
            },
            "120m": {
                "speed_ms":    hourly["wind_speed_120m"][now_hour],
                "direction_deg": hourly["wind_direction_120m"][now_hour],
            },
        },
        "next_6h": {
            "max_wind_80m":           max(hourly["wind_speed_80m"][now_hour:now_hour+6]),
            "precip_probability_max": max(hourly["precipitation_probability"][now_hour:now_hour+6]),
            "avg_cloud_cover":        sum(hourly["cloud_cover"][now_hour:now_hour+6]) / 6,
        },
    }


def assess_flight_conditions(weather: dict, drone_model: str, altitude_m: float) -> dict:
    """
    Analisa as condições e retorna um parecer Go/No-Go com recomendações.
    Usa o vento na altitude mais próxima à altitude de voo planejada.
    """
    max_wind = DRONE_MAX_WIND.get(drone_model, 10.0)

    # Escolhe altitude de referência para o vento
    if altitude_m <= 90:
        wind_key = "80m"
    else:
        wind_key = "120m"

    wind_speed  = weather["altitude_wind"][wind_key]["speed_ms"]
    wind_dir    = weather["altitude_wind"][wind_key]["direction_deg"]
    temperature = weather["current"]["temperature_2m"]
    cloud_cover = weather["current"]["cloud_cover"]
    precip      = weather["current"]["precipitation"]
    precip_prob = weather["next_6h"]["precip_probability_max"]

    issues   = []
    warnings = []
    tips     = []

    # ── Go/No-Go ──────────────────────────────────────────────────────────────
    go = True

    if precip > 0:
        go = False
        issues.append("Precipitação ativa — voo inviável. Drone consumer não é impermeável.")

    if precip_prob > 60:
        go = False
        issues.append(f"Alta probabilidade de chuva nas próximas 6h ({precip_prob:.0f}%). Aguarde janela seca.")

    if wind_speed > max_wind:
        go = False
        issues.append(
            f"Vento em {wind_key}: {wind_speed:.1f} m/s excede o limite do {drone_model} "
            f"({max_wind} m/s). Voo inviável."
        )
    elif wind_speed > max_wind * 0.75:
        warnings.append(
            f"Vento em {wind_key}: {wind_speed:.1f} m/s (75% do limite). "
            "Reduza a altitude e monitore as baterias."
        )

    if temperature < 5:
        warnings.append(
            f"Temperatura baixa ({temperature:.1f}°C) — baterias LiPo perdem ~25-30% de autonomia. "
            "Aqueça as baterias antes do voo e adicione reserva extra."
        )
    elif temperature < 15:
        warnings.append(
            f"Temperatura amena ({temperature:.1f}°C) — baterias LiPo podem perder ~15% de autonomia."
        )

    # ── Dicas de qualidade fotogramétrica ────────────────────────────────────
    if 50 <= cloud_cover <= 100:
        tips.append(
            f"Cobertura de nuvens: {cloud_cover:.0f}% — ótimo para fotogrametria. "
            "Luz difusa elimina sombras duras e melhora a detecção de pontos de amarração."
        )
    elif cloud_cover < 20:
        warnings.append(
            "Céu aberto com sol direto. Sombras duras podem reduzir a qualidade do ortomosaico. "
            "Prefira voar ao amanhecer, entardecer, ou em dias nublados."
        )
    else:
        warnings.append(
            f"Cobertura parcial de nuvens ({cloud_cover:.0f}%) — iluminação variável. "
            "Tente voar quando a cobertura for mais uniforme."
        )

    # ── Ângulo de faixa recomendado ───────────────────────────────────────────
    # Faixas alinhadas COM o vento (drone voa contra/a favor, sem deriva lateral)
    recommended_angle = round(wind_dir % 180, 0)
    tips.append(
        f"Vento vindo de {wind_dir:.0f}°. Ângulo de faixa recomendado: {recommended_angle:.0f}° "
        "(faixas alinhadas com o vento, minimiza deriva lateral)."
    )

    return {
        "go":                go,
        "issues":            issues,
        "warnings":          warnings,
        "tips":              tips,
        "wind_speed_ms":     wind_speed,
        "wind_direction_deg": wind_dir,
        "wind_altitude":     wind_key,
        "temperature_c":     temperature,
        "cloud_cover_pct":   cloud_cover,
        "recommended_rotation_angle": recommended_angle,
    }


def adjust_flight_stats(stats: dict, weather: dict, drone_model: str) -> dict:
    """
    Recalcula estatísticas do plano de voo levando em conta vento e temperatura.
    """
    wind_speed  = weather["altitude_wind"]["80m"]["speed_ms"]
    temperature = weather["current"]["temperature_2m"]

    # Fator de tempo: voo contra o vento é mais lento
    # Assume serpentina: metade do tempo contra (lento), metade a favor (rápido)
    # Velocidade média efetiva ≈ harmônica entre headwind e tailwind
    nominal_speed = stats.get("speed_ms", 8.0)
    speed_against = max(nominal_speed - wind_speed, 1.0)
    speed_with    = nominal_speed + wind_speed
    # Média harmônica (conservadora)
    effective_speed = 2 / (1 / speed_against + 1 / speed_with)

    time_factor = nominal_speed / effective_speed
    adjusted_time = round(stats["estimated_time_min"] * time_factor, 1)

    # Fator de bateria por temperatura (redução LiPo)
    if temperature < 5:
        battery_factor = 1.35   # -30% de autonomia → 35% mais baterias
    elif temperature < 15:
        battery_factor = 1.18   # -15% de autonomia
    else:
        battery_factor = 1.0

    import math
    adjusted_batteries = math.ceil(stats["batteries_needed"] * time_factor * battery_factor)

    return {
        **stats,
        "estimated_time_min":      adjusted_time,
        "batteries_needed":        adjusted_batteries,
        "weather_time_factor":     round(time_factor, 2),
        "weather_battery_factor":  round(battery_factor, 2),
        "effective_speed_ms":      round(effective_speed, 1),
    }
```

### Endpoint — Weather assessment integrado ao plano de voo

```python
# backend/app/routers/flightplan.py (adição)
from app.services.weather import get_weather_for_location, assess_flight_conditions, adjust_flight_stats

@router.post("/calculate-with-weather")
async def calculate_flight_plan_with_weather(req: FlightPlanRequest):
    """
    Calcula o plano de voo e já retorna o parecer meteorológico junto.
    Chama o cálculo de waypoints e a API do Open-Meteo em paralelo.
    """
    polygon = shape(req.polygon_geojson["geometry"])
    centroid = polygon.centroid

    # Executa cálculo de waypoints e busca de clima em paralelo
    plan_task    = asyncio.create_task(calculate_flight_plan(req))
    weather_task = asyncio.create_task(
        get_weather_for_location(centroid.y, centroid.x)
    )
    plan, weather = await asyncio.gather(plan_task, weather_task)

    assessment    = assess_flight_conditions(weather, req.drone_model, req.altitude_m)
    adjusted_stats = adjust_flight_stats(
        {**plan.stats, "speed_ms": req.speed_ms},
        weather,
        req.drone_model,
    )

    return {
        "waypoints":   plan.waypoints,
        "waylines":    plan.waylines,
        "stats":       adjusted_stats,
        "weather":     weather,
        "assessment":  assessment,
    }
```

### Frontend — Camadas meteorológicas no mapa

```tsx
// src/components/FlightPlanner/WeatherLayers.tsx
import { TileLayer } from 'react-leaflet'
import { useState } from 'react'

const OWM_KEY = import.meta.env.VITE_OWM_API_KEY  // OpenWeatherMap API key

// Camadas disponíveis de sobreposição meteorológica
const WEATHER_LAYERS = {
  wind:          { label: 'Vento',         url: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}` },
  clouds:        { label: 'Nuvens',        url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}` },
  precipitation: { label: 'Precipitação',  url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}` },
  temperature:   { label: 'Temperatura',   url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}` },
  // RainViewer: radar de precipitação em tempo real, gratuito e sem API key
  radar:         { label: 'Radar (chuva)', url: null },  // URL dinâmica via RainViewer API
}

export function WeatherLayers() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)

  // Busca a URL mais recente do radar RainViewer
  const loadRadar = async () => {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    const data = await res.json()
    const latest = data.radar.past[data.radar.past.length - 1]
    setRadarUrl(`https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`)
    setActiveLayer('radar')
  }

  const toggleLayer = (key: string) => {
    if (key === 'radar') { loadRadar(); return }
    setActiveLayer(prev => prev === key ? null : key)
  }

  return (
    <>
      {/* Controles flutuantes sobre o mapa */}
      <div className="weather-layer-controls">
        {Object.entries(WEATHER_LAYERS).map(([key, layer]) => (
          <button
            key={key}
            className={activeLayer === key ? 'active' : ''}
            onClick={() => toggleLayer(key)}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Camada ativa no mapa */}
      {activeLayer && activeLayer !== 'radar' && WEATHER_LAYERS[activeLayer].url && (
        <TileLayer
          url={WEATHER_LAYERS[activeLayer].url}
          opacity={0.6}
          attribution="OpenWeatherMap"
          zIndex={400}
        />
      )}
      {activeLayer === 'radar' && radarUrl && (
        <TileLayer
          url={radarUrl}
          opacity={0.7}
          attribution="RainViewer"
          zIndex={400}
        />
      )}
    </>
  )
}
```

### Frontend — Widget de condições e parecer Go/No-Go

```tsx
// src/components/FlightPlanner/WeatherWidget.tsx
export function WeatherWidget({ assessment, weather }: {
  assessment: FlightAssessment | null
  weather: WeatherData | null
}) {
  if (!weather || !assessment) return null

  const wind = weather.altitude_wind['80m']
  const cur  = weather.current

  return (
    <div className={`weather-widget ${assessment.go ? 'go' : 'no-go'}`}>
      {/* Parecer principal */}
      <div className="go-nogo-badge">
        {assessment.go
          ? '✓ Condições adequadas para voo'
          : '✗ Voo não recomendado'}
      </div>

      {/* Dados meteorológicos resumidos */}
      <div className="weather-grid">
        <div>
          <label>Vento ({assessment.wind_altitude})</label>
          <strong>{assessment.wind_speed_ms.toFixed(1)} m/s · {assessment.wind_direction_deg.toFixed(0)}°</strong>
        </div>
        <div>
          <label>Temperatura</label>
          <strong>{cur.temperature_2m.toFixed(1)}°C</strong>
        </div>
        <div>
          <label>Nuvens</label>
          <strong>{cur.cloud_cover}%
            {cur.cloud_cover >= 50 && <span className="tip-icon" title="Ótimo para fotogrametria"> ★</span>}
          </strong>
        </div>
        <div>
          <label>Umidade</label>
          <strong>{cur.relative_humidity_2m}%</strong>
        </div>
      </div>

      {/* Issues (bloqueantes) */}
      {assessment.issues.map((msg, i) => (
        <div key={i} className="alert alert-danger">{msg}</div>
      ))}

      {/* Warnings */}
      {assessment.warnings.map((msg, i) => (
        <div key={i} className="alert alert-warning">{msg}</div>
      ))}

      {/* Dicas */}
      {assessment.tips.map((msg, i) => (
        <div key={i} className="alert alert-info">{msg}</div>
      ))}

      {/* Sugestão de ângulo de faixa */}
      {assessment.go && (
        <div className="rotation-suggestion">
          Ângulo de faixa sugerido pelo vento:&nbsp;
          <strong>{assessment.recommended_rotation_angle}°</strong>
          <button onClick={() => onApplySuggestion?.(assessment.recommended_rotation_angle)}>
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
```

### Ajuste nas estatísticas exibidas ao usuário

Quando o backend retorna `stats` ajustados pelo clima, o painel de parâmetros exibe a diferença:

```tsx
// src/components/FlightPlanner/FlightParams.jsx (trecho adicional)
{flightStats && (
  <div className="flight-stats">
    <div>Tempo estimado:
      <strong>{flightStats.estimated_time_min} min</strong>
      {flightStats.weather_time_factor > 1.05 && (
        <span className="weather-adj" title="Ajustado pelo vento">
          +{Math.round((flightStats.weather_time_factor - 1) * 100)}% (vento)
        </span>
      )}
    </div>
    <div>Baterias:
      <strong>{flightStats.batteries_needed}</strong>
      {flightStats.weather_battery_factor > 1 && (
        <span className="weather-adj" title="Ajustado por temperatura/vento">
          +reserva (frio/vento)
        </span>
      )}
    </div>
    {/* restante das stats */}
  </div>
)}
```

### Resumo de variáveis climáticas e seus impactos

| Variável | Fonte | Altitude | Impacto no plano |
|----------|-------|----------|-----------------|
| Velocidade do vento | Open-Meteo | 10m, 80m, 120m, 180m | Go/No-Go + ajuste de tempo + ajuste de baterias |
| Direção do vento | Open-Meteo | 80m / 120m | Sugestão do ângulo de faixa |
| Temperatura | Open-Meteo | 2m | Fator de correção das baterias LiPo |
| Cobertura de nuvens | Open-Meteo | — | Avaliação de qualidade fotogramétrica |
| Precipitação atual | Open-Meteo | — | No-Go imediato |
| Probabilidade de chuva (6h) | Open-Meteo | — | No-Go preventivo |
| Radar de chuva (tempo real) | RainViewer | — | Tile layer no mapa |
| Vento / nuvens / temperatura | OpenWeatherMap | — | Tile layers visuais no mapa |

### Notas de implementação

- **Cache**: respostas do Open-Meteo devem ser cacheadas por `(lat_round2, lon_round2, hora)` — dados mudam no máximo a cada hora.
- **Precisão do vento em altitude**: Open-Meteo usa modelo GFS/ICON; a precisão a 80–120m é suficiente para planejamento de campo mas não substitui uma estação meteorológica local.
- **iOS / Android (Capacitor)**: o widget e as camadas de mapa funcionam sem alteração no app nativo.
- **Sem API key para Open-Meteo e RainViewer**: dependências zero-custo para funcionalidade core. OpenWeatherMap (tiles visuais) exige chave gratuita — pode ser omitido na v1 sem perda funcional.

---

## Observações Finais

**Por que NÃO usar Node.js no backend?**
A stack geoespacial em Python (GDAL, rasterio, shapely, pyproj, PyODM) não tem equivalente real em JavaScript. Tentar fazer isso com Node seria reinventar a roda com uma linguagem que não é a casa natural desses dados.

**Por que NÃO usar Agisoft Metashape / Pix4D?**
São softwares proprietários caríssimos. ODM é open source, com qualidade comparável para a maioria dos casos, e você pode hospedar seu próprio servidor sem custo de licença.

**Custo de processamento:**
- Instância AWS EC2 `c5.4xlarge` (16 vCPUs, 32GB RAM) ≈ R$2–4 por job de área pequena (50–200 fotos)
- Para uso próprio, um servidor dedicado com GPU NVIDIA acelera 10x a densificação de nuvem de pontos
- NodeODM com GPU usa `opendronemap/nodeodm:gpu` + `--gpus all`

**Limitações do método KMZ DJI Fly:**
- Máximo ~400 waypoints por arquivo
- Para áreas grandes: gere múltiplos KMZs (faixas separadas)
- DJI Pilot 2 (drones enterprise) suporta import direto de KMZ — muito mais simples
- Mini 4 Pro, Mini 5 Pro, Air 3 e Mavic 3 Classic requerem o método de substituição descrito neste documento
