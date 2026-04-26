# Plano de Implementação: Preview em Tempo Real durante Processamento

## Visão geral

Combinação de três técnicas para mostrar resultados progressivos ao usuário enquanto o processamento completo ainda está em andamento:

1. **Processamento duplo (Fast Preview + Full Quality)** — lança dois tasks ODM em paralelo; o rápido gera um ortomosaico de baixa resolução em ~15 min que fica disponível como preview enquanto o full (alta qualidade) continua rodando
2. **Nuvem de pontos esparsa (SfM preview)** — ao detectar que o ODM concluiu a fase de reconstrução 3D (SfM), serve a nuvem de pontos esparsa via endpoint e exibe no PointCloudViewer
3. **Tiles COG dinâmicos** — serve qualquer GeoTIFF (preview ou final) como tiles XYZ via `rio_tiler` diretamente no FastAPI; o mapa Leaflet exibe o ortomosaico em tiles progressivos por zoom level sem download completo

### Funcionalidade de ativação/desativação

O preview é **opcional** porque:
- O fast task ocupa recursos ODM em paralelo com o full task (pode haver conflito de recursos)
- Em servidores com ODM single-node, dois tasks simultâneos dobram a memória necessária
- O usuário pode preferir esperar mais e ter o resultado final direto

O toggle de preview fica na tela de seleção de preset antes de iniciar o processamento.

---

## Arquitetura da solução

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                          │
│                                                     │
│  StartProcessingPanel                               │
│  ├─ Preset selector (fast / standard / ultra)       │
│  └─ Toggle: "Ativar preview em tempo real"          │
│      └─ Descrição: "Lança processamento rápido      │
│         em paralelo (~15 min). Requer mais           │
│         recursos do servidor."                       │
│                                                     │
│  ProcessingView (durante processamento)             │
│  ├─ Progress bar full quality (principal)           │
│  ├─ Progress bar preview (se ativado)               │
│  │   └─ Badge "Preview disponível" ao completar     │
│  └─ Log detalhado (já existente)                    │
│                                                     │
│  ResultsMapLayers (mapa Leaflet)                    │
│  ├─ TileLayer → /projects/{id}/tiles/{z}/{x}/{y}    │
│  │   ├─ Usa preview_assets se preview completo       │
│  │   └─ Substitui por assets quando full completa   │
│  └─ Badge "Preview (baixa resolução)" se preview    │
│                                                     │
│  PointCloudViewer                                   │
│  └─ Carrega /projects/{id}/sparse-cloud quando      │
│     disponível (após fase SfM ~15-20%)              │
└─────────────────────────────────────────────────────┘
                         │ SSE: status, progress,
                         │ preview_status, preview_progress,
                         │ sparse_cloud_available
                         ▼
┌─────────────────────────────────────────────────────┐
│                    BACKEND                          │
│                                                     │
│  POST /projects/{id}/process                        │
│  └─ Body: { preset, options, enable_preview: bool } │
│      ├─ Dispatch process_images_task (full)         │
│      └─ Se enable_preview: dispatch                 │
│         process_preview_task (fast)                 │
│                                                     │
│  GET /projects/{id}/tiles/{z}/{x}/{y}.png           │
│  └─ rio_tiler → COG do preview ou full              │
│                                                     │
│  GET /projects/{id}/sparse-cloud                    │
│  └─ Serve GeoJSON/XYZ da nuvem esparsa se existir   │
│                                                     │
│  GET /projects/{id}/status/stream (SSE)             │
│  └─ Agora inclui preview_status, preview_progress,  │
│     sparse_cloud_available                          │
│                                                     │
│  Celery Tasks                                       │
│  ├─ process_images_task (full - já existe)          │
│  │   └─ Modif: salva sparse cloud path ao detectar  │
│  └─ process_preview_task (novo)                     │
│      ├─ ODM com opções fast preview                 │
│      └─ Salva em preview_assets ao concluir         │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                      ODM NODE                       │
│  ├─ Task full quality (processo principal)          │
│  └─ Task fast preview (paralelo, se ativado)        │
└─────────────────────────────────────────────────────┘
```

---

## Fase 1 — Banco de dados

### 1.1 Novos campos no modelo `Project`

**Arquivo:** `backend/app/db/models/project.py`

```python
# Preview task tracking
preview_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
preview_odm_task_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
preview_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
# Valores: None | 'queued' | 'processing' | 'completed' | 'failed'
preview_progress: Mapped[int] = mapped_column(Integer, default=0)
preview_assets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
# Caminho para a nuvem de pontos esparsa gerada pelo ODM (SfM stage)
sparse_cloud_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

