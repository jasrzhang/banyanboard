# Archive: BanyanBoard Project Foundation

## Metadata
- **Task ID**: TASK-001
- **Complexity**: Level 4
- **Started**: 2026-05-16
- **Completed**: 2026-05-16
- **Duration**: 1 day (single build session)
- **Roadmap Link**: FEAT-001
- **Feature Branch**: feature/FEAT-001-project-foundation
- **Reflection**: `memory-bank/reflection/reflection-TASK-001.md`

---

## Executive Summary

TASK-001 established the complete project skeleton for BanyanBoard — a self-hosted Kanban backend built on Express 4.x, TypeScript 5.x (strict mode), PostgreSQL 15, and Docker Compose. All 7 planned phases were completed in a single day. The implementation delivered 15 passing non-DB unit/integration tests (plus 3 Docker-dependent DB tests), a 628ms test suite, verified tsc and lint passes, a working Docker Compose stack, and a full observability infrastructure.

All 8 acceptance criteria were met. The foundation is ready for the next feature task (boards, columns, cards, auth).

---

## System Overview

### Purpose
BanyanBoard backend foundation: the runnable Express server, database connectivity, layered architecture pattern, and observability infrastructure that every future feature depends on.

### Scope
**In Scope:**
- TypeScript 5.x backend with Express 4.x (strict mode)
- PostgreSQL 15 client (`pg` v8) + connectivity integration test
- `GET /health/live` and `GET /health/ready` endpoints (HealthController → HealthService → HealthRepository)
- Docker Compose stack (db + backend services, healthchecks, named volume, dev override)
- Structured logger abstraction (pino v9 behind Logger interface, W3C Trace Context correlation)
- ESLint layering enforcement + structural test safety net
- Root `README.md` quickstart

**Out of Scope (deferred):**
- Frontend React app
- Domain entities (boards, columns, cards, users)
- Authentication / authorization
- Full OpenTelemetry SDK wiring (abstraction exists; exporter deferred)
- CI/CD pipeline
- Production deployment artifacts

### Key Capabilities
- `docker compose up -d` brings up db + backend, both healthy within 30s
- `GET /health/live` → `{ status: 'ok', uptime, version }` (process health, no DB dependency)
- `GET /health/ready` → `{ status: 'ok', dbStatus: 'ok' }` (includes DB connectivity)
- Layered architecture enforced by ESLint + structural test
- 12-Factor config: all values from env vars, fail-fast on missing `DATABASE_URL`
- W3C Trace Context correlation: every request gets a `traceId`/`spanId`, propagated through all log lines

---

## Architecture

### High-Level Architecture

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
routes/         ← Express Router; no logic
    │
    ▼
controllers/    ← validates input; delegates to service; returns response
    │
    ▼
services/       ← business logic; no req/res; no SQL
    │
    ▼
repositories/   ← SQL queries only; one class per entity
    │
    ▼
PostgreSQL
```

### Key Source Files

```
backend/
├── src/
│   ├── app.ts                    # createApp() factory (App Factory Pattern)
│   ├── index.ts                  # server entry point, startup checks, graceful shutdown
│   ├── controllers/
│   │   └── HealthController.ts
│   ├── services/
│   │   └── HealthService.ts
│   ├── repositories/
│   │   └── HealthRepository.ts   # Phase 2 stub: returns true
│   ├── routes/
│   │   └── health.ts             # wires object graph; mounts to Router
│   ├── middleware/
│   │   ├── requestContext.ts     # W3C traceparent → req.traceContext + req.logger
│   │   ├── requestLogger.ts      # access log per response
│   │   └── errorHandler.ts       # 4-arg Express error handler
│   ├── config/
│   │   ├── env.ts                # 12-Factor config; requireEnv() fail-fast
│   │   ├── db.ts                 # pg Pool singleton + checkDatabaseConnection()
│   │   └── logger.ts             # pino v9 factory + rootLogger singleton
│   ├── types/
│   │   ├── logger.ts             # Logger interface (OTel-compatible shape)
│   │   └── express.d.ts          # Express Request augmented with logger + traceContext
│   └── __tests__/
│       ├── health.test.ts        # 5 tests — live endpoint + latency + ready
│       ├── db.test.ts            # 4 tests — real Postgres (requires Docker)
│       ├── logger.test.ts        # 4 tests — JSON fields, level, traceContext, redaction
│       └── layering.test.ts      # 2 tests — structural safety net for controllers/
├── Dockerfile                    # multi-stage: deps → build → runtime; USER node
├── .dockerignore
├── eslint.config.js              # ESLint 9 flat config; no-restricted-imports layering
├── vitest.config.ts
├── tsconfig.json                 # strict: true + noUncheckedIndexedAccess + noImplicitOverride
├── package.json                  # scripts: dev/build/start/test/lint/typecheck/migrate
├── .env.example
└── migrations/.gitkeep           # stub for node-pg-migrate

