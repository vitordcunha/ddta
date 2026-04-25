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

## 5) NodeODM (necessario para processar imagens)

O `docker compose` do backend **nao** inclui o NodeODM. O worker Celery usa PyODM e espera um nó em `ODM_NODE_HOST` / `ODM_NODE_PORT` (padrao em `backend/.env.example`: `localhost` e `3000`). Sem isso, tarefas de processamento falham com *connection refused* na porta do nó.

### Subir o nó (CPU, porta 3000)

```bash
docker run -d --name nodeodm -p 3000:3000 opendronemap/nodeodm
```

Com volume para dados dos jobs:

```bash
docker run -d --name nodeodm -p 3000:3000 -v nodeodm_data:/var/www/data opendronemap/nodeodm
```

### GPU (Linux com NVIDIA + drivers + nvidia-container-toolkit)

```bash
docker run -d --name nodeodm -p 3000:3000 --gpus all opendronemap/nodeodm:gpu
```

### Conferir se o nó responde

```bash
curl -s http://localhost:3000/info | head
```

Se o NodeODM rodar em **outra porta** no host (ex. mapear `3001:3000`), ajuste `ODM_NODE_PORT` no `backend/.env`. Se rodar em **outra maquina**, use o hostname/IP em `ODM_NODE_HOST`.

O processamento ODM exige bastante RAM, disco e tempo. Imagem oficial: [opendronemap/nodeodm](https://hub.docker.com/r/opendronemap/nodeodm).

## Fluxo rapido recomendado (backend local + db/redis no Docker)

1. `cd backend && docker compose up -d db redis`
2. `cd backend && cp .env.local.example .env`
3. `cd backend && pip install -e ".[dev]"`
4. `cd backend && alembic upgrade head`
5. `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
6. (Opcional, para processar fotos) subir NodeODM na porta 3000 — ver secao 5
7. (Opcional, recomendado) iniciar worker Celery local
8. `cd app && npm install && npm run dev`
9. Abrir `http://localhost:5173`

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