### 1.2 Migração Alembic

```
alembic revision --autogenerate -m "add_preview_fields_to_project"
alembic upgrade head
```

### 1.3 Atualizar `ProjectResponse` e `ProjectListItem` (schemas Pydantic)

**Arquivo:** `backend/app/schemas/project.py`

Adicionar campos:
```python
preview_status: str | None
preview_progress: int
preview_assets: dict | None
sparse_cloud_path: str | None  # não expor o path real; apenas bool "available"
```

> **Nota de segurança:** `sparse_cloud_path` nunca deve ser exposto diretamente ao frontend como path absoluto. Expor apenas `sparse_cloud_available: bool`.

---

## Fase 2 — Configurações de preview ODM

### 2.1 Preset "fast_preview" no presets.py

**Arquivo:** `backend/app/core/processing/presets.py`

```python
# Preset interno, não exposto ao usuário
FAST_PREVIEW_OPTIONS: dict = {
    "orthophoto-resolution": 8,     # GSD 8 cm/px (vs 2 cm no standard)
    "pc-quality": "lowest",         # nuvem de pontos mínima
    "feature-quality": "lowest",    # extração de features mínima
    "mesh-octree-depth": 9,         # mesh menos detalhada
    "dtm": False,                   # sem DTM no preview
    "dsm": False,                   # sem DSM no preview
    "fast-orthophoto": True,        # flag ODM para orthophoto rápido
    "skip-report": True,            # sem relatório de qualidade
    "min-num-features": 4000,       # menos features por imagem
}
```

> **Estimativa de tempo**: Com estas opções, o preview completa em ~20-30% do tempo do full task standard. Para 200 imagens: full ~60 min, preview ~12-18 min.

### 2.2 Opções adicionais ODM para detecção da nuvem esparsa

O ODM salva a reconstrução SfM em: `{odm_results_dir}/opensfm/reconstruction.json`

Este arquivo existe após a fase OpenSfM (~15-20% do progresso total). Não requer nenhuma opção extra — é gerado em qualquer preset.

---

## Fase 3 — Backend: novo Celery task de preview

### 3.1 Criar `process_preview_task`

**Arquivo:** `backend/app/tasks/processing_tasks.py`

