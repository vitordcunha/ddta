# DroneData

Plataforma para planejamento de voo com drone, upload/processamento de imagens e visualizacao de resultados.

Este repositorio possui:
- `backend/`: API em FastAPI + PostgreSQL/PostGIS + Redis + Celery.
- `app/`: frontend em React + Vite.

## Requisitos

- Docker + Docker Compose
- Node.js 20+ e npm

## 1) Backend: dois modos de execucao

### Modo A: backend em Docker

No diretorio `backend/`:

```bash
cd backend
cp .env.example .env
docker compose up -d --build
docker compose exec api alembic upgrade head
```

### Modo B: backend local (Python) + apenas `db` e `redis` no Docker

1. Suba somente banco e redis:

```bash
cd backend
docker compose up -d db redis
```

2. Configure variaveis para rodar local:

```bash
cp .env.local.example .env
```

3. Instale dependencias Python e rode a API local:

```bash
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API disponivel em: `http://localhost:8000`

Health check:

```bash
curl http://localhost:8000/health
```

## 2) Subir o frontend

Em outro terminal, no diretorio `app/`:

```bash
cd app
npm install
npm run dev
```

Frontend disponivel em: `http://localhost:5173`

## 3) Variaveis de ambiente do frontend (opcional)

Por padrao o frontend usa:
- `VITE_API_URL=http://localhost:8000/api/v1`
- `VITE_WORKSPACE_ID=default`

Se quiser sobrescrever, crie `app/.env`:

```bash
VITE_API_URL=http://localhost:8000/api/v1
VITE_WORKSPACE_ID=default
```

## 4) Worker Celery (necessario para processamento em background)

### Se backend estiver em Docker

```bash
cd backend
docker compose exec api celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

### Se backend estiver local

```bash
cd backend
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

## Fluxo rapido recomendado (backend local + db/redis no Docker)

1. `cd backend && docker compose up -d db redis`
2. `cd backend && cp .env.local.example .env`
3. `cd backend && pip install -e ".[dev]"`
4. `cd backend && alembic upgrade head`
5. `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
6. (Opcional, recomendado) iniciar worker Celery local
7. `cd app && npm install && npm run dev`
8. Abrir `http://localhost:5173`

## Comandos uteis

### Backend

```bash
cd backend
docker compose logs -f db
docker compose logs -f redis
docker compose down
```

### Frontend

```bash
cd app
npm run build
npm run preview
npm run lint
```

