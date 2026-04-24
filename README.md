# DroneData

Plataforma para planejamento de voo com drone, upload/processamento de imagens e visualizacao de resultados.

Este repositorio possui:
- `backend/`: API em FastAPI + PostgreSQL/PostGIS + Redis + Celery.
- `app/`: frontend em React + Vite.

## Requisitos

- Docker + Docker Compose
- Node.js 20+ e npm

## 1) Subir o backend

No diretorio `backend/`:

```bash
cd backend
cp .env.example .env
docker compose up -d --build
```

Depois aplique as migracoes:

```bash
docker compose exec api alembic upgrade head
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

O `docker-compose.yml` atual sobe `api`, `db` e `redis`. Para executar tarefas em background (processamento), rode o worker manualmente:

```bash
cd backend
docker compose exec api celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

## Fluxo rapido para rodar tudo

1. `cd backend && cp .env.example .env`
2. `cd backend && docker compose up -d --build`
3. `cd backend && docker compose exec api alembic upgrade head`
4. (Opcional, recomendado) iniciar worker Celery
5. `cd app && npm install && npm run dev`
6. Abrir `http://localhost:5173`

## Comandos uteis

### Backend

```bash
cd backend
docker compose logs -f api
docker compose down
```

### Frontend

```bash
cd app
npm run build
npm run preview
npm run lint
```