```python
@shared_task(bind=True, acks_late=True)
def process_preview_task(self, project_id: str, image_paths: list[str], options: dict) -> dict:
    """
    Task Celery para processamento rápido de preview.
    Roda em paralelo com process_images_task.
    Salva resultados em preview_assets ao concluir.
    """
    project_uuid = UUID(project_id)

    with SyncSessionLocal() as db:
        _update_project_preview_status(
            db, project_uuid,
            status="processing",
            progress=0,
            preview_task_uuid=self.request.id,
        )

    client = ODMClient(settings.odm_node_host, settings.odm_node_port)
    
    # Cria task ODM com opções fast_preview
    # Usa project_id com sufixo para diferenciar do task full
    preview_odm_uuid = client.create_task(
        f"{project_id}-preview",
        [Path(p) for p in image_paths],
        options,
    )

    with SyncSessionLocal() as db:
        _update_project_preview_status(
            db, project_uuid,
            status="processing",
            progress=5,
            preview_odm_task_uuid=preview_odm_uuid,
        )

    try:
        def on_preview_progress(info: TaskInfo) -> None:
            progress = max(5, min(95, int(info.progress)))
            with SyncSessionLocal() as db_inner:
                _update_project_preview_status(
                    db_inner, project_uuid,
                    status="processing",
                    progress=progress,
                )

        client.wait_for_completion(
            preview_odm_uuid,
            on_progress=on_preview_progress,
            poll_interval_s=5,
        )

        info = client.get_task_info(preview_odm_uuid)
        if info.status != "completed":
            raise RuntimeError(f"Preview ODM task failed with status '{info.status}'")

        # Download apenas o ortofoto (não todos os assets)
        preview_dir = get_project_dir(project_uuid) / "preview-results"
        client.download_assets(preview_odm_uuid, preview_dir)

        # Converter para COG
        ortho = preview_dir / "odm_orthophoto" / "odm_orthophoto.tif"
        if ortho.exists():
            convert_to_cog(ortho)

        preview_assets = organize_results(project_uuid, preview_dir, subdir="preview-results")

        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db, project_uuid,
                status="completed",
                progress=100,
                preview_assets=preview_assets,
            )

        return {"status": "completed", "type": "preview"}

    except Exception as exc:
        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db, project_uuid,
                status="failed",
                progress=0,
            )
        raise exc
```

### 3.2 Helper `_update_project_preview_status`

```python
def _update_project_preview_status(
    db: Session,
    project_id: UUID,
    status: str,
    progress: int,
    preview_task_uuid: str | None = None,
    preview_odm_task_uuid: str | None = None,
    preview_assets: dict | None = None,
) -> None:
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return
    project.preview_status = status
    project.preview_progress = progress
    if preview_task_uuid is not None:
        project.preview_task_uuid = preview_task_uuid
    if preview_odm_task_uuid is not None:
        project.preview_odm_task_uuid = preview_odm_uuid
    if preview_assets is not None:
        project.preview_assets = preview_assets
    db.commit()
```

### 3.3 Modificar `process_images_task` para detectar nuvem esparsa

No loop de polling do full task, adicionar verificação do arquivo SfM:

```python
def on_progress(info: TaskInfo) -> None:
    progress = max(5, min(95, int(info.progress)))
    with SyncSessionLocal() as db_inner:
        _update_project_status(db_inner, project_uuid, "processing", progress)

    # Detecta nuvem de pontos esparsa após fase SfM (~15-20%)
    if progress >= 15:
        sparse_path = odm_results_dir / "opensfm" / "reconstruction.json"
        if sparse_path.exists():
            _update_sparse_cloud_path(project_uuid, str(sparse_path))
```

---

## Fase 4 — Backend: atualização dos endpoints

### 4.1 `POST /projects/{id}/process` — aceitar `enable_preview`

**Arquivo:** `backend/app/api/v1/processing.py`

**Schema de request atualizado:**
```python
class ProcessRequest(BaseModel):
    preset: str = "standard"
    options: dict = {}
    enable_preview: bool = False  # NOVO
```

**Lógica no endpoint:**
```python
# Task full (já existe)
full_task = process_images_task.delay(str(project_id), image_paths, options)
project.status = "queued"
project.processing_task_uuid = full_task.id

# Task preview (novo, opcional)
if body.enable_preview:
    fast_options = get_odm_options("fast_preview")
    preview_task = process_preview_task.delay(str(project_id), image_paths, fast_options)
    project.preview_status = "queued"
    project.preview_progress = 0
    project.preview_task_uuid = preview_task.id
    project.preview_assets = None

await db.commit()
```

### 4.2 `DELETE /projects/{id}/process` — cancelar ambos os tasks