docker-compose.yml                # db + backend; pg_isready; depends_on service_healthy; pgdata
docker-compose.override.yml       # dev: tsx watch hot-reload, bind-mount ./backend
.env.example                      # root-level Postgres creds template
README.md                         # prerequisites, 3-command quickstart, architecture diagram
```

### Integration Points
- **PostgreSQL 15**: via `pg` v8 Pool, `DATABASE_URL` from env
- **Docker Compose**: db + backend services; `pgdata` named volume for persistence
- **W3C Trace Context**: `traceparent` header parsed inbound; echoed on responses

---

## Design Decisions

All 9 architectural decisions were resolved during the `/banyan-creative` phase. See `memory-bank/creative/TASK-001-project-foundation-architecture.md` for full rationale and trade-off analysis.

### Decision 1: ORM / DB Client → raw `pg` v8
- **Decision**: node-postgres (`pg`) v8 with raw SQL and typed results
- **Rationale**: Honors "No Premature Abstractions"; avoids Prisma's code generation overhead; readable SQL with TypeScript generics is sufficient for MVP
- **Alternatives**: Prisma, Kysely, Drizzle
- **Reference**: `memory-bank/creative/TASK-001-project-foundation-architecture.md`

### Decision 2: Migration Tool → node-pg-migrate v7
- **Decision**: node-pg-migrate v7 (upgrade to v8 is security debt, deferred)
- **Rationale**: Lightweight, convention-driven; consistent with raw `pg` choice; no code generation
- **Security Note**: v7 has HIGH severity transitive `glob` vulnerability (CLI-only attack surface); upgrade to v8 before writing migration files

### Decision 3: Test Framework → Vitest v2
- **Decision**: Vitest v2 (backend and frontend)
- **Rationale**: ESM-native; co-located with Vite on frontend; faster than Jest in ESM mode
- **Security Note**: v2 has MODERATE severity transitive `esbuild` vulnerability (dev-only); upgrade after all test files are written

### Decision 4: Logger → pino v9 behind Logger interface
- **Decision**: pino v9 as concrete implementation; `Logger` interface in `src/types/logger.ts` as the call-site contract
- **Rationale**: pino is synchronous to a custom stream (testable); Logger interface is OTel-compatible (same method names as OTel Logger API); migration to full OTel SDK will only touch `config/logger.ts`

### Decision 5: Layering Enforcement → ESLint no-restricted-imports + structural test
- **Decision**: `no-restricted-imports` rules in `eslint.config.js` (controllers/ blocks pg, repositories/, config/db*) + structural test in `layering.test.ts` (readdirSync + regex for raw SQL)
- **Rationale**: ESLint catches import violations; structural test catches template-literal SQL that import rules cannot detect

### Decision 6: Directory Layout → type-folder
- **Decision**: `backend/src/{controllers,services,repositories,routes,middleware,config,types,__tests__}`
- **Rationale**: Explicitly required by systemPatterns.md; familiar to Node.js developers; health-check is the worked vertical slice demonstrating the pattern

### Decision 7: Healthcheck Contract → /health/live + /health/ready
- **Decision**: Two endpoints (Kubernetes liveness/readiness probe convention)
- **Rationale**: `/health/live` (process status, no DB dependency) and `/health/ready` (includes DB check) serve different operational use cases; Docker healthcheck uses `/health/live`

### Decision 8: Dockerfile Strategy → multi-stage + dev override
- **Decision**: Multi-stage Dockerfile (deps → build → runtime); `docker-compose.override.yml` for dev hot-reload (tsx watch + bind-mount)
- **Rationale**: Production image is minimal (node:20-alpine runtime stage, USER node); dev workflow uses the deps stage with source bind-mount for tsx watch

### Decision 9: Observability MVP Scope → Logger interface + trace middleware
- **Decision**: Logger interface + pino implementation + W3C traceparent correlation middleware in Phase 5; full OTel exporter wiring deferred post-MVP
- **Rationale**: The Logger interface is OTel-compatible (trace/debug/info/warn/error/fatal + child() + withTraceContext()); deferred wiring is mechanical. Full OTel SDK adds ~3MB to bundle and requires a collector endpoint.

---

## Implementation

### Phases

| Phase | Tests | Outcome |
|-------|-------|---------|
| Phase 1: TypeScript scaffolding + ESLint | 0 (tsc + lint) | ✅ Complete |
| Phase 2: Health check vertical slice | 5 | ✅ Complete |
| Phase 3: Docker Compose + PostgreSQL service | 0 (infrastructure) | ✅ Complete |
| Phase 4: PostgreSQL client + connectivity test | 4 | ✅ Complete |
| Phase 5: Observability foundation | 4 | ✅ Complete |
| Phase 6: Layering enforcement | 2 | ✅ Complete |
| Phase 7: Documentation + memory-bank updates | 0 | ✅ Complete |

### Technical Specifications

**TypeScript Configuration:**
- `"strict": true` (enables noImplicitAny, strictNullChecks, etc.)
- `"noUncheckedIndexedAccess": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`
- Module: NodeNext (ESM)

**ESLint Rules (key):**
- `@typescript-eslint/no-explicit-any: error`
- `no-console: error` (in src/**; pino is the only logging path)
- `no-restricted-imports`: controllers/ cannot import pg, @prisma/client, kysely, or src/repositories/ or src/config/db*; services/ cannot import pg or src/config/db*

**Environment Variables:**

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | YES (fail-fast) | — | PostgreSQL connection string |
| `PORT` | No | `3001` | Backend listen port |
| `LOG_LEVEL` | No | `info` | Logger verbosity |
| `LOG_FORMAT` | No | `json` | Logger output format |
| `LOG_OUTPUT` | No | `stdout` | Logger destination |
| `LOG_REDACT_PATTERNS` | No | `password,secret,token,apiKey,authorization` | Fields to redact |
| `NODE_ENV` | No | `production` | Runtime environment |
| `SERVICE_NAME` | No | `banyanboard-backend` | OTel service name |
| `SERVICE_VERSION` | No | from package.json | OTel service version |
| `PG_POOL_MAX` | No | `10` | Connection pool max size |
| `PG_POOL_IDLE_TIMEOUT_MS` | No | `30000` | Idle connection timeout |
| `PG_CONNECTION_TIMEOUT_MS` | No | `10000` | Connection timeout |
| `POSTGRES_USER` | No | `banyan` | Compose DB user |
| `POSTGRES_PASSWORD` | No | `changeme` | Compose DB password |
| `POSTGRES_DB` | No | `banyanboard` | Compose DB name |

---

## Testing

### Strategy
Integration-first: health endpoint tests use supertest against the real Express app (no mocks); DB connectivity tests hit real PostgreSQL (require Docker). Unit tests cover stateless helpers only (logger, structural layering).

### Results

| Test File | Tests | Approach | Docker Required |
|-----------|-------|----------|----------------|
| health.test.ts | 5 | supertest + real Express app | No |
| logger.test.ts | 4 | synchronous Writable stream injection | No |
| layering.test.ts | 2 | readdirSync + regex scan of controllers/ | No |
| db.test.ts | 4 | real pg Pool against live Postgres | YES |
| **Total** | **15** | | |

Non-DB tests: 15/15 pass (628ms). DB tests: verified manually with `docker compose up -d db`.

### What is NOT tested
- Docker healthcheck timing (environmental)
- TypeScript compilation (covered by `tsc --noEmit`)
- ESLint rule configuration (covered by `npm run lint`)
- Third-party library internals

---

## Deployment

### Quickstart (Three Commands)

```bash
git clone <repo> banyanboard && cd banyanboard
cp backend/.env.example backend/.env
docker compose up -d
```

Verify: `curl http://localhost:3001/health/live` → `{"status":"ok","uptime":...}`

