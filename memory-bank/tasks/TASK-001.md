# TASK-001: Project Foundation

**Complexity**: Level 4 (inherited from FEAT-001)
**Status**: CREATIVE_COMPLETE
**Roadmap**: FEAT-001
**Branch**: feature/FEAT-001-project-foundation
**Worktree**: .claude-worktrees/FEAT-001

## Task Description

Set up the complete project skeleton for BanyanBoard. Includes: Express API with TypeScript (strict mode), Docker Compose service for PostgreSQL, health check endpoint (`GET /health`) with integration tests, and a clean layered project structure (controllers → services → repositories). This is the foundation every future feature depends on.

## Specification

**Feature Type**: NFR/Infrastructure
**Complexity**: Level 4 (foundation for all future features)
**Creative Exploration Needed**: Yes — multiple foundational tech decisions require design exploration before implementation. See "Creative Exploration Needed" section below.

> **Codebase Confidence Note**: This is a greenfield project. The repository currently contains only `memory-bank/`, `.claude/`, `CLAUDE.md`, `.gitignore`, and a stub `package.json`. There are no existing `backend/`, `frontend/`, `db/`, or `docker-compose.yml` files. As a result, many decisions in this spec carry **MEDIUM** or **LOW** confidence and are flagged for the Architecture Design creative phase rather than guessed.

### Verification Method

- **Primary test method**: Automated test suite run via `npm test --prefix backend` — must exit with code 0
- **Container orchestration test**: `docker compose up -d` followed by health check probes — all services must report healthy
- **Health endpoint probe**: `curl -fsS http://localhost:3001/health` returns HTTP 200 with JSON body `{"status":"ok"}` (exact contract TBD in creative phase — confidence: MEDIUM)
- **Lint and type-check**: `npm run lint --prefix backend` and `npm run typecheck --prefix backend` both exit 0
- **Database connectivity test**: An integration test connects from the backend container to the PostgreSQL container using credentials from environment variables and executes `SELECT 1`
- **Structural verification**: Static check (or a "stub detection" test) that asserts no SQL strings and no `pg` / ORM imports exist inside any file under `backend/src/controllers/**`
- **Observable at**:
  - Local terminal output (`docker compose ps` shows all services healthy)
  - Test runner output (Jest/Vitest summary)
  - `GET /health` endpoint responses
  - Container logs (`docker compose logs backend`)
- **Verification frequency**: One-time at end of TASK-001; re-run on every CI build thereafter

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| `GET /health` availability | 100% after `docker compose up` reports healthy | Manual probe + integration test |
| `GET /health` p95 latency | < 50ms on localhost | Integration test assertion |
| Cold start time (backend container) | < 10s from `docker compose up` to first healthy probe | Docker healthcheck timing |
| Backend test suite duration | < 30s for the foundation test set | Test runner output |
| TypeScript strict mode coverage | 100% — `"strict": true` in tsconfig and zero `any` in src | `tsc --noEmit` + lint rule |
| Layering violations | 0 — controllers contain no SQL, no `pg`/ORM imports | Lint rule or structural test |
| Lines of business logic in controllers | 0 — controllers only validate input and delegate | Code review + AC-VERIFY-3 |

### Acceptance Criteria

#### AC-VERIFY-1: Backend server starts and the health endpoint responds correctly
**Priority**: MUST
**Given** the backend has been installed (`npm install --prefix backend`) and the project is started via `docker compose up -d`
**When** a client issues `GET http://localhost:3001/health`
**Then**
- the response status is `200 OK`
- the response `Content-Type` is `application/json`
- the response body is a JSON object containing at minimum `{"status":"ok"}` (additional fields like `uptime`, `version`, `dbStatus` are permitted)
- the response is returned in under 200ms on a developer laptop
- an integration test in `backend/src/__tests__/` boots the Express app and asserts the same contract using a real HTTP request (supertest or equivalent) — not a mocked handler

#### AC-VERIFY-2: PostgreSQL is reachable from the backend using environment-driven configuration
**Priority**: MUST
**Given** `docker compose up -d` has been run and both `backend` and `db` services are reported healthy
**When** the backend executes its database connectivity check (either at startup or via an integration test)
**Then**
- the backend successfully opens a connection to the PostgreSQL container using **only** environment variables (`DATABASE_URL` or discrete `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`) — no hardcoded credentials in source
- a `SELECT 1` query returns the expected scalar result
- the `db` service in `docker-compose.yml` declares a healthcheck (e.g., `pg_isready`) and the `backend` service has `depends_on` with `condition: service_healthy`
- an integration test under `backend/src/__tests__/` asserts the round-trip query succeeds against a real PostgreSQL instance (not a mock) — the test may use the docker-compose database or an ephemeral test container, but it MUST hit a real Postgres
- credentials are sourced from a `.env`-style file (with a committed `.env.example` template) and `.env` is gitignored