```python
# Cancela full task (já existe)
if project.processing_task_uuid:
    celery_app.control.revoke(project.processing_task_uuid, terminate=True)
if project.odm_task_uuid:
    ODMClient(...).cancel_task(project.odm_task_uuid)

# Cancela preview task (novo)
if project.preview_task_uuid:
    celery_app.control.revoke(project.preview_task_uuid, terminate=True)
if project.preview_odm_task_uuid:
    try:
        ODMClient(...).cancel_task(project.preview_odm_task_uuid)
    except Exception:
        pass

# Reset campos preview
project.preview_status = None
project.preview_progress = 0
project.preview_task_uuid = None
project.preview_odm_task_uuid = None
```

### 4.3 `GET /projects/{id}/status/stream` (SSE) — incluir dados de preview

**Arquivo:** `backend/app/api/v1/sse.py`

```python
payload = {
    "status": current.status,
    "progress": current.progress,
    "assets": current.assets,
    "task_uuid": current.processing_task_uuid,
    # Novos campos
    "preview_status": current.preview_status,
    "preview_progress": current.preview_progress,
    "preview_assets": current.preview_assets,
    "sparse_cloud_available": current.sparse_cloud_path is not None,
}
```

### 4.4 Novo endpoint: `GET /projects/{id}/tiles/{z}/{x}/{y}.png`

**Arquivo:** `backend/app/api/v1/tiles.py` (novo arquivo)

```python
from rio_tiler.io import COGReader
from rio_tiler.errors import TileOutsideBounds
from fastapi.responses import Response

router = APIRouter(tags=["tiles"])

@router.get("/projects/{project_id}/tiles/{z}/{x}/{y}.png")
async def get_project_tile(
    project_id: UUID,
    z: int,
    x: int,
    y: int,
    source: str = Query("auto", description="'preview' | 'full' | 'auto'"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Serve tiles XYZ do ortomosaico via COG.
    source=auto: usa preview se disponível, full se completo.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Resolve qual ortofoto usar
    ortho_path = _resolve_orthophoto_path(project, source)
    if not ortho_path:
        raise HTTPException(404, "No orthophoto available")

    try:
        with COGReader(ortho_path) as cog:
            img = cog.tile(x, y, z, tilesize=256)
        png_bytes = img.render(img_format="PNG")
        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except TileOutsideBounds:
        # Tile fora dos bounds do ortofoto: retorna tile transparente
        return Response(
            content=_empty_png_tile(),
            media_type="image/png",
        )


def _resolve_orthophoto_path(project: Project, source: str) -> str | None:
    """Retorna path do COG a usar baseado em source e disponibilidade."""
    def find_ortho(assets: dict | None) -> str | None:
        if not assets:
            return None
        for key, path in assets.items():
            if "odm_orthophoto.tif" in key.lower():
                return path
        return None

    if source == "preview":
        return find_ortho(project.preview_assets)
    if source == "full":
        return find_ortho(project.assets)
    # auto: preferência: full > preview
    return find_ortho(project.assets) or find_ortho(project.preview_assets)


def _empty_png_tile() -> bytes:
    """Retorna um PNG 256x256 transparente para tiles fora dos bounds."""
    import io
    from PIL import Image as PILImage
    img = PILImage.new("RGBA", (256, 256), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
```

**Registrar no router:**
```python
# backend/app/api/v1/router.py
from app.api.v1 import tiles
api_router.include_router(tiles.router)
```

**Dependência a adicionar:**
```toml
# backend/pyproject.toml
"rio-tiler>=6.0"   # já tem rasterio e rio-cogeo, rio-tiler é o próximo passo
```

### 4.5 Novo endpoint: `GET /projects/{id}/sparse-cloud`

