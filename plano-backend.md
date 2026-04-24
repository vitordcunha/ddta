# Plano de Implementação — Backend (`backend/`)

> Stack: **FastAPI + SQLAlchemy + PostgreSQL/PostGIS + Celery + Redis + NodeODM**
> Estrutura modular, sem lógica de negócio nos routers.

---

## Princípios e Pilares

### SOLID aplicado ao FastAPI/Python

| Princípio | Aplicação prática |
|-----------|-------------------|
| **S** — Single Responsibility | Routers só fazem HTTP (validam input, delegam ao service, formatam response). Services só orquestram regra de negócio. Repositories só acessam banco. |
| **O** — Open/Closed | Novos tipos de drone/preset adicionados em `drone_specs.py` sem tocar no calculator. Novos presets ODM em `processing_presets.py` sem tocar na task. |
| **L** — Liskov | Repositories implementam interface base — `ProjectRepository` pode ser trocado por versão mock em testes sem quebrar services. |
| **I** — Interface Segregation | Schemas Pydantic separados por caso de uso: `ProjectCreate`, `ProjectUpdate`, `ProjectResponse` — nunca um schema Deus para tudo. |
| **D** — Dependency Inversion | Services recebem repositories via injeção de dependência (FastAPI `Depends`). Nunca instanciam dependências diretamente. |

### Boas Práticas Estruturais

- **Camadas com fronteiras claras**: `api/` → `services/` → `repositories/` → `db/`. Nenhuma camada pula outra.
- **Lógica pura em `core/`**: funções sem dependências de framework — testáveis com `pytest` puro
- **Schemas ≠ Models**: Pydantic schemas para validação HTTP. SQLAlchemy models para banco. Nunca misturar.
- **Settings centralizadas**: todas as configs via `pydantic-settings` com `.env` — zero hardcode
- **Async consistente**: todo endpoint é `async`. I/O bloqueante vai para Celery worker.
- **Migrations via Alembic**: nenhuma tabela criada em `create_all()` em produção

---

## Estrutura de Pastas

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                         # FastAPI app, middleware, registro de routers
│   ├── config.py                       # Settings via pydantic-settings
│   ├── dependencies.py                 # DI compartilhada: get_db
│   │
│   ├── api/                            # Camada HTTP — só roteamento e serialização
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py               # Agrega todos os routers v1
│   │       ├── projects.py             # CRUD /projects + /projects/:id/images
│   │       ├── flightplan.py           # POST /flightplan/calculate, /flightplan/export-kmz
│   │       ├── processing.py           # POST /projects/:id/process
│   │       └── sse.py                  # GET /projects/:id/status/stream (SSE)
│   │
│   ├── core/                           # Lógica de negócio pura (sem FastAPI)
│   │   ├── __init__.py
│   │   │
│   │   ├── flight/
│   │   │   ├── __init__.py
│   │   │   ├── calculator.py           # Funções puras: GSD, grid, serpentina
│   │   │   ├── kmz_generator.py        # Geração do KMZ DJI WPML
│   │   │   └── drone_specs.py          # DRONE_SPECS constante + helpers
│   │   │
│   │   ├── processing/
│   │   │   ├── __init__.py
│   │   │   ├── odm_client.py           # Wrapper PyODM (baixo acoplamento)
│   │   │   ├── cog_converter.py        # GeoTIFF → COG com rio-cogeo
│   │   │   ├── contour_generator.py    # DTM → curvas de nível com GDAL
│   │   │   └── presets.py              # PROCESSING_PRESETS (fast/standard/ultra)
│   │   │
│   │   └── storage/
│   │       ├── __init__.py
│   │       └── file_manager.py         # Paths, chunks, organização de resultados
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py                  # SQLAlchemy async session + engine
│   │   │
│   │   ├── models/                     # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── base.py                 # DeclarativeBase + timestamps mixin
│   │   │   ├── project.py
│   │   │   └── project_image.py
│   │   │
│   │   └── repositories/               # Data access layer (DAL)
│   │       ├── __init__.py
│   │       ├── base.py                 # Repository base com get/list/create/update/delete
│   │       └── project_repository.py
│   │
│   ├── schemas/                        # Pydantic schemas por domínio
│   │   ├── __init__.py
│   │   ├── project.py                  # ProjectCreate, ProjectUpdate, ProjectResponse
│   │   ├── flightplan.py               # FlightPlanRequest, WaypointResponse
│   │   └── processing.py               # ProcessRequest, ProcessingStatus
│   │
│   ├── tasks/                          # Celery workers
│   │   ├── __init__.py
│   │   ├── celery_app.py               # Celery instance + config
│   │   └── processing_tasks.py         # process_images_task (shared_task)
│   │
│   └── utils/
│       ├── __init__.py
│       └── errors.py                   # Custom exception handlers registrados no main.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                     # Fixtures: db, client
│   ├── unit/
│   │   ├── test_flight_calculator.py   # Testa funções puras de core/flight/
│   │   ├── test_kmz_generator.py
│   │   └── test_cog_converter.py
│   └── integration/
│       ├── test_projects_api.py
│       └── test_flightplan_api.py
│
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 001_initial_schema.py
│
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── .env.example
└── pyproject.toml
```

---

## Fases de Implementação

---

### Fase 1 — Fundação e Infraestrutura
> **Duração estimada: 2–3 dias.**

**Objetivo:** Projeto rodando, banco conectado, estrutura de routers e DI funcionando.

#### 1.1 Setup
```
- pyproject.toml com dependências base
- pydantic-settings para config
- FastAPI app com CORS configurado
- Dockerfile + docker-compose.yml com PostgreSQL/PostGIS + Redis
- Alembic inicializado
```

#### 1.2 config.py
```python
# Settings com pydantic-settings
class Settings(BaseSettings):
    app_name: str = "DroneMapper API"
    database_url: str
    redis_url: str
    odm_node_host: str = "localhost"
    odm_node_port: int = 3000
    storage_path: Path = Path("/data")
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