### Production Container

The backend `Dockerfile` produces a minimal runtime image:
- Base: `node:20-alpine`
- USER: `node` (non-root)
- EXPOSE: `3001`
- Healthcheck: `wget --no-verbose --tries=1 --spider http://localhost:3001/health/live`

### Docker Compose Services

| Service | Image | Port | Healthcheck |
|---------|-------|------|------------|
| `db` | `postgres:15-alpine` | 5432 | `pg_isready -U $POSTGRES_USER` |
| `backend` | Custom Dockerfile | 3001 | `wget /health/live` |

`backend` depends on `db` with `condition: service_healthy`.

### Development (Hot Reload)

`docker-compose.override.yml` overrides the backend service to use the `deps` build stage with `./backend` bind-mounted and `npx tsx watch src/index.ts` as the command.

### Environment Configuration

Copy `backend/.env.example` → `backend/.env`. The backend fails fast at startup if `DATABASE_URL` is missing.

### Rollback

```bash
docker compose down     # stop services (preserves pgdata volume)
git checkout main       # revert to previous code
docker compose up --build -d
```

---

## Maintenance

### Monitoring

- **Process health**: `GET /health/live` — returns 200 if the process is alive
- **DB health**: `GET /health/ready` — returns 200 if DB is reachable
- **Container health**: `docker compose ps` — shows healthy/unhealthy status
- **Logs**: `docker compose logs backend` — structured JSON logs with traceId per request