```python
@router.get("/projects/{project_id}/sparse-cloud")
async def get_sparse_cloud(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Retorna a nuvem de pontos esparsa (GeoJSON) gerada pelo SfM.
    Disponível após ~15-20% do processamento.
    """
    project = await db.get(Project, project_id)
    if not project or not project.sparse_cloud_path:
        raise HTTPException(404, "Sparse cloud not available yet")

    sparse_path = Path(project.sparse_cloud_path)

    # Validar que está dentro do diretório do projeto (path traversal)
    project_dir = get_project_dir(project_id).resolve()
    if not sparse_path.resolve().is_relative_to(project_dir):
        raise HTTPException(400, "Invalid path")

    if not sparse_path.exists():
        raise HTTPException(404, "Sparse cloud file not found")

    return FileResponse(sparse_path, media_type="application/json")
```

> **Nota:** `reconstruction.json` do OpenSfM contém as poses de câmera e pontos 3D mas não é GeoJSON nativo. Precisará de conversão para visualização. Ver Fase 5.3.

---

## Fase 5 — Frontend

### 5.1 Tipos TypeScript

**Arquivo:** `app/src/features/results/types.ts`

Adicionar:
```typescript
export interface PreviewStatus {
  previewStatus: 'queued' | 'processing' | 'completed' | 'failed' | null
  previewProgress: number
  previewAssets: Record<string, string> | null
  sparseCloudAvailable: boolean
}
```

**Arquivo:** `app/src/services/projectsService.ts`

Atualizar `StartProcessingPayload`:
```typescript
type StartProcessingPayload = {
  preset?: 'fast' | 'standard' | 'ultra'
  enable_preview?: boolean
}
```

### 5.2 `StartProcessingPanel` — toggle de preview

**Arquivo:** `app/src/features/results/components/StartProcessingPanel.tsx`

Adicionar prop + UI:
```typescript
interface StartProcessingPanelProps {
  selectedPreset: ProcessingPreset
  onSelectPreset: (preset: ProcessingPreset) => void
  enablePreview: boolean
  onTogglePreview: (enabled: boolean) => void
  isRetry: boolean
  onStart: () => void
}
```

UI do toggle:
```tsx
<div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-medium text-neutral-100">Preview em tempo real</p>
      <p className="text-xs text-neutral-400">
        Gera ortomosaico de baixa resolução (~15 min) em paralelo ao processamento completo.
        Requer mais recursos do servidor.
      </p>
    </div>
    <Toggle
      checked={enablePreview}
      onChange={onTogglePreview}
    />
  </div>
  {enablePreview && (
    <p className="mt-2 text-xs text-amber-400">
      ⚠ O servidor ODM processará dois tasks simultaneamente. Evite em ambientes com pouca RAM.
    </p>
  )}
</div>
```

### 5.3 `useProjectStatus` — campos de preview no SSE

**Arquivo:** `app/src/features/results/hooks/useProjectStatus.ts`

Adicionar estado:
```typescript
const [previewStatus, setPreviewStatus] = useState<string | null>(null)
const [previewProgress, setPreviewProgress] = useState(0)
const [sparseCloudAvailable, setSparseCloudAvailable] = useState(false)
```

No `handleMessage`:
```typescript
setPreviewStatus(payload.preview_status ?? null)
setPreviewProgress(Math.round(payload.preview_progress ?? 0))
setSparseCloudAvailable(payload.sparse_cloud_available ?? false)
```

Expor no return:
```typescript
return {
  status, progress, message, eta, logs,
  previewStatus, previewProgress, sparseCloudAvailable,
  startProcessing, cancelProcessing,
}
```

Atualizar `startProcessing` para aceitar `enablePreview`:
```typescript
const startProcessing = useCallback(async (preset: ProcessingPreset, enablePreview: boolean) => {
  ...
  await projectsService.startProcessing(projectId, { preset, enable_preview: enablePreview })
  ...
}, [...])
```

### 5.4 `ProcessingView` — barra de progresso dupla