#### 1.3 db/session.py
```python
# SQLAlchemy async engine
# AsyncSession factory
# get_db() como dependency injector
```

#### 1.4 db/models/ — Schema inicial
```python
# base.py — TimestampMixin com created_at/updated_at automáticos
# project.py — todos os campos do spec (flight_area como Geometry)
# project_image.py — id, project_id, filename, has_gps, lat, lon
```

#### 1.5 Alembic migration 001
```
- CREATE EXTENSION postgis
- Tabelas: projects, project_images
- Índices geoespaciais: GIST em flight_area
```

#### 1.6 main.py
```python
# Registro de exception handlers (errors.py)
# Middleware: CORS, logging de requests
# Router v1 incluído em /api/v1
# Health check: GET /health
```

**Entregável:** `uvicorn app.main:app` roda, `/health` responde, banco conectado com schema criado.

---

### Fase 2 — Base de Contexto (sem autenticação)
> **Duração estimada: 1–2 dias.**

#### 2.1 dependencies.py
```python
# get_request_context() → dict
# Contexto temporário single-tenant (ex.: {"workspace_id": "default"})
# Mantém ponto único para evoluir para auth no futuro sem reescrever endpoints
```

#### 2.2 schemas/common.py (opcional)
```python
# RequestContext schema para tipar dependências compartilhadas
```

#### 2.3 Ajuste de ownership no domínio
```python
# Trocar owner_id/user_id por tenant_id fixo (ou remover ownership por enquanto)
# Em modo single-tenant, queries listam por projeto sem filtro de usuário
```

**Entregável:** Backend sem login, com ponto de extensão pronto para autenticação futura.

---

### Fase 3 — Planejador de Voo (endpoint puro)
> **Duração estimada: 2–3 dias.**

**Objetivo:** Endpoint de cálculo de waypoints e exportação de KMZ. Toda a lógica em `core/flight/`.

#### 3.1 core/flight/drone_specs.py
```python
# DRONE_SPECS dict completo (Mini 4 Pro, Mini 5 Pro, Air 3, Mavic 3, Phantom 4)
# get_specs(model) → DroneSpec | raise ValueError
```

#### 3.2 core/flight/calculator.py
```python
# Funções puras, sem FastAPI, testáveis isoladamente:
#
# calculate_gsd(altitude_m, specs) → float
# calculate_footprint(gsd_m, specs) → FootprintResult
# calculate_spacings(footprint, forward_overlap, side_overlap) → SpacingResult
# generate_flight_grid(polygon_geojson, spacings, rotation_angle) → list[Strip]
# generate_waypoints(strips, altitude_m) → list[Waypoint]
# calculate_stats(waypoints, polygon, specs, speed_ms) → FlightStats
#   → área via pyproj.Geod (geodésica real)
#   → distância via pyproj.Geod.inv() (sem aproximação de graus)
```

#### 3.3 core/flight/kmz_generator.py
```python
# generate_dji_kmz(waypoints, altitude, speed, drone_model) → bytes
# _build_template_kml(waypoints, params) → str
# _build_waylines_wpml(waypoints, params) → str
# _total_distance_geodesic(waypoints) → float  (usa pyproj.Geod, não math approx)
```