### Observability

All log lines include: `timestamp`, `level`, `message`, `service`, `version`, `environment`. Request logs include: `method`, `path`, `statusCode`, `durationMs`, `traceId`, `spanId`. Sensitive fields (`password`, `secret`, `token`, `apiKey`, `authorization`) are redacted via pino's redact option.

### Common Issues

| Issue | Resolution |
|-------|------------|
| Backend unhealthy at startup | Check `docker compose logs backend` — likely missing DATABASE_URL or DB not ready |
| DB connection refused | `docker compose up -d db` first; wait for healthy status |
| Tests fail with ECONNREFUSED | DB tests require Docker: `docker compose up -d db` |
| TypeScript errors | Run `npm run typecheck --prefix backend` — ensure no implicit any |
| Lint errors | Run `npm run lint --prefix backend` — check for console.log or pg imports in controllers |

### Operational Procedures

```bash
# Check all service status
docker compose ps

# View real-time logs
docker compose logs -f backend

# Restart backend (after code change)
docker compose restart backend

# Full rebuild
docker compose up --build -d

# Run DB migrations
npm run migrate --prefix backend

# Wipe database (development only)
docker compose down -v && docker compose up -d
```

---

## Security Debt

Two dependency upgrades were deferred during Phase 1 code review:

1. **node-pg-migrate v7 → v8** (HIGH severity)
   - CVE: GHSA-5j98-mcp5-4vw2 (transitive `glob@11.0.x`, CWE-78 CLI command injection)
   - Attack surface: CLI only (not server runtime)
   - Upgrade before writing the first real migration file

2. **vitest v2 → v4** (MODERATE severity)
   - CVE: GHSA-67mh-4wv8-2f99 (transitive `esbuild≤0.24.2`, dev-only origin check bypass)
   - Attack surface: developer machine only (requires malicious page + active dev server)
   - Upgrade after all test files are written (breaking changes across v2→v3 and v3→v4)

Both are documented in `memory-bank/projectbrief.md` Security Debt section.

---

## Lessons Learned

Key takeaways from the reflection (full details in `memory-bank/reflection/reflection-TASK-001.md`):

1. **Resolve architecture decisions before build** — the `/banyan-creative` phase resolved all 9 blocking decisions with documented rationale. This eliminated in-flight decision-making across all 7 build phases.

2. **TDD-first pays off immediately** — Test Writer before Coding Agent consistently produced correct implementations without rework. The p95 latency test (not a stub) drove a real integration assertion.

3. **Interface-first for cross-cutting concerns** — The Logger interface in `types/` decoupled from pino in `config/` means every future change to logging infrastructure (e.g., OTel wiring) touches only `config/logger.ts`.

4. **Belt-and-braces layering enforcement** — ESLint no-restricted-imports (primary) + structural test (safety net for template-literal SQL) covers both import-level and content-level violations.

---

## Future Considerations

### Technical Debt
- Upgrade node-pg-migrate to v8 (HIGH — before first real migration file)
- Upgrade vitest to v4 (MODERATE — after all test files are stable)
- HealthRepository uses pool singleton rather than constructor injection — refactor when first real repository is written

### Missing for Production
- Full OTel SDK wiring (collector, exporter, distributed spans) — abstraction exists; wiring is mechanical
- Retry logic in `checkDatabaseConnection()` — currently fail-fast with no retry
- pg Pool `error` event handler — unhandled pool errors currently go to `process.on('uncaughtException')`

### Next Features
- See `memory-bank/roadmap.md` for the next planned features (boards, columns, cards, auth)
- All future features build on this foundation: Express routes → controllers → services → repositories → PostgreSQL

---

## References

- **Reflection**: `memory-bank/reflection/reflection-TASK-001.md`
- **Architecture Design**: `memory-bank/creative/TASK-001-project-foundation-architecture.md`
- **Progress Log**: `memory-bank/progress.md`
- **Technology Stack**: `memory-bank/techContext.md`
- **System Patterns**: `memory-bank/systemPatterns.md`
- **Roadmap**: `memory-bank/roadmap.md`