Adicionar props opcionais:
```typescript
interface ProcessingViewProps {
  progress: number
  message: string
  eta: string
  logs: ProcessingLogEntry[]
  onCancel: () => void
  // Novos
  previewStatus?: string | null
  previewProgress?: number
}
```

UI adicional (abaixo da barra principal):
```tsx
{previewStatus && previewStatus !== 'completed' && (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs text-neutral-400">
      <span>Preview (baixa resolução)</span>
      <span>{previewProgress}%</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
        style={{ width: `${previewProgress}%` }}
      />
    </div>
  </div>
)}

{previewStatus === 'completed' && (
  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
    <span className="h-2 w-2 rounded-full bg-amber-400" />
    Preview disponível no mapa (baixa resolução)
  </div>
)}
```

### 5.5 `ResultsMapLayers` — tile layer do ortomosaico

**Arquivo:** `app/src/features/results/components/ResultsMapLayers.tsx`

Substituir os tile providers mock por tiles reais do backend:

```tsx
import { TileLayer } from 'react-leaflet'

// No componente, quando há ortomosaico disponível (preview ou full):
const orthophotoTileUrl = useMemo(() => {
  if (!projectId) return null
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
  const source = project?.status === 'completed' ? 'full' : 'preview'
  return `${apiBase}/projects/${projectId}/tiles/{z}/{x}/{y}.png?source=${source}`
}, [projectId, project?.status])

// No render, quando layer ativa é 'orthophoto' e há tiles disponíveis:
{activeLayer === 'orthophoto' && orthophotoTileUrl && (
  <TileLayer
    url={orthophotoTileUrl}
    opacity={opacity}
    maxNativeZoom={22}
    maxZoom={24}
    tileSize={256}
    attribution="DroneData Preview"
  />
)}
```

**Badge de preview no mapa** (quando ainda não é o resultado final):
```tsx
{previewStatus === 'completed' && project?.status !== 'completed' && (
  <div className="absolute bottom-8 left-2 z-[1000] rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-300">
    Preview • baixa resolução
  </div>
)}
```

### 5.6 `PointCloudViewer` — nuvem de pontos esparsa

**Arquivo:** `app/src/features/results/components/PointCloudViewer.tsx`

A nuvem esparsa do OpenSfM (`reconstruction.json`) contém pontos 3D nas coordenadas locais do SfM. Para renderização no browser, precisa de uma etapa de conversão.

**Abordagem simplificada:** converter os pontos para GeoJSON FeatureCollection no backend (durante a detecção do sparse cloud), salvar como `sparse_cloud.geojson` e renderizar como `CircleMarker` no mapa Leaflet.

Mais detalhes na seção de Limitações (5.6.1).

---

## Fase 6 — Conversão da nuvem esparsa para GeoJSON

### 6.1 Utilitário de conversão

**Arquivo:** `backend/app/core/processing/sparse_cloud_converter.py` (novo)

```python
import json
from pathlib import Path

def reconstruction_to_geojson(reconstruction_path: Path, output_path: Path) -> Path:
    """
    Converte reconstruction.json do OpenSfM para GeoJSON de pontos georreferenciados.
    Aplica amostragem para limitar a quantidade de pontos (max 50k para performance web).
    """
    with open(reconstruction_path) as f:
        reconstruction = json.load(f)

    features = []
    MAX_POINTS = 50_000

    for recon in reconstruction:
        points = recon.get("points", {})
        coords = recon.get("reference_lla", {})
        ref_lat = coords.get("latitude", 0)
        ref_lon = coords.get("longitude", 0)
        ref_alt = coords.get("altitude", 0)

        all_points = list(points.values())
        # Amostragem uniforme se exceder o limite
        step = max(1, len(all_points) // MAX_POINTS)
        sampled = all_points[::step]

        for pt in sampled:
            # OpenSfM usa sistema de coordenadas local (metros a partir de referência)
            # Conversão aproximada para lat/lon (suficiente para visualização)
            x, y, z = pt["coordinates"]
            # Conversão local → geográfica (aproximação plana)
            lat = ref_lat + (y / 111_320)
            lon = ref_lon + (x / (111_320 * cos(radians(ref_lat))))
            alt = ref_alt + z

            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat, alt]},
                "properties": {"color": pt.get("color", [128, 128, 128])},
            })

    geojson = {"type": "FeatureCollection", "features": features}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(geojson, f)

    return output_path
```

