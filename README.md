# BanyanBoard

Self-hosted Kanban tool for 2–15 person teams. Boards, columns, and cards — owned by you, deployed with Docker.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- [Node.js 20 LTS](https://nodejs.org/) — for local development outside containers

## Quickstart

```bash
# 1. Clone the repository
git clone <repo-url> banyanboard
cd banyanboard

# 2. Copy the environment template
cp backend/.env.example backend/.env

# 3. Start all services
docker compose up -d
```

Verify everything is healthy:

```bash
docker compose ps                          # all services should show "healthy"
curl http://localhost:3001/health/live     # → {"status":"ok","uptime":...}
curl http://localhost:3001/health/ready    # → {"status":"ok","dbStatus":"ok"}
```

To stop and wipe data:

```bash
docker compose down      # stop (preserves database volume)
docker compose down -v   # stop and delete the database volume
```

## Architecture

```
┌─────────────────────┐     HTTP/REST      ┌──────────────────────┐
│   React Frontend    │ ─────────────────▶ │  Express Backend     │
│   (TypeScript)      │ ◀───────────────── │  (TypeScript)        │
│   Vite dev server   │     JSON           │  Port 3001           │
└─────────────────────┘                    └──────────┬───────────┘
                                                      │ pg / SQL
                                                      ▼
                                           ┌──────────────────────┐
                                           │   PostgreSQL 15       │
                                           │   Port 5432           │
                                           └──────────────────────┘

All services orchestrated via Docker Compose.
```

### Backend Layering

```
HTTP Request
    │
    ▼
Route Handler (routes/)
    │
    ▼
Controller (controllers/)   ← validates input, delegates, returns response
    │
    ▼
Service (services/)         ← business logic only; no req/res
    │
    ▼
Repository (repositories/)  ← SQL queries only; no business logic
    │
    ▼
PostgreSQL
```

Controllers must not import `pg`, Prisma, or any database driver. Services must not contain raw SQL. This is enforced automatically by ESLint rules and a structural test in `backend/src/__tests__/layering.test.ts`.

## Running Tests

```bash
# All backend tests (unit + integration — requires PostgreSQL running)
npm test --prefix backend

# Type checking
npm run typecheck --prefix backend

# Linting
npm run lint --prefix backend
```

Integration tests (`db.test.ts`) require the `db` service to be running:

```bash
docker compose up -d db
npm test --prefix backend
```

## Development (hot reload)

```bash
# Starts backend with tsx watch + bind-mount (defined in docker-compose.override.yml)
docker compose up

# Or run backend locally against a containerised DB:
npm install --prefix backend
docker compose up -d db
npm run dev --prefix backend
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | set by compose | PostgreSQL connection string |
| `PORT` | `3001` | Backend listen port |
| `LOG_LEVEL` | `info` | `trace`/`debug`/`info`/`warn`/`error`/`fatal` |
| `LOG_FORMAT` | `json` | `json` (production) or `text` (dev with pino-pretty) |
| `NODE_ENV` | `production` | `development`/`test`/`production` |

The backend **fails fast** at startup if `DATABASE_URL` is missing.

## Technology Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5 (strict mode) |
| Backend framework | Express 4 |
| Database | PostgreSQL 15 |
| DB client | node-postgres (`pg` v8) |
| Migrations | node-pg-migrate v7 |
| Test runner | Vitest v2 |
| Logger | pino v9 |
| Linter | ESLint 9 (flat config) |
| Formatter | Prettier 3 |

## Roadmap

See [`memory-bank/roadmap.md`](memory-bank/roadmap.md) for the feature backlog and version plan.
