# Technology Context

This file documents the technology stack, infrastructure, and tooling used in this project.

## Component Structure

### Components/Modules

```
frontend/
- Path: frontend/
- Language: TypeScript (React)
- Test Directory: frontend/src/__tests__
- Test Framework: Vitest (TBD — frontend not yet built)

backend/
- Path: backend/
- Language: TypeScript (Node.js / Express)
- Test Directory: backend/src/__tests__
- Test Framework: Vitest v2

db/
- Path: db/
- Language: SQL (PostgreSQL migrations)
- Test Directory: N/A
```

### Shared/Common Code

- Shared TypeScript types (Card, Board, Column) — location TBD (`shared/` or inlined per layer)

## Development Commands

### Local Development

```bash
# Start all services (frontend, backend, postgres)
docker compose up

# Start in detached mode
docker compose up -d

# Rebuild after dependency changes
docker compose up --build

# Tear down (preserves volumes)
docker compose down

# Tear down and wipe database
docker compose down -v
```

### Backend

```bash
# Install dependencies
npm install --prefix backend

# Run in dev mode (tsx watch with hot reload)
npm run dev --prefix backend

# Build
npm run build --prefix backend

# Run tests
npm test --prefix backend

# Type checking
npm run typecheck --prefix backend

# Linting
npm run lint --prefix backend

# Database migrations
npm run migrate --prefix backend
```

### Frontend

```bash
# Install dependencies
npm install --prefix frontend

# Run dev server (Vite)
npm run dev --prefix frontend

# Build for production
npm run build --prefix frontend

# Run tests
npm test --prefix frontend
```

### Database

```bash
# Run migrations
npm run migrate --prefix backend

# Seed development data
npm run seed --prefix backend
```

### Linting & Type Checking

```bash
# Lint backend
npm run lint --prefix backend

# Lint and fix backend
npm run lint:fix --prefix backend

# Type check backend
npm run typecheck --prefix backend

# Format backend code
npm run format --prefix backend

# Lint frontend (TBD)
npm run lint --prefix frontend

# Type check frontend (TBD)
npm run typecheck --prefix frontend
```

## Technology Stack

### Runtime Environment

- Node.js 20 LTS — backend runtime
- Docker + Docker Compose — local development and deployment

### Languages & Frameworks

- TypeScript 5.x — both frontend and backend
- React 18 — frontend UI framework
- Express 4.x — backend REST API framework
- PostgreSQL 15 — primary database

### Data Layer

- PostgreSQL 15 — relational database for boards, columns, cards, users
- **node-postgres (`pg`) v8** — database client; raw SQL with typed query results
- **node-pg-migrate v7** — schema versioning and migrations (CLI: `npm run migrate --prefix backend`)

### API & Communication

- REST API — TypeScript/Express, JSON payloads
- No WebSockets in MVP — card state refreshed on action or manual reload

### Infrastructure & Deployment

- Docker Compose — orchestrates frontend dev server, backend, and PostgreSQL
- No cloud infrastructure in MVP — fully self-hosted

### Development Tools

- Vite — frontend build tool and dev server
- **tsx** — backend TypeScript execution and hot-reload in development (via `npm run dev`)
- **ESLint 9** — flat config format (`eslint.config.js`), with TypeScript and import plugins
- **Prettier 3** — code formatting (config: `.prettierrc.json`)
- **Vitest v2** — backend unit and integration testing (frontend TBD)
- **TypeScript 5** — strict mode with `noUncheckedIndexedAccess` and `noImplicitOverride`

### External Services

- None in MVP

<!-- AUTO-MANAGED: c4-references-start -->
## C4 References

<!--
  This section is auto-managed by /banyan-c4. Run /banyan-c4 to populate or refresh.
  Until /banyan-c4 has been run for the first time, this section is a placeholder.
  Do not hand-edit between the AUTO-MANAGED markers — edits will be overwritten.
-->

C4 architecture documentation has not been generated for this project yet.

After `/banyan-c4` runs, this section will contain pointers to the Container-level diagram and per-container detail docs.

<!-- AUTO-MANAGED: c4-references-end -->

## Observability

### Logging Configuration

The backend uses **pino v9** for structured JSON logging, fully wired in Phase 5.

**Environment Variables:**
| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `info` | Log verbosity (trace, debug, info, warn, error, fatal) |
| `LOG_FORMAT` | `json` | Output format (json for prod, text for dev via pino-pretty) |
| `LOG_OUTPUT` | `stdout` | Destination (stdout only in MVP) |
| `LOG_REDACT_PATTERNS` | `password,secret,token,apiKey,authorization` | Comma-separated fields to redact with `[Redacted]` |

**Key files:**
- `src/types/logger.ts` — `Logger` interface (OTel-compatible shape)
- `src/config/logger.ts` — `createLogger()` factory + `rootLogger` singleton
- `src/middleware/requestContext.ts` — W3C traceparent parsing + correlation ID generation
- `src/middleware/requestLogger.ts` — per-request access logs
- `src/middleware/errorHandler.ts` — centralized error handler

**Pattern:** Every request gets a `traceId`/`spanId` (from `traceparent` header or generated). All log lines in request context include these fields. Every access is logged with method, path, statusCode, and durationMs.

### Distributed Tracing (Deferred to post-MVP)

Phase 5 ships the Logger interface + W3C Trace Context correlation middleware. Full OpenTelemetry SDK wiring (collector, exporters, distributed spans) is deferred to a dedicated future task — the `Logger` interface is OTel-shaped so the migration will be mechanical.

## Architecture Principles

- **Clean architecture** — controllers → services → repositories; no business logic in route handlers
- **Simplicity over cleverness** — prefer explicit, readable code over clever abstractions
- **No premature abstractions** — don't abstract until there are 3+ concrete cases
- **12-Factor config** — all environment-specific values via environment variables

## Recent Technology Changes

### 2026-05-16 — Phase 1: TypeScript backend scaffolding + ESLint

- **What Changed**: Backend tooling finalized and configured
  - **Test runner**: Vitest v2 (backend; frontend TBD)
  - **Logger**: pino v9 (declared; wired in Phase 5)
  - **DB client**: pg v8 (raw node-postgres; wired in Phase 4)
  - **Migrations**: node-pg-migrate v7 (declared; wired in Phase 4)
  - **ESLint**: v9 flat config format, TypeScript strict mode
  - **Module system**: NodeNext ESM (`"type": "module"`)
  - **Hot reload**: tsx watch (dev mode)
- **Reason**: 12-Factor config with fail-fast validation, strict TypeScript for type safety, ESLint v9 for modern JS tooling
- **Impact**: All backend code follows strict TypeScript, structured logging, and fail-fast configuration validation
- **Enforced**:
  - No `console.log()` in production code (ESLint error)
  - No hardcoded config values (must use `config` object from `src/config/env.ts`)
  - DATABASE_URL required at startup (crash if missing)

### 2026-05-16 — Initial stack defined

- **What Changed**: Technology stack established for BanyanBoard MVP
- **Reason**: React + TypeScript frontend, Express backend, PostgreSQL for a familiar, well-supported stack suited to small team Kanban
- **Impact**: All new components should follow this stack

---

## Notes

- Docker Compose service names: `frontend` (TBD), `backend`, `db`
- Keep Development Commands updated as build scripts are added to package.json files