> **Nota:** A conversão plana lat/lon é uma aproximação aceitável para áreas pequenas (<5 km). Para áreas maiores, usar UTM → WGS84 com pyproj.

### 6.2 Integração na detecção do sparse cloud

No `process_images_task`, quando detectar o `reconstruction.json`:

```python
sparse_recon = odm_results_dir / "opensfm" / "reconstruction.json"
if sparse_recon.exists() and project.sparse_cloud_path is None:
    geojson_output = get_project_dir(project_uuid) / "sparse_cloud.geojson"
    try:
        reconstruction_to_geojson(sparse_recon, geojson_output)
        _update_sparse_cloud_path(project_uuid, str(geojson_output))
    except Exception:
        pass  # Não deve bloquear o processamento principal
```

---

## Fase 7 — `organize_results` atualizado

O `organize_results` atual sempre usa o mesmo diretório `results/`. Para preview, precisa de um subdir separado:

**Arquivo:** `backend/app/core/storage/file_manager.py`

Adicionar parâmetro `subdir`:
```python
def organize_results(
    project_id: UUID,
    odm_results_dir: Path,
    subdir: str = "results",
) -> dict[str, str]:
    destination = get_project_dir(project_id) / subdir
    destination.mkdir(parents=True, exist_ok=True)
    ...
```

O `process_preview_task` chama com `subdir="preview-results"`.

---

## Fase 8 — Limpeza ao resetar

### 8.1 `wipe_project_upload_scratch` e `reset_upload_session`

Ao fazer reset do upload, limpar também assets de preview:

```python
# projects.py - reset_upload_session
project.preview_status = None
project.preview_progress = 0
project.preview_task_uuid = None
project.preview_odm_task_uuid = None
project.preview_assets = None
project.sparse_cloud_path = None
```

```python
# file_manager.py - wipe_project_upload_scratch
preview_dir = project_root / "preview-results"
if preview_dir.is_dir():
    shutil.rmtree(preview_dir, ignore_errors=True)
sparse_cloud = project_root / "sparse_cloud.geojson"
sparse_cloud.unlink(missing_ok=True)
```

---

## Resumo dos arquivos a criar/modificar

### Novos arquivos
| Arquivo | Descrição |
|---------|-----------|
| `backend/app/api/v1/tiles.py` | Endpoint de tiles COG via rio_tiler |
| `backend/app/core/processing/sparse_cloud_converter.py` | Conversão reconstruction.json → GeoJSON |
| `backend/alembic/versions/xxx_add_preview_fields.py` | Migração Alembic |

### Arquivos modificados (backend)
| Arquivo | Mudança |
|---------|---------|
| `backend/app/db/models/project.py` | +6 novos campos |
| `backend/app/schemas/project.py` | +campos de preview no response |
| `backend/app/tasks/processing_tasks.py` | +`process_preview_task`, +detecção sparse cloud |
| `backend/app/api/v1/processing.py` | +`enable_preview` no request, cancelar preview task |
| `backend/app/api/v1/sse.py` | +campos preview no payload SSE |
| `backend/app/api/v1/router.py` | +tiles router |
| `backend/app/api/v1/projects.py` | +endpoint `/sparse-cloud`, limpeza no reset |
| `backend/app/core/storage/file_manager.py` | +parâmetro `subdir` em `organize_results` |
| `backend/pyproject.toml` | +`rio-tiler>=6.0` |