#### AC-VERIFY-3: The layered architecture is enforced — no business logic or data access in controllers
**Priority**: MUST
**Given** the project skeleton has been generated with the directory structure `backend/src/{controllers,services,repositories,routes}` (final names TBD in creative phase — confidence: MEDIUM)
**When** an automated check runs across `backend/src/controllers/**/*.ts`
**Then**
- no file in `controllers/` imports `pg`, `prisma`, `kysely`, or any direct database driver
- no file in `controllers/` contains raw SQL string literals (regex: case-insensitive `\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b\s+FROM`)
- each controller method body delegates to a service: the method exists primarily to `(req, res) => { service.method(...); res.json(...) }` with input parsing/validation permitted
- the health check feature ships as a worked example of the pattern: `HealthController` → `HealthService` → (optionally) `HealthRepository` — even if the service body is trivial, the layering is in place to anchor the convention
- enforcement is automated, not manual: either an ESLint rule (e.g., `no-restricted-imports` for `pg` inside `controllers/`), a custom unit test that scans file contents, or `eslint-plugin-boundaries` — chosen during the Architecture Design creative phase

#### AC-VERIFY-4: Project meets 12-Factor configuration standards
**Priority**: MUST
**Given** the project skeleton is complete
**When** the codebase is reviewed for configuration handling
**Then**
- all environment-specific values (DB connection, port, log level, any future secrets) are read from `process.env` — not hardcoded
- a `.env.example` file at `backend/.env.example` lists every required variable with safe placeholder values and inline comments
- `.env` and `.env.*` are in `.gitignore` (except `.env.example`) — already partly present in root `.gitignore`; backend may need its own
- the backend fails fast at startup with a clear error message if a required environment variable is missing (no silent fallback to insecure defaults)
- `docker-compose.yml` reads secrets from `.env` via `env_file:` or `environment:` interpolation — credentials do not appear in plain text in the compose file