#### 3.4 schemas/flightplan.py
```python
# FlightPlanRequest — polygon_geojson, altitude, overlaps, rotation, drone_model
# WaypointResponse — waypoints, waylines, stats
```

#### 3.5 api/v1/flightplan.py
```python
# POST /flightplan/calculate
#   → valida com FlightPlanRequest
#   → chama core/flight/calculator.py
#   → retorna WaypointResponse

# POST /flightplan/export-kmz
#   → calcula waypoints
#   → chama kmz_generator
#   → retorna StreamingResponse (application/zip)
```

**Entregável:** Frontend pode chamar `/flightplan/calculate` — substituição do cálculo client-side. KMZ pode ser gerado server-side se necessário.

---

### Fase 4 — Projetos e Upload
> **Duração estimada: 3–4 dias.**

#### 4.1 db/repositories/project_repository.py
```python
# Herda BaseRepository
# list_all() → list[Project]
# get_with_images(project_id) → Project
# update_status(project_id, status, progress) → Project
# update_assets(project_id, assets) → Project
```

#### 4.2 schemas/project.py
```python
# ProjectCreate — name, description
# ProjectUpdate — name?, description?, flight_area?, altitude?, overlaps?
# ProjectResponse — todos os campos + status + assets
# ProjectListItem — campos para card (sem assets completos)
```

#### 4.3 api/v1/projects.py
```python
# GET    /projects                       → lista projetos
# POST   /projects                       → cria projeto
# GET    /projects/{id}                  → detalhe
# PATCH  /projects/{id}                  → atualiza nome/parâmetros
# DELETE /projects/{id}                  → remove
# POST   /projects/{id}/flightplan       → salva plano de voo calculado
```

#### 4.4 Upload chunked

```python
# api/v1/projects.py (continuação)
# POST /projects/{id}/images/upload-chunk
#   → salva chunk em temp/
#   → se último chunk: remonta arquivo, valida EXIF GPS
#   → registra ProjectImage no banco
#
# GET  /projects/{id}/images
#   → lista imagens com has_gps, lat, lon
#
# DELETE /projects/{id}/images/{image_id}
```

#### 4.5 core/storage/file_manager.py
```python
# get_project_dir(project_id) → Path
# get_chunk_path(project_id, file_id, chunk_index) → Path
# assemble_chunks(temp_dir, output_path, total_chunks) → Path
# cleanup_temp(file_id) → None
# organize_results(project_id, odm_results_dir) → dict  (assets)
```

**Entregável:** Frontend conectado para CRUD real de projetos e upload de imagens com progresso real.

---

### Fase 5 — Processamento ODM
> **Duração estimada: 3–4 dias.**

#### 5.1 core/processing/odm_client.py
```python
# Wrapper sobre PyODM — isola o SDK externo (DIP)
# class ODMClient:
#   def __init__(self, host, port)
#   def create_task(project_id, image_paths, options) → str (task_uuid)
#   def get_task_info(task_uuid) → TaskInfo
#   def wait_for_completion(task_uuid, on_progress) → None
#   def download_assets(task_uuid, output_dir) → None
#   def cancel_task(task_uuid) → None
```

#### 5.2 core/processing/presets.py
```python
# PROCESSING_PRESETS: fast | standard | ultra
# get_odm_options(preset, extra_options) → dict
```

#### 5.3 tasks/celery_app.py
```python
# Celery instance com Redis broker
# Configurações críticas:
#   task_acks_late = True
#   broker_transport_options = {"visibility_timeout": 43200}  # 12h
#   task_serializer = "json"
```

#### 5.4 tasks/processing_tasks.py
```python
# @shared_task(bind=True, acks_late=True)
# def process_images_task(self, project_id, image_paths, options):
#   1. Chama ODMClient.create_task()
#   2. Salva task_uuid no projeto (update_status)
#   3. Aguarda com callback → atualiza progress no banco a cada 5s
#   4. Se completo: download_assets, cog_converter, contour_generator
#   5. organize_results → salva assets no projeto
#   6. update_status → "completed"
#   Em caso de erro: update_status → "failed"
```

#### 5.5 core/processing/cog_converter.py
```python
# convert_to_cog(tif_path) → None
# Usa rio-cogeo internamente
# Converte in-place com arquivo temp
```