### Arquivos modificados (frontend)
| Arquivo | Mudança |
|---------|---------|
| `app/src/features/results/types.ts` | +`PreviewStatus` interface |
| `app/src/features/results/hooks/useProjectStatus.ts` | +estado de preview no SSE |
| `app/src/features/results/components/StartProcessingPanel.tsx` | +toggle de preview |
| `app/src/features/results/components/ProcessingView.tsx` | +barra de progresso de preview |
| `app/src/features/results/components/ResultsMapLayers.tsx` | +TileLayer do ortomosaico |
| `app/src/features/results/components/PointCloudViewer.tsx` | +nuvem esparsa quando disponível |
| `app/src/features/results/components/ResultsWorkspacePanel.tsx` | +repasse de props preview |
| `app/src/services/projectsService.ts` | +`enable_preview` no startProcessing |
| `app/src/types/project.ts` | +campos de preview no tipo Project |

---

## Dependências a instalar

### Backend
```toml
"rio-tiler>=6.0"
```
> `rasterio` já está instalado (`rasterio>=1.3`), que é a dependência principal do rio-tiler.

### Frontend
Nenhuma dependência nova — `react-leaflet` (já instalado) suporta `TileLayer` nativamente.

---

## Estimativas de esforço

| Fase | Descrição | Complexidade |
|------|-----------|-------------|
| 1 | DB + migração | Baixa |
| 2 | Preset fast_preview | Baixa |
| 3 | process_preview_task | Média |
| 4.1–4.3 | Endpoints process/cancel/SSE | Média |
| 4.4 | Endpoint de tiles (rio_tiler) | Média |
| 4.5 | Endpoint sparse-cloud | Baixa |
| 5.1–5.4 | Frontend status + UI | Média |
| 5.5 | TileLayer no mapa | Baixa |
| 6 | Conversão reconstruction.json | Média |
| 7–8 | Limpeza e organize_results | Baixa |

**Ordem de implementação sugerida** (menor risco primeiro):
1. Fase 4.4 (tiles COG) — valor imediato, sem dependências
2. Fase 1 + 2 (DB + preset) — fundação para o resto
3. Fase 3 + 4.1–4.3 (task preview + endpoints)
4. Fase 5 (frontend completo)
5. Fase 6 (sparse cloud, mais experimental)

---

## Limitações e riscos

### Limitação 1 — ODM single-node com poucos recursos
Dois tasks ODM simultâneos numa máquina com <16 GB de RAM podem causar OOM. O toggle de preview mitiga isso, mas deve-se documentar os requisitos mínimos. Solução ideal de longo prazo: usar um segundo nó ODM dedicado apenas ao preview.

### Limitação 2 — Tiles COG e zoom level
A qualidade dos tiles depende do número de zoom levels no COG. O `convert_to_cog` atual deve garantir que os overviews sejam gerados (opção `--overview-level auto` do rio-cogeo). Sem overviews, tiles em zoom out carregam o GeoTIFF completo em memória.

Verificar que `convert_to_cog` usa:
```python
cog_translate(input, output, profile, overview_level=6, overview_resampling="average")
```

### Limitação 3 — Nuvem de pontos esparsa e precisão geográfica
A conversão `reconstruction.json` → GeoJSON usa uma aproximação plana (lat/lon). Para datasets em alta latitude ou áreas grandes, o erro pode ser visível. A solução correta (pyproj UTM) pode ser adicionada na Fase 6 sem alterar a interface.

### Limitação 4 — Cancelamento de preview task
`celery_app.control.revoke(terminate=True)` envia SIGTERM ao worker, mas o processo pode demorar alguns segundos para parar. O ODM task associado também precisa ser cancelado. O cancelamento não é instantâneo.

### Limitação 5 — CORS para tiles
O endpoint de tiles é chamado pelo Leaflet diretamente do browser. Verificar que o middleware CORS do FastAPI permite requisições do frontend origin para os endpoints de tiles.