#### AC-VERIFY-5: TypeScript strict mode is enforced end-to-end
**Priority**: MUST
**Given** the backend TypeScript project has been initialized
**When** `npm run typecheck --prefix backend` (i.e., `tsc --noEmit`) is executed
**Then**
- the command exits with code 0
- `backend/tsconfig.json` declares `"strict": true` (which enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`)
- additional strictness flags are enabled: `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true` (final list confirmed in creative phase)
- zero usages of `any` or `@ts-ignore` in `backend/src/**` — enforced via lint rule (`@typescript-eslint/no-explicit-any: error`)
- the lint configuration is committed and `npm run lint --prefix backend` exits 0

#### AC-VERIFY-6: Docker Compose orchestrates the full local development stack
**Priority**: MUST
**Given** the operator has Docker Desktop installed and the repo cloned
**When** they run `docker compose up -d` from the repository root with no prior setup beyond copying `.env.example` → `.env`
**Then**
- the `db` (PostgreSQL 15) and `backend` services start without errors
- both services become "healthy" within 30 seconds (PostgreSQL via `pg_isready`, backend via the `/health` endpoint as a healthcheck command)
- a named Docker volume persists PostgreSQL data across `docker compose down` / `docker compose up` cycles
- `docker compose down -v` (explicit `-v`) wipes the volume — verified by reconnecting and confirming an empty database
- `docker compose logs backend` shows structured startup logs (JSON or human-readable — final choice TBD) and no unhandled exceptions
- the README or a `docs/getting-started.md` documents the three-command happy path: clone → `cp backend/.env.example backend/.env` → `docker compose up -d`

#### AC-VERIFY-7: Observability foundation is in place
**Priority**: SHOULD (Level 4 requires observability per CLAUDE.md; full OTel can defer to post-MVP per roadmap note)
**Given** the backend is running
**When** any HTTP request is handled
**Then**
- the backend uses a structured logger (not bare `console.log`) — final library TBD in creative phase (pino, winston, or OpenTelemetry SDK)
- every log line emitted in production code is JSON when `LOG_FORMAT=json`, with at minimum: `timestamp`, `level`, `message`, `service`
- the log level is controlled by the `LOG_LEVEL` environment variable
- a lint rule blocks `console.log` / `console.error` in `backend/src/**` (warn or error level)
- request-scoped correlation IDs (e.g., from `traceparent` header or generated per request) are propagated through logs — full W3C Trace Context / OTel exporter wiring may be deferred but the abstraction (a `Logger` interface + middleware) must exist

#### AC-VERIFY-8: The foundation is documented for the next developer
**Priority**: MUST
**Given** a new developer (or future automated workflow) opens the repo
**When** they read the root `README.md`
**Then**
- the README documents: prerequisites (Docker, Node 20 LTS), three-command quickstart, where to find environment templates, how to run tests, the layered architecture diagram, and the next-step roadmap link
- `memory-bank/techContext.md` is updated by the Document sub-agent during build to record the final library choices (ORM/migration tool/test framework/logger)
- `memory-bank/systemPatterns.md` Testing Patterns section is filled in (currently "[To be defined]")

### Scope Boundaries

#### In Scope
- TypeScript 5.x backend with Express 4.x (per techContext)
- `tsconfig.json` with `strict: true` plus additional safety flags
- `package.json` scripts: `dev`, `build`, `start`, `test`, `lint`, `typecheck`, `migrate` (stub OK if no migrations yet)
- `docker-compose.yml` with at minimum `db` (PostgreSQL 15) and `backend` services, healthchecks, named volume, env_file wiring
- `Dockerfile` for the backend service (multi-stage: builder + slim runtime — final approach TBD)
- Layered directory skeleton: `backend/src/{controllers,services,repositories,routes,middleware,config,types,__tests__}` (final layout TBD in creative phase)
- `GET /health` endpoint with a representative `HealthController` → `HealthService` flow demonstrating the layering pattern
- Integration test for `/health` using a real HTTP request against the booted app
- Integration test for PostgreSQL connectivity (real DB, not mocked)
- ESLint + Prettier configuration for the backend with rules enforcing: no `any`, no `console.log` in src, no `pg` imports in controllers
- `.env.example` for backend
- Structured logger abstraction (interface + at least one implementation) — exact library chosen in creative phase
- Root `README.md` updated with quickstart
- `memory-bank/techContext.md` updated with chosen libraries
- `memory-bank/systemPatterns.md` Testing Patterns filled in

#### Out of Scope (deferred to later FEATs)
- Frontend (`frontend/`) — explicitly deferred; `docker-compose.yml` may stub the service but no React app is built in TASK-001
- Authentication / authorization (deferred — Open Questions in productBrief still open: JWT vs session)
- Domain entities (boards, columns, cards, users) — TASK-001 only ships the health-check vertical slice
- Database migrations beyond what's needed to verify connectivity (no `users`, `boards`, `cards` tables)
- Full OpenTelemetry exporter wiring (collector endpoint, distributed tracing across services) — abstraction MUST exist, full wiring may defer per Level 4 observability note
- CI/CD pipeline (GitHub Actions, etc.)
- Production deployment artifacts (HTTPS reverse proxy, secrets manager integration)
- WebSockets / real-time features
- Drag-and-drop / any UI behavior
- Backup / restore tooling
- Pre-commit hooks (nice-to-have; can defer)

#### Dependencies
- **External**: Docker Desktop (or Docker Engine + Compose v2) on the developer machine; Node 20 LTS for local non-container workflows
- **Internal**: None — this IS the foundation; nothing precedes it
- **Decisions blocking implementation**: ORM choice, migration tool choice, test framework choice, logger choice, lint-layering enforcement mechanism — all flagged for the Architecture Design creative phase

#### NFR Implications (from productBrief.md)
- **Performance**: `/health` is a baseline for p95 < 200ms API SLO — the integration test asserts < 200ms but the realistic target is < 50ms since there's no business logic
- **Security**: Sets the precedent for credential handling (env vars, bcrypt-ready) — TASK-001 must not commit any real secrets
- **Availability**: Healthchecks in compose enable Docker to restart unhealthy containers — required for self-hosted reliability
- **Accessibility / i18n / Browsers**: N/A for this infrastructure phase

### Creative Exploration Needed

This Level 4 foundation has multiple genuinely open architectural decisions. The Architecture Design creative phase MUST resolve the following before `/banyan-build` starts:

1. **Database client / ORM** (techContext flags TBD: `pg` raw vs Prisma vs Kysely vs Drizzle vs TypeORM)
   - Trade-offs: raw `pg` aligns with "no premature abstractions" but loses type safety; Prisma is heavyweight but offers migrations + type generation in one tool; Kysely/Drizzle are lighter typed query builders
   - Confidence: **LOW** — productBrief notes "favor readability" but techContext leaves it explicitly TBD

2. **Migration tool**
   - Options: `node-pg-migrate`, Prisma Migrate (if Prisma is chosen), Flyway (Java-based — adds JVM dependency), `kysely-migrate`, or hand-rolled SQL files run by a tiny script
   - Trade-offs: tightly coupled to ORM choice above
   - Confidence: **LOW** — depends on (1)

3. **Test framework** (Jest vs Vitest for backend)
   - techContext says "Jest or Vitest (TBD)"
   - Trade-offs: Vitest is faster and ESM-native; Jest is the incumbent and has the largest ecosystem; backend and frontend can use different frameworks but consistency reduces context-switching
   - Confidence: **MEDIUM** — leaning Vitest given Vite on the frontend, but not decided

4. **Structured logging library**
   - Options: `pino` (fast, minimal), `winston` (mature, transports), OpenTelemetry SDK directly
   - Per CLAUDE.md Observability section, OTel is the standard; per Level 4 we should at least have the abstraction
   - Confidence: **MEDIUM** — recommend `pino` as the concrete logger behind an OTel-friendly interface, but flag for creative

5. **Layering enforcement mechanism**
   - Options: (a) `eslint-plugin-boundaries`, (b) `eslint-plugin-import` with `no-restricted-paths`, (c) custom unit test that greps `backend/src/controllers/**` for forbidden imports/SQL, (d) `dependency-cruiser`
   - Confidence: **MEDIUM** — option (a) or (b) is conventional; option (c) is simpler but less idiomatic

6. **Directory layout details**
   - `backend/src/{controllers,services,repositories,routes,middleware,config,types}` vs feature-folders (`backend/src/features/health/{controller,service,repository}`)
   - systemPatterns says layered; feature-folders are also "layered" within each feature — which interpretation wins?
   - Confidence: **MEDIUM** — defaulting to type-folders (controllers/services/repositories) per the systemPatterns diagram, but flag for creative

7. **Healthcheck contract**
   - Minimal `{"status":"ok"}` vs richer payload (`uptime`, `version`, `dbStatus`, dependency check rollup)
   - Trade-offs: richer is more useful operationally but couples `/health` to the database, which complicates "liveness vs readiness" distinction
   - Confidence: **MEDIUM** — recommend two endpoints (`/health/live` returns process status only, `/health/ready` includes DB) per Kubernetes conventions; flag for creative

8. **Backend Dockerfile strategy**
   - Multi-stage builder + slim runtime vs single-stage dev image
   - Bind-mount source for hot reload vs rebuild on change
   - Confidence: **MEDIUM** — multi-stage for prod parity, with a separate dev compose override for hot reload

9. **Observability scope for MVP**
   - Per Level 4 + CLAUDE.md, OpenTelemetry is the standard. Realistically, full OTel wiring (collector, exporters, propagators) is a large effort. Should TASK-001 ship: (a) logger interface only, (b) logger + trace context middleware, or (c) full OTel SDK with stdout exporter?
   - Confidence: **LOW** — needs explicit scope call in creative

### Implementation Guide Required

**Yes** — because several decisions above are not fully auto-verifiable from this spec alone, the Architecture Design creative document (and subsequent `/banyan-plan` Step 5 Implementation Roadmap) must produce a step-by-step guide covering:
1. `npm init` + `tsconfig.json` + lint/format setup
2. Directory skeleton creation
3. Express app + `/health` controller/service
4. Logger abstraction
5. `docker-compose.yml` + `Dockerfile` + healthchecks + `.env.example`
6. Integration test setup (test framework + supertest + Postgres connectivity test)
7. Layering enforcement (lint or test)
8. README + memory-bank updates

## Test Strategy

### Approach
- **Emphasis**: Integration-first — the health endpoint and DB connectivity tests MUST hit a real running server and real PostgreSQL, not mocks. Unit tests cover stateless helpers only.
- **Target test count**: 15–18 tests across all phases

### File Organization
- **New test files**:
  - `backend/src/__tests__/health.test.ts` — integration tests for `GET /health` (supertest against real app)
  - `backend/src/__tests__/db.test.ts` — PostgreSQL connectivity integration tests (real DB via docker-compose or test container)
  - `backend/src/__tests__/layering.test.ts` — structural enforcement test scanning `controllers/**` for forbidden imports/SQL (if lint-based approach is not chosen)
  - `backend/src/__tests__/logger.test.ts` — unit tests for logger interface (JSON output shape, LOG_LEVEL respected)
- **Extend existing**: N/A — no existing test files

### What NOT to Test
- Docker healthcheck timing — environmental, not deterministic in CI
- TypeScript compilation correctness — covered by `tsc --noEmit`
- ESLint rule configuration itself — covered by the ESLint ecosystem
- `package.json` script correctness — not a unit test concern
- Third-party library behaviour (express routing internals, pg driver) — test our code's use of them, not the libraries

### Per-Phase Test Guidance
- **Phase 1** (scaffolding): 0 runtime tests — verified by `tsc --noEmit` and `npm run lint` exiting 0
- **Phase 2** (health vertical slice): 5 tests
  - Happy path: `GET /health` returns `200` with JSON body containing `status: "ok"`
  - Content-Type is `application/json`
  - Unsupported method `POST /health` returns `405` or `404`
  - Response arrives in < 200ms (latency assertion)
  - `HealthService.getStatus()` returns the expected shape (unit test)
- **Phase 3** (Docker Compose): 0 runtime tests — verified by `docker compose up -d` + manual probe; Docker healthcheck assertions in `docker-compose.yml`
- **Phase 4** (PostgreSQL integration): 4 tests
  - `SELECT 1` returns scalar `1` via the DB client against real Postgres
  - Connection fails fast with clear error when `DATABASE_URL` is missing/wrong
  - Pool is released correctly after query (no hanging test process)
  - Startup `checkDatabaseConnection()` helper resolves successfully against real DB
- **Phase 5** (observability): 4 tests
  - Logger emits JSON with required fields (`timestamp`, `level`, `message`, `service`) when `LOG_FORMAT=json`
  - `LOG_LEVEL=warn` suppresses `info`-level messages
  - Logger interface is honoured — concrete implementation swappable (interface test)
  - `console.log` lint rule fires on a fixture file containing `console.log` (ESLint test or documented as manual)
- **Phase 6** (layering enforcement): 2 tests (or lint — documented after creative decision)
  - If structural test approach: a file under `controllers/` with a `pg` import fails the check
  - If ESLint approach: confirmed via `npm run lint` exit code on a fixture — document in README
- **Phase 7** (documentation): 0 runtime tests — verified by human review of README + memory-bank updates

## Implementation Roadmap

### Business Context
BanyanBoard is a self-hosted Kanban tool for 2–15 person teams. Every future feature (boards, cards, auth, drag-and-drop) depends on this foundation being correct, fast, and easy to extend. Getting the architecture wrong here compounds across every subsequent build cycle. Level 4 planning is appropriate.

### Architectural Principles (from systemPatterns.md)
1. **Clean Architecture** — controllers → services → repositories; no business logic or DB access in route handlers or controllers
2. **12-Factor Config** — all environment-specific values via `process.env`; fail fast on missing required vars
3. **Simplicity over Cleverness** — no clever abstractions; prefer readable, explicit code
4. **No Premature Abstractions** — don't create shared helpers until 3+ concrete cases exist
5. **Observability First** — structured logging from day one; OTel abstraction present even if exporters deferred

### Observability Requirements (Level 4 mandatory)

**Logging Architecture:**
- Library: TBD in creative phase (pino recommended — fast, JSON-native, OTel-compatible)
- Format: JSON when `LOG_FORMAT=json` (fields: `timestamp`, `level`, `message`, `service`, `traceId` if available)
- Levels: `debug`, `info`, `warn`, `error` controlled by `LOG_LEVEL` env var
- No `console.log` / `console.error` in `backend/src/**` — enforced via lint rule
- Configuration: `LOG_LEVEL`, `LOG_FORMAT`, `LOG_OUTPUT`

**Tracing Architecture:**
- Standard: W3C Trace Context (`traceparent` header)
- SDK: OpenTelemetry abstraction MUST exist in TASK-001 (a `Logger` interface + request correlation middleware)
- Full OTel exporter wiring (collector, traces to Jaeger/Tempo) deferred to post-MVP per productBrief constraints
- Per-request correlation IDs propagated through all log lines

**Metrics Architecture:**
- Out of scope for foundation phase — standard HTTP metrics added when real endpoints ship

### API Requirements

**REST:**
- `GET /health` (or `/health/live` + `/health/ready` — TBD in creative phase)
- No authentication on health endpoint
- Response: `200 {"status":"ok"}` minimum; richer payload TBD
- `GET /health` must complete in < 200ms (target < 50ms with no business logic)

### Creative Decisions Required Before Build

The following 9 decisions are **blocking** for implementation — they MUST be resolved in `/banyan-creative TASK-001` (Architecture Design phase):

| # | Decision | Confidence | Impact |
|---|----------|-----------|--------|
| 1 | ORM / DB client (raw pg vs Prisma vs Kysely vs Drizzle) | LOW | Phase 1, 4 |
| 2 | Migration tool (node-pg-migrate vs Prisma Migrate vs hand-rolled) | LOW | Phase 1, 4 |
| 3 | Test framework (Jest vs Vitest for backend) | MEDIUM | Phase 2, 4, 5 |
| 4 | Logger library (pino vs winston vs OTel SDK) | MEDIUM | Phase 5 |
| 5 | Layering enforcement (eslint-plugin-boundaries vs custom test) | MEDIUM | Phase 6 |
| 6 | Directory layout (type-folders vs feature-folders) | MEDIUM | Phase 1 |
| 7 | Healthcheck contract (single `/health` vs `/health/live`+`/health/ready`) | MEDIUM | Phase 2 |
| 8 | Dockerfile strategy (multi-stage vs single-stage + dev override) | MEDIUM | Phase 3 |
| 9 | Observability MVP scope (logger interface only vs logger+trace middleware vs full OTel) | LOW | Phase 5 |

### Implementation Phases

- [x] **Phase 1: TypeScript backend scaffolding + ESLint** ✓

  **Completed**: 2026-05-16 | **Tests**: 0 (scaffolding — verified by tsc + lint) | **Code Review**: APPROVED WITH NOTES
  - `backend/package.json` with scripts: dev, build, start, test, lint, typecheck, migrate (stub)
  - `backend/tsconfig.json` — strict mode + noUncheckedIndexedAccess + noImplicitOverride
  - ESLint + Prettier + `@typescript-eslint` config with: `no-explicit-any: error`, `no-console: error` in src
  - Directory skeleton: `backend/src/{controllers,services,repositories,routes,middleware,config,types,__tests__}`
  - Express app entry point (`src/app.ts`) + server bootstrap (`src/index.ts`) — reads PORT from env
  - `.env.example` with required variable list and comments
  - `backend/.gitignore` covering `node_modules`, `dist`, `.env`
  - *Decisions required from creative: directory layout, ORM package to install, test framework to install*
  - *Verified by: `tsc --noEmit` exits 0, `npm run lint` exits 0*

- [x] **Phase 2: Health check vertical slice** ✓

  **Completed**: 2026-05-16 | **Tests**: 5 (all pass) | **Code Review**: APPROVED WITH NOTES
  - `GET /health/live` and `GET /health/ready` implemented through HealthController → HealthService → HealthRepository (stub)
  - `backend/src/controllers/HealthController.ts` — async/await, delegates to service
  - `backend/src/services/HealthService.ts` — uses config.serviceVersion, stub repo returns ok
  - `backend/src/repositories/HealthRepository.ts` — Phase 2 stub: returns true
  - `backend/src/routes/health.ts` — wires object graph, mounts to Express Router
  - `backend/vitest.config.ts` — Vitest config with setupFiles
  - `backend/src/__tests__/setup.ts` — sets DATABASE_URL before config module loads
  - `backend/tsconfig.eslint.json` — includes test files for ESLint type-checking
  - Integration tests in `backend/src/__tests__/health.test.ts` — 5/5 tests pass
  - *Verified by: `npm test --prefix backend` exits 0, typecheck PASS, lint PASS, build PASS*

- [x] **Phase 3: Docker Compose + PostgreSQL service** ✓

  **Completed**: 2026-05-16 | **Tests**: 0 (infrastructure — verified by tsc + lint + regression) | **Code Review**: APPROVED WITH NOTES
  - `backend/Dockerfile` — multi-stage: deps → build → runtime; USER node; EXPOSE 3001; wget healthcheck on /health/live
  - `backend/.dockerignore` — excludes node_modules, dist, .env.*, coverage, .git, src/__tests__, vitest.config.ts
  - `docker-compose.yml` — db (postgres:15-alpine) + backend services; pg_isready healthcheck ($$-style); depends_on service_healthy; named volume pgdata; env_file optional
  - `docker-compose.override.yml` — dev hot-reload: targets deps stage, bind-mounts ./backend, tsx watch, working_dir /app
  - `.env.example` (root) — POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB with comments
  - *Verified by: 5/5 existing tests pass (regression), typecheck PASS, lint PASS, build PASS*
  - *Manual probe required: docker compose up -d → docker compose ps (all healthy) → curl /health/live → 200*

- [x] **Phase 4: PostgreSQL client + connectivity integration test** ✓

  **Completed**: 2026-05-16 | **Tests**: 4 new (9 total, all pass) | **Code Review**: APPROVED WITH NOTES
  - `backend/src/config/db.ts` — pg Pool singleton (poolMax, idleTimeout, connectionTimeout from env), exports `pool`, `checkDatabaseConnection()`, `closePool()`
  - `backend/src/config/env.ts` — added `PG_CONNECTION_TIMEOUT_MS` config (default 10s; REC-2 applied)
  - `backend/src/index.ts` — startup connectivity check with fail-fast; double-shutdown guard; `closePool()` in graceful shutdown (REC-3 applied)
  - `backend/src/__tests__/db.test.ts` — 4 integration tests: SELECT 1 returns 1, checkDatabaseConnection resolves, wrong-creds rejects, pool lifecycle clean
  - `backend/src/__tests__/setup.ts` — default DATABASE_URL fallback updated to docker-compose credentials
  - `backend/migrations/.gitkeep` — stub for node-pg-migrate
  - `backend/.env.example` — added PG_CONNECTION_TIMEOUT_MS
  - REC-1 (replace console with pino) deferred to Phase 5
  - *Verified by: 9/9 tests pass against real Postgres, typecheck PASS, lint PASS, build PASS*

- [ ] **Phase 5: Observability foundation**
  - Install chosen logger library (TBD from creative)
  - `src/types/logger.ts` — `Logger` interface (log, debug, info, warn, error methods)
  - `src/config/logger.ts` — concrete implementation reading `LOG_LEVEL`, `LOG_FORMAT` from env
  - `src/middleware/requestLogger.ts` — logs every request with method, path, status, duration, correlation ID
  - Correlation ID middleware: reads `traceparent` header if present, generates UUID if not, attaches to request and all log lines
  - Logger tests in `backend/src/__tests__/logger.test.ts` (4 tests per Test Strategy)
  - *Decisions required from creative: logger library, observability MVP scope*
  - *Verified by: logger tests pass, `LOG_FORMAT=json` produces valid JSON logs*

- [ ] **Phase 6: Layering enforcement**
  - Install and configure chosen enforcement mechanism (TBD from creative)
  - ESLint rule(s) blocking: `pg`/ORM imports in `controllers/`, `console.log` in `src/`
  - Document the rule in README under "Architecture Guardrails"
  - Structural test in `backend/src/__tests__/layering.test.ts` (if lint-only is insufficient)
  - *Decisions required from creative: enforcement mechanism choice*
  - *Verified by: `npm run lint` exits 0 on clean code; fixture file with violation causes lint/test to fail*

- [ ] **Phase 7: Documentation + memory-bank updates**
  - Root `README.md` — prerequisites, 3-command quickstart, architecture diagram (ASCII), test commands, layering rules, next-step roadmap link
  - Update `memory-bank/techContext.md` — record final library choices (ORM, migration, test framework, logger)
  - Update `memory-bank/systemPatterns.md` Testing Patterns section (currently "[To be defined]")
  - *Verified by: human review; techContext.md and systemPatterns.md no longer have "[To be defined]" placeholders*

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| ORM choice regretted after implementation | Medium | High | Evaluate in creative phase; prefer minimal surface area for MVP |
| Docker hot-reload friction slows dev loop | Medium | Medium | Use bind-mount volume + `tsx watch` in dev compose override |
| Integration tests flaky due to DB startup race | Medium | Medium | `depends_on: condition: service_healthy` + retry logic in test setup |
| TypeScript strict mode surprises (noUncheckedIndexedAccess is aggressive) | Low | Low | Enable flag set in creative and verify during Phase 1 scaffolding |

## Creative Phases

- [x] Architecture Design → COMPLETE (2026-05-16) — Output: memory-bank/creative/TASK-001-project-foundation-architecture.md
- [ ] Observability Design → deferred to post-MVP (abstraction in Phase 5 is sufficient for MVP foundation)

---

## Execution State

**Build Status**: IDLE
**Last Completed**: Phase 4: PostgreSQL client + connectivity integration test
**Phase Number**: 4 of 7 complete
**Is Multi-Phase**: YES
**Can Resume**: NO

### Current Build Step
**Step**: Step 11 - Git Completion
**Status**: COMPLETE
**Completed**: 2026-05-16

### Completed Steps (Phase 1)
- Architecture Design Creative: COMPLETE (2026-05-16)
- Step 0.5 Git Setup: COMPLETE (2026-05-16) — Worktree .claude-worktrees/FEAT-001 created, branch feature/FEAT-001-project-foundation
- Step 0.6 Phase Gate: COMPLETE (2026-05-16) — All checks passed
- Step 1 Read Task Context: COMPLETE (2026-05-16) — Phase 1 identified: TypeScript backend scaffolding + ESLint
- Step 2 Load Context: COMPLETE (2026-05-16) — Level 4 rules loaded
- Step 3 Test Writer: COMPLETE (2026-05-16) — 0 tests (Phase 1 is scaffolding; verified by tsc + lint)
- Step 4 Coding Agent: COMPLETE (2026-05-16) — 11 files created; npm install, typecheck, lint, build all exit 0
- Step 5/6 Test Batching/Execution: SKIPPED (0 tests in Phase 1)
- Step 7 Integration Verification: COMPLETE (2026-05-16) — typecheck PASS, lint PASS, build PASS
- Step 8 Code Reviewer: COMPLETE (2026-05-16) — APPROVED WITH NOTES; 4 recommended changes applied; 2 security upgrades deferred to projectbrief
- Step 9 Documentation: COMPLETE (2026-05-16) — techContext.md updated (final tech choices), systemPatterns.md updated (3 new patterns), JSDoc added to env.ts/app.ts/index.ts
- Step 10 Update Memory Bank: COMPLETE (2026-05-16) — Phase 1 marked complete in roadmap, progress.md updated, tasks.md updated

### Completed Steps (Phase 2)
- Step 0.5 Git Setup: COMPLETE (2026-05-16) — Worktree verified, on branch feature/FEAT-001-project-foundation
- Step 0.6 Phase Gate: COMPLETE (2026-05-16) — Phase 2 confirmed next unchecked phase
- Step 1 Read Task Context: COMPLETE (2026-05-16) — Phase 2: Health check vertical slice (Phase 2 of 7, Level 4)
- Step 2 Load Context: COMPLETE (2026-05-16) — Level 4 rules loaded, creative decisions read
- Step 3 Test Writer: COMPLETE (2026-05-16) — 5 tests in health.test.ts written (TDD first)
- Step 4 Coding Agent: COMPLETE (2026-05-16) — 6 files created/updated: HealthRepository, HealthService, HealthController, routes/health.ts, app.ts, vitest.config.ts, setup.ts, tsconfig.eslint.json
- Step 5/6 Test Batching/Execution: COMPLETE (2026-05-16) — 5/5 tests pass
- Step 7 Integration Verification: COMPLETE (2026-05-16) — tests PASS, typecheck PASS, lint PASS, build PASS
- Step 8 Code Reviewer: COMPLETE (2026-05-16) — APPROVED WITH NOTES; REC-1 through REC-4 applied (async/await, config module, safe error response, setup.ts)
- Step 9 Documentation: COMPLETE (2026-05-16) — No new library choices; Phase 7 will fill systemPatterns Testing Patterns
- Step 10 Update Memory Bank: COMPLETE (2026-05-16) — Phase 2 marked complete, progress.md updated, tasks.md updated

### Sub-Agents
- Git Setup Agent: COMPLETE, Agent ID: ae59a1d1465d1f9e2

### Resumption Notes
**Can Resume**: YES
**Resume From**: Step 3 Test Writer

### Completed Steps
- Step 0: FEAT-001 resolved → TASK-001 auto-provisioned
- Step 0.1: Task file + registry created, roadmap linked
- Step 3: Spec Writer Agent (Opus) — COMPLETE
- Step 3.2: Specification approved by human
- Step 4: Codebase analysis — greenfield confirmed, patterns from systemPatterns.md + techContext.md
- Step 5: Implementation plan written — 7 phases, 15–18 tests, 9 creative decisions documented
- Step 6: Validation gate passed — all MUST criteria concrete and measurable
- Planning COMPLETE — 2026-05-16
- Architecture Design Creative: COMPLETE (2026-05-16) — Output: memory-bank/creative/TASK-001-project-foundation-architecture.md