#### 5.6 core/processing/contour_generator.py
```python
# generate_contours(dtm_path, output_path, interval_m) → str | None
# Usa GDAL Python bindings (não subprocess)
# Output em GeoJSON para leitura direta no frontend
```

#### 5.7 api/v1/processing.py
```python
# POST /projects/{id}/process
#   → valida que projeto está em estado correto
#   → enfileira process_images_task.delay()
#   → retorna 202 Accepted com task info

# DELETE /projects/{id}/process
#   → cancela task Celery + task ODM
```

#### 5.8 api/v1/sse.py
```python
# GET /projects/{id}/status/stream
#   → EventSourceResponse
#   → polling no banco a cada 3s
#   → emite { status, progress, assets }
#   → fecha stream ao chegar em completed/failed
```

**Entregável:** Pipeline completo: upload → processamento ODM → COG → resultados disponíveis.

---

### Fase 6 — Download de Resultados e Polimento
> **Duração estimada: 1–2 dias.**

#### 6.1 Download de assets
```python
# GET /projects/{id}/assets/{asset_key}/download
#   → valida existência do projeto
#   → verifica que projeto está completed
#   → FileResponse com content-disposition
#   → Futura opção: presigned URL do MinIO
```

#### 6.2 Integração MinIO/S3 (opcional nesta fase)
```python
# core/storage/file_manager.py — adicionar:
# upload_to_storage(local_path, bucket, key) → str (URL)
# get_presigned_url(bucket, key, expires_in) → str
# Configurável via settings: USE_S3=true/false
```

#### 6.3 Rate limiting e validações extras
```python
# slowapi para rate limiting nos endpoints de upload e processamento
# Validação de tamanho máximo de arquivo
# Validação de consistência de estado (status/progress/assets) em todos os endpoints
```

**Entregável:** Backend production-ready.

---

## Separação de Responsabilidades — Diagrama de Camadas

```
Request HTTP
    ↓
api/v1/projects.py         ← valida schema, chama service/repository
    ↓
db/repositories/           ← somente SQL, sem lógica de negócio
    ↓
db/models/                 ← mapeamento ORM puro
    ↓
PostgreSQL

        ↕ (separado)

api/v1/flightplan.py       ← valida, chama core
    ↓
core/flight/calculator.py  ← lógica pura (testável sem banco, sem HTTP)

        ↕ (separado)

api/v1/processing.py       ← valida, enfileira task
    ↓
tasks/processing_tasks.py  ← Celery worker
    ↓
core/processing/odm_client.py  ← wrapper PyODM isolado
```

---

## Dependências (requirements.txt)

```
fastapi>=0.111
uvicorn[standard]>=0.29
pydantic>=2
pydantic-settings>=2
sqlalchemy[asyncio]>=2
asyncpg>=0.29
alembic>=1.13

# Geoespacial
shapely>=2
pyproj>=3.6
turf  # se necessário, senão usar shapely direto

# Processamento
pyodm>=1.5
rio-cogeo>=5
rasterio>=1.3
gdal>=3.8  # via system package

# Workers
celery[redis]>=5.3
redis>=5

# Util
aiofiles>=23
sse-starlette>=2
python-multipart>=0.0.9
```

```
# requirements-dev.txt
pytest>=8
pytest-asyncio>=0.23
httpx>=0.27   # test client async
pytest-cov>=5
ruff>=0.4     # linter + formatter
mypy>=1.9
```

---

## Convenções de Código

```python
# ✅ Router correto — zero lógica de negócio
# api/v1/projects.py

@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    project = await project_repo.create(db, data=body)
    return project


# ✅ Repository correto — só banco, sem regra de negócio
# db/repositories/project_repository.py

class ProjectRepository(BaseRepository[Project]):
    async def list_all(self, db: AsyncSession) -> list[Project]:
        result = await db.execute(
            select(Project).order_by(Project.created_at.desc())
        )
        return result.scalars().all()


# ✅ Core correto — função pura, sem imports de FastAPI ou SQLAlchemy
# core/flight/calculator.py

def calculate_gsd(altitude_m: float, specs: DroneSpec) -> float:
    """GSD em metros por pixel."""
    return (altitude_m * specs.sensor_width_mm) / (specs.focal_length_mm * specs.image_width_px) / 1000


# ✅ Schema correto — separado por operação, não um schema Deus
# schemas/project.py

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)

class ProjectResponse(BaseModel):
    id: UUID
    name: str
    status: ProjectStatus
    created_at: datetime
    stats: dict | None = None
    assets: dict | None = None

    model_config = ConfigDict(from_attributes=True)
```
