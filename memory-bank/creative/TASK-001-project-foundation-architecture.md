# Architecture Decision: BanyanBoard Project Foundation

**Created**: 2026-05-16
**Status**: DECIDED
**Decision Type**: Architecture
**Task**: TASK-001 (FEAT-001 Project Foundation)
**Complexity**: Level 4 — Foundation for all future features

---

## Context

### System Requirements

- Greenfield TypeScript backend skeleton for a self-hosted Kanban app (BanyanBoard)
- Express 4.x + Node 20 LTS, TypeScript 5.x with strict mode
- PostgreSQL 15 reachable from the backend via Docker Compose
- Layered architecture: **controllers -> services -> repositories** with `GET /health` as the worked vertical slice
- Integration tests (real HTTP via supertest, real PostgreSQL via Docker) for the health and DB-connectivity slices
- ESLint + Prettier enforcing: no `any`, no `console.log`, no `pg`/ORM imports in `controllers/`
- Structured logger abstraction (Logger interface + at least one implementation) with `LOG_LEVEL` / `LOG_FORMAT` env wiring
- Root `README.md` documenting the three-command quickstart
- Resolve **9 blocking architectural decisions** so `/banyan-build TASK-001` can proceed without ambiguity

### Technical Constraints

- **Self-hosted only** — Docker Compose, no Kubernetes, no managed cloud services in MVP
- **No premature abstractions** (systemPatterns Guiding Principle) — readability over cleverness
- **Layered (not feature-folder) architecture** is explicit in systemPatterns.md and AC-VERIFY-3
- **12-Factor config** — all environment-specific values via `process.env`, fail fast on missing required vars
- **TypeScript strict mode** end-to-end: `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `noFallthroughCasesInSwitch`
- **No `console.log` in `backend/src/**`** — lint-enforced
- Frontend already uses Vite — backend may follow for consistency, but is not required to
- Team is 2-15 people per deployment; backend traffic is modest, p95 < 200ms for all endpoints, < 50ms for `/health`

### Non-Functional Requirements (from productBrief)

- **Performance**: API p95 < 200ms; `/health` < 50ms; cold-start container < 10s
- **Scalability**: 2-50 users per deployment; single-instance backend is fine; no horizontal-scale design needed in MVP
- **Security**: Credentials only via env vars; `.env` gitignored; no plaintext secrets in compose
- **Availability**: Docker healthchecks must enable auto-restart of unhealthy backends; PostgreSQL `depends_on` with `condition: service_healthy`
- **Observability**: Structured JSON logging, request correlation IDs, OpenTelemetry-compatible Logger abstraction (full SDK wiring deferred)
- **Maintainability**: 2-15 person teams contribute; the directory layout and tooling must be familiar to any Node.js developer who has used Express before

### Guiding Principles to Respect

| Principle | Source | Applied as |
|-----------|--------|-----------|
| Clean Architecture (controllers -> services -> repositories) | systemPatterns | Mandatory; health-check is the worked example |
| Simplicity over Cleverness | systemPatterns | Drives ORM choice (raw `pg` over Prisma), layering enforcement (eslint-plugin-import) |
| No Premature Abstractions | systemPatterns | Logger interface kept thin; OTel exporters deferred |
| 12-Factor Config | systemPatterns | All config from env; fail fast on missing required vars |
| OpenTelemetry First | CLAUDE.md / observability-requirements | `Logger` interface designed to accept `traceId`/`spanId`; correlation middleware in place |
| No `console.log` in production | observability-requirements | Lint rule + structured Logger |

---

## Component Analysis

### Core Components

| Component | Purpose | Responsibilities |
|-----------|---------|------------------|
| `src/index.ts` | Process entry point | Load env, validate config (fail fast), start HTTP server, register shutdown hooks |
| `src/app.ts` | Express application factory | Compose middleware stack, mount routes, no `listen()` call (kept testable) |
| `src/config/env.ts` | Environment config loader | Read `process.env`, validate required vars, expose typed `config` object |
| `src/config/db.ts` | PostgreSQL pool factory | Create `pg.Pool` using env config; export `pool` + `checkDatabaseConnection()` |
| `src/config/logger.ts` | Logger factory | Create pino instance honouring `LOG_LEVEL` / `LOG_FORMAT`; export root logger |
| `src/types/logger.ts` | `Logger` interface | OTel-compatible abstraction (`trace`/`debug`/`info`/`warn`/`error`/`fatal` + `child()` + `withTraceContext()`) |
| `src/middleware/requestContext.ts` | Per-request correlation | Extract `traceparent` or generate UUID; attach `req.logger` (child of root with `traceId`) |
| `src/middleware/requestLogger.ts` | Access logging | Log method, path, status, duration on every response |
| `src/middleware/errorHandler.ts` | Centralized error handling | Catch unhandled errors, log with `req.logger`, return JSON error envelope |
| `src/routes/health.ts` | Route registration | Mount `GET /health/live` and `GET /health/ready` -> `HealthController` |
| `src/controllers/HealthController.ts` | HTTP adapter | Parse req, call `HealthService`, serialize JSON. **No SQL. No `pg` import.** |
| `src/services/HealthService.ts` | Business logic | `getLiveness()` (process-only) and `getReadiness()` (delegates to `HealthRepository`) |
| `src/repositories/HealthRepository.ts` | Data access | Owns `SELECT 1` query; uses `pg.Pool` from `config/db.ts` |
| `Dockerfile` | Container build | Multi-stage: `deps` (npm ci) -> `build` (tsc) -> `runtime` (node:20-alpine + dist) |
| `docker-compose.yml` | Local orchestration | Services: `db` (postgres:15-alpine), `backend`. Healthchecks, named volume, `.env` file |
| `docker-compose.override.yml` | Dev hot-reload | Bind-mount `./backend`, override `command` to `npx tsx watch src/index.ts` |
| `migrations/` (root of `backend`) | Schema versioning | `node-pg-migrate` runs SQL/JS files; tracked in `pgmigrations` table |

### Component Interactions

```
HTTP Request
   |
   v
[requestContext middleware]  -- attaches req.logger (child w/ traceId)
   |
   v
[requestLogger middleware]   -- start timer
   |
   v
[Express Router: /health]
   |
   v
HealthController.getReadiness(req, res)
   |  - parses req (none needed)
   |  - calls HealthService.getReadiness()
   v
HealthService.getReadiness()
   |  - calls HealthRepository.ping()
   v
HealthRepository.ping()
   |  - pool.query('SELECT 1')
   v
[PostgreSQL]
   |
   v (return path)
JSON { status: 'ok', dbStatus: 'ok', uptime, version }
   |
   v
[requestLogger middleware]   -- emits access log w/ duration
   |
   v
HTTP Response
```

**Key invariant (enforced by ESLint via `no-restricted-imports`):**
- `src/controllers/**` MAY NOT import from `pg`, `src/repositories/**`, or any DB client
- `src/services/**` MAY import repositories but NOT `pg` directly
- Only `src/repositories/**` and `src/config/db.ts` may import `pg`

---

## Options Explored

The 9 blocking decisions naturally cluster into 4 design-coherent groups. Exploring "every dimension independently" would inflate this document without changing the answers — the groupings below match how each decision actually interacts with the others.

### Group A: Data Access (Decisions 1 & 2 — ORM + Migration tool)

#### Option A1: Raw `pg` + `node-pg-migrate`

- **Description**: Use the official `pg` driver directly, hand-written parameterized SQL inside `Repository` classes. `node-pg-migrate` for schema migrations (SQL or JS files, up/down).
- **Components**: `pg.Pool` in `config/db.ts`; one repository class per entity; migrations in `backend/migrations/`.
- **Pros**:
  - Maximum simplicity — zero abstraction layers between the team and the database
  - No code generation, no compile-time schema sync step
  - Smallest dependency surface (`pg` + `node-pg-migrate` are ~5 transitive deps)
  - Aligns precisely with systemPatterns "Simplicity over Cleverness" and "No Premature Abstractions"
  - Repository pattern is the only abstraction — already mandated by systemPatterns
  - SQL skills are universal; any new contributor can read it
  - Migration tool is decoupled from the ORM — no risk of "Prisma generate" footguns
- **Cons**:
  - No automatic type-safety on query results — repositories must hand-roll TypeScript types and trust their SQL
  - More boilerplate per entity than Prisma's `prisma.card.findMany()`
- **Technical Fit**: **High** — matches the productBrief "favor readability" note and systemPatterns Repository Pattern
- **Complexity**: **Low**
- **Scalability**: **High** — `pg` is the universally-used Node Postgres driver, used in production at every scale

#### Option A2: Prisma + Prisma Migrate

- **Description**: Prisma ORM with declarative schema (`schema.prisma`), generated client, integrated migrations.
- **Components**: `prisma/schema.prisma`, generated `@prisma/client`, repositories wrap `prisma` client calls.
- **Pros**:
  - End-to-end type safety on queries
  - Migrations and schema are co-located
  - Excellent developer ergonomics for simple CRUD
- **Cons**:
  - Heavy: ~70MB install footprint, native engine binary, multi-platform tarballs
  - Generated client must be kept in sync via a build step (`prisma generate`) — adds Docker build complexity
  - Hides SQL — debugging slow queries requires Prisma-specific tooling
  - Re-introduces the abstraction layer systemPatterns explicitly tells us to avoid
  - Repository pattern becomes redundant with Prisma's own client API — encouraging short-circuits ("just call prisma in the controller")
- **Technical Fit**: **Low** — explicitly conflicts with "No Premature Abstractions" and "Simplicity over Cleverness"
- **Complexity**: **Medium-High**
- **Scalability**: **High** (but most of the scalability claims are not relevant to BanyanBoard's 2-50 user target)

#### Option A3: Kysely + `kysely-migrate` (or `node-pg-migrate`)

- **Description**: Kysely is a typed query builder — TypeScript-first, no code generation, sits on top of `pg`.
- **Components**: `pg.Pool` underneath, `Kysely` instance exposing typed query DSL, hand-authored types in `src/types/database.ts` (or generated via `kysely-codegen`).
- **Pros**:
  - Type-safe like Prisma but without code generation step (if types are hand-authored)
  - Lightweight; sits on top of `pg`
  - SQL semantics are transparent
- **Cons**:
  - Adds a DSL the team must learn (`db.selectFrom('cards').where(...).execute()`)
  - For BanyanBoard's tiny query surface (boards, columns, cards, users) the type-safety win is marginal
  - One more dependency vs. raw `pg`
- **Technical Fit**: **Medium** — better than Prisma but still an abstraction we don't yet need
- **Complexity**: **Medium**
- **Scalability**: **High**

#### Option A4: Drizzle ORM + Drizzle-kit migrations

- **Description**: Drizzle is a TypeScript-first SQL-like ORM with schema-as-code.
- **Pros**: Lightweight, edge-runtime friendly, decent ergonomics.
- **Cons**: Newer ecosystem, schema-as-code is yet another DSL to learn, less battle-tested than `pg` or Prisma for traditional Node.js deployments. Adds an abstraction we cannot yet justify with 3+ concrete cases.
- **Technical Fit**: **Low-Medium**
- **Complexity**: **Medium**

**Group A Decision**: **Option A1 — Raw `pg` + `node-pg-migrate`**

This is the only option that fully honors the systemPatterns Guiding Principles. The Repository pattern (already mandated) is the abstraction; adding an ORM on top is a premature abstraction at the foundation phase. We can revisit if and only if 3+ repositories develop genuinely complex query patterns.

---

### Group B: Test Framework (Decision 3)

#### Option B1: Vitest

- **Description**: Vite-native test runner with Jest-compatible API.
- **Pros**:
  - Frontend already uses Vite — same test runner across the monorepo reduces context switching
  - ESM-native (Node 20 has full ESM support)
  - Significantly faster than Jest for typical Node test suites (<10 test files we care about)
  - Built-in TypeScript support without `ts-jest` or `babel-jest` configuration
  - `vitest run` is CI-friendly; `vitest --watch` for dev
  - Compatible with `supertest` (which is HTTP-runner-agnostic)
- **Cons**:
  - Slightly smaller ecosystem than Jest for niche plugins (none of which we need at the foundation phase)
  - Some Jest-targeted documentation requires translation

#### Option B2: Jest

- **Description**: The incumbent Node.js test framework.
- **Pros**: Largest ecosystem; near-universal Node.js familiarity.
- **Cons**:
  - Requires `ts-jest` or `babel-jest` — additional configuration in a strict-mode TS project
  - Slower than Vitest, particularly on cold start
  - ESM support in Jest still has rough edges (experimental flags); pure CJS mode means the backend can't use top-level await or modern ESM-only deps

**Group B Decision**: **Option B1 — Vitest**

Reasons:
1. **Toolchain consistency** with the frontend's Vite is a tangible NFR (productBrief: "favor readability" extends to "favor a consistent toolchain for a small team").
2. **Zero TypeScript config overhead** — Vitest reads `tsconfig.json` natively. Jest needs `ts-jest` plus its own preset.
3. **Performance** — for a 15-18 test suite that includes one real-Postgres integration test, Vitest's parallel workers + esbuild transform shave seconds off every dev iteration.
4. The Jest ecosystem advantage is irrelevant at the foundation phase. We use `supertest` for HTTP and the `pg` driver for DB — both work identically under Vitest.

---

### Group C: Observability — Logger + Layering Enforcement + Healthcheck Contract + Directory Layout (Decisions 4, 5, 6, 7, 9)

These five decisions are deeply interdependent: the directory layout determines what the layering enforcement targets; the healthcheck contract determines whether the logger needs DB-aware context; the observability scope determines what the Logger interface must abstract.

#### Logger (Decision 4)

#### Option C1: `pino` behind a project-local `Logger` interface

- **Description**: `pino` is the fastest JSON logger in the Node ecosystem. We define our own `Logger` interface in `src/types/logger.ts` and expose a `createLogger()` factory wrapping pino. The interface accepts `traceId`/`spanId` via `child()` and `withTraceContext()` so swapping in OTel SDK logs later is a non-event.
- **Pros**:
  - Production-grade defaults (JSON, async writes, redact patterns, async destination)
  - Mentioned as the recommended Node.js dependency in observability-requirements.md Section 12
  - `pino-http` middleware gives us per-request log instances with trace context for free
  - Interface-first design keeps the door open for direct OTel logs SDK in a future task
- **Cons**:
  - Pretty-printing for dev requires `pino-pretty` (a dev dependency)

#### Option C2: `winston`

- **Description**: Mature, transport-heavy logger.
- **Pros**: Many transports out of the box (file rotation, syslog, etc.).
- **Cons**: Slower than pino. Heavier API. Transports are configuration we don't need for an MVP that ships logs to stdout.

#### Option C3: OpenTelemetry SDK logs directly

- **Description**: Use `@opentelemetry/sdk-logs` end-to-end.
- **Pros**: Aligns 100% with CLAUDE.md's "OpenTelemetry First" directive.
- **Cons**: The OTel logs SDK is GA but the surface area is large for an MVP. Full instrumentation now violates "No Premature Abstractions" — we don't have a collector to point at, and there is no second service to correlate with. The compliance requirement is satisfied by an OTel-compatible Logger **interface**, not by wiring the SDK on day one.

**Logger Decision**: **Option C1 — `pino` + project-local `Logger` interface**

#### Layering Enforcement (Decision 5)

#### Option C4: `eslint-plugin-import` + `no-restricted-imports`

- **Description**: Use ESLint's `no-restricted-imports` rule (built-in) plus `eslint-plugin-import` for module resolution. Configure path-pattern based restrictions in `.eslintrc.cjs` (e.g., `controllers/` may not import `pg` or `../repositories/**`).
- **Pros**:
  - Zero new tooling — ESLint is already in scope
  - Familiar to every TypeScript developer
  - Runs on `npm run lint`; trivially CI-able
  - Easy to extend as more layers are added (e.g., disallow `repositories/` from importing `services/`)
- **Cons**:
  - Configuration uses glob patterns rather than a graph model — slightly less expressive than `eslint-plugin-boundaries`

#### Option C5: `eslint-plugin-boundaries`

- **Description**: Declares "element types" (controller / service / repository) and allowed/disallowed inter-type edges.
- **Pros**: Most expressive for layering rules.
- **Cons**: Extra plugin, extra DSL to learn. For three layers and one prohibition (controllers cannot touch pg/repos) this is overkill.

#### Option C6: Custom Vitest test scanning `controllers/**`

- **Description**: A unit test reads each file under `src/controllers/` and asserts no `pg` import / no SQL keyword regex.
- **Pros**: Zero new ESLint config.
- **Cons**: Bespoke; runs only when the test suite runs (not during `lint`); duplicates ESLint's purpose.

**Layering Enforcement Decision**: **Option C4 — `eslint-plugin-import` + `no-restricted-imports`**

Belt-and-braces: we **also** ship a tiny `layering.test.ts` that scans for raw SQL string literals (regex `\b(SELECT|INSERT|UPDATE|DELETE)\b`) in controllers — covers cases where someone constructs SQL via template literal without importing `pg`. This is in the test strategy from TASK-001 anyway. So lint is primary, test is the safety net.

#### Directory Layout (Decision 6)

#### Option C7: Type-folders (controllers / services / repositories)

```
backend/src/
  app.ts
  index.ts
  config/        env.ts, db.ts, logger.ts
  middleware/    requestContext.ts, requestLogger.ts, errorHandler.ts
  routes/        health.ts, index.ts
  controllers/   HealthController.ts
  services/      HealthService.ts
  repositories/  HealthRepository.ts
  types/         logger.ts, http.ts
  __tests__/     health.test.ts, db.test.ts, logger.test.ts, layering.test.ts
```

- **Pros**:
  - Matches the systemPatterns diagram and AC-VERIFY-3 wording verbatim
  - Lint rules and structural tests target `controllers/**` precisely — a single glob per layer
  - Friction for adding a new layer (e.g., `policies/`) is one directory + one ESLint glob
- **Cons**:
  - Navigating a feature requires opening three directories. For BanyanBoard's small feature surface (boards, columns, cards, users) this is fine.

#### Option C8: Feature-folders (features/health/{controller,service,repository})

- **Pros**: Co-locates everything for one feature.
- **Cons**:
  - Layering enforcement becomes per-feature glob enumeration (`features/*/controller/**`) — fragile
  - Contradicts the systemPatterns "Repository Layer — one repository per domain entity" wording, which implies a flat repository directory
  - Higher cognitive load to remember "the X feature has a Y subfolder pattern"

**Directory Layout Decision**: **Option C7 — Type-folders**

#### Healthcheck Contract (Decision 7)

#### Option C9: Two endpoints — `/health/live` (liveness) and `/health/ready` (readiness)

- **Description**:
  - `GET /health/live` returns `200 { status: 'ok', uptime, version }` based on process state only. **No DB query.** Used by Docker's container healthcheck (no dependency on Postgres being up at the moment of probe).
  - `GET /health/ready` returns `200 { status: 'ok', dbStatus: 'ok' }` after a `SELECT 1` round-trip; returns `503 { status: 'degraded', dbStatus: 'down' }` if the DB is unreachable. Used by future load balancers / orchestrators to gate traffic.
- **Pros**:
  - Liveness is independent of dependencies — a Postgres outage does not cause Docker to nuke the backend container (which would make recovery harder)
  - Readiness gives operators a single endpoint to confirm the stack is fully wired
  - Aligns with Kubernetes / industry conventions even though MVP is Compose — costs zero now, valuable later
  - AC-VERIFY-1 accepts `{"status":"ok"}` plus additional fields — both endpoints satisfy it
- **Cons**:
  - Two endpoints instead of one (~20 extra lines of code)

#### Option C10: Single `/health` endpoint with DB rollup

- **Pros**: One endpoint to remember.
- **Cons**: Conflates liveness with readiness. If Postgres flakes, Docker restarts the backend container — slower recovery than just letting the LB stop routing traffic.

**Healthcheck Decision**: **Option C9 — `/health/live` + `/health/ready`**

The Docker Compose `backend.healthcheck` will probe `/health/live`. The `/health/ready` endpoint is what integration tests and operators use.

#### Observability MVP Scope (Decision 9)

#### Option C11: Logger interface + request correlation middleware (no OTel SDK wiring yet)

- **Description**:
  - `Logger` interface (`trace`/`debug`/`info`/`warn`/`error`/`fatal` + `child()` + `withTraceContext()`) defined in `src/types/logger.ts`
  - `pino` implementation in `src/config/logger.ts`
  - `requestContext` middleware reads `traceparent` header (W3C format) if present; otherwise generates a UUIDv4 as the trace ID. Attaches a child logger to `req.logger` with `traceId` baked in.
  - `requestLogger` middleware emits one access log per response with method, path, status, duration_ms, traceId.
  - All log lines from anywhere in the app include `traceId` whenever the call passes through a request handler.
  - **NOT YET**: OpenTelemetry tracer SDK, exporters, collectors. The Logger interface is OTel-shaped so swapping the implementation later is mechanical.
- **Pros**:
  - Satisfies the observability-requirements "structured JSON logging with trace correlation" core requirement
  - Satisfies AC-VERIFY-7 (SHOULD-priority)
  - Aligns with "No Premature Abstractions" — we don't ship a tracer until there's a second service to trace into
  - Honest about the deferral — productBrief explicitly defers full OTel wiring
- **Cons**: We will have to do real OTel SDK work in a future task. (This was always going to be true.)

#### Option C12: Full OpenTelemetry SDK with stdout exporter

- **Pros**: 100% compliant with CLAUDE.md "OpenTelemetry First" directive on day one.
- **Cons**: Adds ~12 OTel packages, an SDK initialization file, sampler config, exporter config, and ~200 lines of bootstrap code — for a single service with no downstream services to propagate context to. Premature abstraction.

#### Option C13: Logger interface only (no request correlation)

- **Cons**: Fails AC-VERIFY-7 and observability-requirements §2.1 ("MANDATORY: Every operation MUST have a unique, persistent transaction ID"). Non-starter.

**Observability MVP Scope Decision**: **Option C11 — Logger interface + request correlation middleware**

---

### Group D: Dockerfile Strategy (Decision 8)

#### Option D1: Multi-stage Dockerfile + `docker-compose.override.yml` for dev hot-reload

- **Description**:
  - `Dockerfile` has three stages:
    1. `deps` — `node:20-alpine`, `npm ci` (cached layer)
    2. `build` — copies source, runs `tsc`, outputs `dist/`
    3. `runtime` — `node:20-alpine`, copies `dist/` + production `node_modules`, runs `node dist/index.js`
  - `docker-compose.yml` is the production-shaped definition (uses the `runtime` stage)
  - `docker-compose.override.yml` (auto-loaded by Compose in dev) overrides the backend service to:
    - target the `deps` stage instead of `runtime`
    - bind-mount `./backend` into the container
    - override `command` to `npx tsx watch src/index.ts` for hot reload
- **Pros**:
  - Production parity by default — `docker compose up` (without the override on a CI server) yields a slim production image
  - Hot reload is opt-in via the override file (auto-applied locally, not pushed to prod)
  - Final image is small (`node:20-alpine` + `dist/` + prod deps only) — fast cold starts (AC-VERIFY-6 requires < 10s)
  - Standard pattern; well-understood by Node.js developers
- **Cons**:
  - Two Compose files instead of one — slightly more cognitive surface
  - The override file must be documented in the README

#### Option D2: Single-stage Dockerfile, dev container = prod container

- **Pros**: One file, one image.
- **Cons**:
  - Either you ship dev tools (tsx, ts-node, eslint) to production — bloated image and unnecessary attack surface
  - Or you ship only `dist/` and lose hot-reload — bad dev loop

**Dockerfile Decision**: **Option D1 — Multi-stage + Compose override**

---

## Evaluation Matrix

Scoring across the **integrated** option set (A1 + B1 + C1/C4/C7/C9/C11 + D1) vs. the most plausible alternative integrated set (A2 Prisma + B2 Jest + C2 winston + C5 boundaries + C8 feature-folders + C10 single-health + C12 full-OTel + D2 single-stage) and a "middle path" (A1 + B1 + C2 + C5 + C7 + C9 + C11 + D1):

| Criteria | Chosen (A1+B1+C1/4/7/9/11+D1) | Heavy alt (A2+B2+C2+C5+C8+C10+C12+D2) | Middle path |
|----------|------:|------:|------:|
| Scalability | High | High | High |
| Maintainability | **High** | Low | Medium |
| Performance (build + runtime) | **High** | Medium | High |
| Security | High | High | High |
| Observability | High | **Very High** | High |
| Implementation cost | **Low** | High | Medium |
| Alignment with systemPatterns Guiding Principles | **Very High** | Low | Medium |
| Time to first `/banyan-build` green | **Low (fast)** | High (slow) | Medium |
| Risk of regret in 3 months | **Low** | Medium-High | Low |

The chosen set wins on every criterion that systemPatterns and productBrief privilege: maintainability, alignment with guiding principles, implementation cost, and time-to-green. We give up an incremental observability advantage from full OTel wiring — and we accept that trade-off because we have no downstream service to trace into yet.

---

## Observability Architecture

### Logging

- **Library**: `pino` (concrete) behind a project-local `Logger` interface (abstract)
- **Format**: Structured JSON in production (`LOG_FORMAT=json`); `pino-pretty` for human-readable dev output (`LOG_FORMAT=text`)
- **Required fields** on every log line: `timestamp` (ISO 8601, auto by pino), `level`, `msg` (we will name our interface method param `message` but pino writes `msg`), `service`, `version`, `environment`, plus `traceId`/`spanId` when in request context
- **Configuration env vars**:
  - `LOG_LEVEL` — trace|debug|info|warn|error|fatal (default `info` in prod, `debug` in dev)
  - `LOG_FORMAT` — json|text (default `json` in prod, `text` in dev)
  - `LOG_OUTPUT` — stdout (only supported value in MVP; reserve env var for future file/both)
  - `LOG_REDACT_PATTERNS` — comma-separated field names to redact (default: `password,secret,token,apiKey,authorization`)
- **Redaction**: pino's built-in `redact` option configured from `LOG_REDACT_PATTERNS`
- **Never logged**: passwords, tokens, full auth headers, raw `.env` contents
- **`console.log` policy**: ESLint `no-console: error` rule in `src/**` (warnings permitted in test fixtures only)

### Distributed Tracing (MVP scope)

- **SDK in MVP**: **None** — only the abstraction
- **Propagation**: `requestContext` middleware reads `traceparent` header (W3C Trace Context format `00-<trace-id>-<span-id>-<flags>`). If absent, generates a `traceId` (UUIDv4 stripped of dashes) and a `spanId` (random 8-byte hex). Sets these on `req.traceContext` and creates `req.logger = logger.withTraceContext(req.traceContext)`.
- **Outgoing requests**: Not applicable in MVP — backend has no outbound HTTP calls. Pattern documented for future use (inject `traceparent` into outgoing headers).
- **Service boundaries**:

  | From | To | Protocol | Propagation Method |
  |------|-----|----------|-------------------|
  | Frontend (future) | Backend | HTTP | `traceparent` header (extracted in `requestContext`) |
  | Backend | PostgreSQL | TCP/SQL | N/A (single-process, single-DB; `pg` driver does not currently propagate trace context — `db.statement` attribute will be added when OTel SDK is wired) |

- **Sampling**: N/A in MVP (no tracer). When OTel SDK is wired in a future task: `OTEL_TRACES_SAMPLER_ARG=1.0` in dev, `0.1` (or env-tuned) in prod.
- **Deferred wiring** (post-MVP task, separate feature): `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, OTLP HTTP exporter, collector configuration.

### Metrics

- **MVP scope**: Out of scope for the foundation. To be added when real endpoints (boards/cards/users) ship.
- **Planned standard metrics** (documented for the next feature):
  - `http_requests_total{method, route, status_code}` (Counter)
  - `http_request_duration_seconds{method, route}` (Histogram)
- **Planned business metrics**: e.g., `boards_created_total`, `cards_moved_total` — added per-feature

### Configuration Variables

| Variable | Purpose | Default (dev) | Default (prod) | Required? |
|----------|---------|---------------|----------------|-----------|
| `NODE_ENV` | Deployment environment | `development` | `production` | Yes (defaulted) |
| `PORT` | HTTP listen port | `3001` | `3001` | No |
| `SERVICE_NAME` | Service identifier in logs | `banyanboard-backend` | `banyanboard-backend` | No |
| `SERVICE_VERSION` | Version string in logs | from `package.json` | from `package.json` | No |
| `LOG_LEVEL` | Log verbosity | `debug` | `info` | No |
| `LOG_FORMAT` | Output format | `text` | `json` | No |
| `LOG_OUTPUT` | Destination | `stdout` | `stdout` | No |
| `LOG_REDACT_PATTERNS` | CSV of fields to redact | `password,secret,token,apiKey,authorization` | same | No |
| `DATABASE_URL` | Postgres connection string | from `.env` | from secrets manager | **Yes — fail fast** |
| `PG_POOL_MAX` | Max pool size | `10` | `20` | No |
| `PG_POOL_IDLE_TIMEOUT_MS` | Idle connection timeout | `30000` | `30000` | No |

The startup validator in `config/env.ts` throws `ConfigurationError` if `DATABASE_URL` is missing or empty. No silent fallback.

---

## Decision Summary

This is the consolidated table `/banyan-build` will reference for all 9 blocking decisions.

| # | Decision | Chosen Answer | Rationale (one line) |
|---|----------|---------------|----------------------|
| 1 | ORM / DB client | **Raw `pg` driver** (node-postgres) | Repository pattern is the only abstraction needed; ORM violates "No Premature Abstractions" |
| 2 | Migration tool | **`node-pg-migrate`** | Decoupled from any ORM choice; SQL or JS files; pure-Node, no JVM |
| 3 | Test framework | **Vitest** | Toolchain consistency with frontend's Vite; zero TS config overhead; faster than Jest |
| 4 | Logger library | **`pino`** behind a project-local `Logger` interface | Recommended in observability-requirements §12; fast JSON-native; OTel-compatible shape |
| 5 | Layering enforcement | **`eslint-plugin-import` + `no-restricted-imports`** (primary) + a thin Vitest layering test (safety net for raw SQL strings) | Zero new tooling; trivial to extend; test catches what lint can't (template literals) |
| 6 | Directory layout | **Type-folders** (`controllers/`, `services/`, `repositories/`) | Matches systemPatterns diagram + AC-VERIFY-3 wording; single glob per layer for lint rules |
| 7 | Healthcheck contract | **Two endpoints**: `GET /health/live` (process only) and `GET /health/ready` (DB rollup) | Liveness vs readiness separation; Docker probes liveness; integration tests assert both |
| 8 | Dockerfile strategy | **Multi-stage** (`deps` -> `build` -> `runtime`) + **`docker-compose.override.yml`** for dev hot-reload | Production parity by default; hot reload opt-in via override; slim runtime image |
| 9 | Observability MVP scope | **Logger interface + request correlation middleware** (no OTel SDK wiring yet) | OTel-shaped abstraction satisfies CLAUDE.md compliance; full SDK is premature with one service |

### Rationale (consolidated)

The architecture optimises for **time-to-first-feature** and **alignment with the systemPatterns Guiding Principles**, both of which the productBrief and TASK-001 spec privilege. Every chosen option:

1. Honors **Simplicity over Cleverness** — raw `pg`, type-folders, ESLint over custom plugins, pino over winston
2. Honors **No Premature Abstractions** — no ORM, no OTel SDK on day one, no feature-folder layout for a small surface
3. Honors **12-Factor Config** — `config/env.ts` validates and fails fast; all env vars documented in `.env.example`
4. Honors **Clean Architecture** — type-folder layout makes the layering rules trivially expressible
5. Honors **Observability First** — Logger interface is OTel-shaped; correlation middleware is in place day one

### Trade-offs Accepted

- **No compile-time SQL type-safety** in repositories — we hand-write TypeScript types for query results. Accepted because (a) the query surface is tiny in MVP, (b) Repository pattern isolates this risk to a small set of files, (c) we can introduce Kysely later without rewriting controllers or services.
- **Two Compose files** (base + override) — accepted because production parity in the base file is more important than file count.
- **Vitest learning curve for Jest users** — minimal in practice (APIs are 95% compatible); offset by zero TypeScript-config friction.
- **No OTel tracer SDK in MVP** — accepted explicitly per productBrief and the Level 4 observability note in CLAUDE.md. The Logger interface is OTel-compatible so the future migration is mechanical.
- **`pino-pretty` is a dev-only dependency** — minor; documented in README.

---

## Implementation Guide

This guide is the source of truth for `/banyan-build TASK-001`. Each phase is independently verifiable; phases are sequenced so each one is testable in isolation. All paths are relative to the repository root (`C:\git\banyanboard`).

### Phase 1: TypeScript backend scaffolding + ESLint

**Goal**: Compilable Express + TypeScript skeleton with strict mode, lint, and prettier — no runtime tests yet.

**Files to create**:

1. `backend/package.json`
   - Scripts:
     - `dev`: `tsx watch src/index.ts`
     - `build`: `tsc -p tsconfig.json`
     - `start`: `node dist/index.js`
     - `test`: `vitest run`
     - `test:watch`: `vitest`
     - `lint`: `eslint "src/**/*.ts"`
     - `lint:fix`: `eslint "src/**/*.ts" --fix`
     - `typecheck`: `tsc --noEmit`
     - `format`: `prettier --write "src/**/*.{ts,json,md}"`
     - `migrate`: `node-pg-migrate up`
     - `migrate:down`: `node-pg-migrate down`
   - Dependencies: `express@^4`, `pg@^8`, `pino@^9`, `pino-http@^10`, `dotenv@^16`
   - DevDependencies: `typescript@^5`, `@types/node@^20`, `@types/express@^4`, `@types/pg@^8`, `tsx@^4`, `vitest@^2`, `supertest@^7`, `@types/supertest@^6`, `eslint@^9`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `prettier@^3`, `pino-pretty@^11`, `node-pg-migrate@^7`

2. `backend/tsconfig.json`
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "lib": ["ES2022"],
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "noUncheckedIndexedAccess": true,
       "noImplicitOverride": true,
       "noFallthroughCasesInSwitch": true,
       "noImplicitReturns": true,
       "esModuleInterop": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "declaration": false,
       "sourceMap": true,
       "skipLibCheck": true
     },
     "include": ["src/**/*.ts"],
     "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
   }
   ```

3. `backend/.eslintrc.cjs`
   - Parser: `@typescript-eslint/parser`, `project: ./tsconfig.json`
   - Plugins: `@typescript-eslint`, `import`
   - Rules:
     - `@typescript-eslint/no-explicit-any`: `error`
     - `@typescript-eslint/no-floating-promises`: `error`
     - `no-console`: `error`
     - `no-restricted-imports` (the layering rule — full config below in Phase 6)
     - `import/no-restricted-paths`: configured in Phase 6
   - `overrides` for `src/**/*.test.ts`: relax `no-console` to `off`

4. `backend/.prettierrc.json` — standard config (single quotes, trailing commas, 100-char line length)

5. `backend/.eslintignore` — `dist`, `node_modules`, `coverage`

6. `backend/.gitignore` — `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `coverage`

7. `backend/.env.example`
   ```
   # === Required ===
   DATABASE_URL=postgres://banyan:changeme@localhost:5432/banyanboard

   # === Optional (defaults shown) ===
   NODE_ENV=development
   PORT=3001
   SERVICE_NAME=banyanboard-backend
   SERVICE_VERSION=0.1.0

   LOG_LEVEL=debug
   LOG_FORMAT=text
   LOG_OUTPUT=stdout
   LOG_REDACT_PATTERNS=password,secret,token,apiKey,authorization

   PG_POOL_MAX=10
   PG_POOL_IDLE_TIMEOUT_MS=30000
   ```

8. **Directory skeleton** (each as empty `.gitkeep` for now where no file is created in this phase):
   ```
   backend/src/
     app.ts                          (Phase 1)
     index.ts                        (Phase 1)
     config/env.ts                   (Phase 1)
     config/db.ts                    (Phase 4)
     config/logger.ts                (Phase 5)
     middleware/.gitkeep             (filled in Phase 5)
     routes/.gitkeep                 (filled in Phase 2)
     controllers/.gitkeep            (filled in Phase 2)
     services/.gitkeep               (filled in Phase 2)
     repositories/.gitkeep           (filled in Phase 2)
     types/logger.ts                 (Phase 5)
     __tests__/.gitkeep              (filled in Phases 2-6)
   ```

9. `backend/src/config/env.ts`
   - Loads `dotenv` if `NODE_ENV !== 'production'`
   - Validates required vars (`DATABASE_URL`), throws `ConfigurationError` with a clear message on missing
   - Exports a frozen `config` object with typed accessors
   - Has a `getConfig()` factory for testability (so tests can inject overrides)

10. `backend/src/app.ts`
    - `createApp(deps)` factory returning an Express `app`
    - At Phase 1 it only registers a placeholder middleware chain; routes added in Phase 2
    - No `app.listen()` — keeps it testable

11. `backend/src/index.ts`
    - Loads config (fail-fast)
    - Constructs the app
    - `app.listen(config.port)`
    - Registers `SIGTERM` / `SIGINT` graceful shutdown

**Verification (no Bash chaining):**
- `npm install --prefix backend` exits 0
- `npm run typecheck --prefix backend` exits 0
- `npm run lint --prefix backend` exits 0
- `npm run build --prefix backend` exits 0 and produces `backend/dist/index.js`

---

### Phase 2: Health check vertical slice

**Goal**: `GET /health/live` and `GET /health/ready` working through Controller -> Service -> (stub) Repository, with 5 Vitest integration tests passing.

**Files to create**:

1. `backend/src/services/HealthService.ts`
   ```ts
   export interface HealthService {
     getLiveness(): { status: 'ok'; uptime: number; version: string };
     getReadiness(): Promise<{ status: 'ok' | 'degraded'; dbStatus: 'ok' | 'down' }>;
   }
   ```
   - `getLiveness()` returns process state only (uses `process.uptime()` and `config.serviceVersion`)
   - `getReadiness()` calls `HealthRepository.ping()` and maps result to `dbStatus`. In Phase 2 the repository returns a stub `true`; Phase 4 wires the real DB.

2. `backend/src/repositories/HealthRepository.ts`
   - Phase 2 stub: `async ping(): Promise<boolean> { return true; }`
   - Phase 4 replaces with `await this.pool.query('SELECT 1')`

3. `backend/src/controllers/HealthController.ts`
   - `getLiveness(req, res)` -> `res.status(200).json(healthService.getLiveness())`
   - `getReadiness(req, res)` -> `const result = await healthService.getReadiness(); res.status(result.status === 'ok' ? 200 : 503).json(result);`
   - **No `pg` import, no SQL, no business logic**

4. `backend/src/routes/health.ts`
   - `router.get('/live', controller.getLiveness)`
   - `router.get('/ready', controller.getReadiness)`
   - Mounted at `/health` in `app.ts`

5. `backend/src/app.ts` (updated)
   - Mounts `/health` routes
   - Adds `express.json()` body parser
   - Adds 404 handler

6. `backend/src/__tests__/health.test.ts` — Vitest + supertest (5 tests)
   - `GET /health/live` returns 200 + JSON `{ status: 'ok', uptime: number, version: string }`
   - `GET /health/live` Content-Type is `application/json`
   - `GET /health/ready` returns 200 + JSON `{ status: 'ok', dbStatus: 'ok' }` (with the stub repository)
   - `POST /health/live` returns 404 (no body parser needed, Express returns 404 for undefined method+path)
   - `GET /health/live` p95 latency assertion: 10 requests in a loop, max < 50ms

7. `vitest.config.ts` at `backend/vitest.config.ts`
   - `test.include`: `['src/**/*.test.ts']`
   - `test.environment`: `'node'`
   - `test.testTimeout`: 30000

**Verification:**
- `npm test --prefix backend` exits 0 with 5 passing tests
- `npm run typecheck --prefix backend` exits 0
- `npm run lint --prefix backend` exits 0

---

### Phase 3: Docker Compose + PostgreSQL service

**Goal**: `docker compose up -d` brings up `db` + `backend`, both healthy, `/health/live` reachable from host on `localhost:3001`.

**Files to create**:

1. `backend/Dockerfile` (multi-stage)
   ```dockerfile
   # Stage 1: deps
   FROM node:20-alpine AS deps
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci

   # Stage 2: build
   FROM node:20-alpine AS build
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY tsconfig.json ./
   COPY src ./src
   RUN npx tsc -p tsconfig.json

   # Stage 3: runtime
   FROM node:20-alpine AS runtime
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package.json package-lock.json ./
   RUN npm ci --omit=dev && npm cache clean --force
   COPY --from=build /app/dist ./dist
   USER node
   EXPOSE 3001
   HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
     CMD wget -qO- http://localhost:3001/health/live || exit 1
   CMD ["node", "dist/index.js"]
   ```

2. `backend/.dockerignore` — `node_modules`, `dist`, `.env`, `.env.*`, `coverage`, `.git`

3. `docker-compose.yml` (repository root)
   ```yaml
   services:
     db:
       image: postgres:15-alpine
       environment:
         POSTGRES_USER: ${POSTGRES_USER:-banyan}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
         POSTGRES_DB: ${POSTGRES_DB:-banyanboard}
       volumes:
         - pgdata:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-banyan} -d ${POSTGRES_DB:-banyanboard}"]
         interval: 5s
         timeout: 3s
         retries: 10
         start_period: 5s
       ports:
         - "5432:5432"

     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile
         target: runtime
       env_file:
         - ./backend/.env
       environment:
         DATABASE_URL: postgres://${POSTGRES_USER:-banyan}:${POSTGRES_PASSWORD:-changeme}@db:5432/${POSTGRES_DB:-banyanboard}
       depends_on:
         db:
           condition: service_healthy
       ports:
         - "3001:3001"

   volumes:
     pgdata:
   ```

4. `docker-compose.override.yml` (auto-loaded in dev)
   ```yaml
   services:
     backend:
       build:
         target: deps
       command: npx tsx watch src/index.ts
       volumes:
         - ./backend:/app
         - /app/node_modules
       environment:
         NODE_ENV: development
   ```

5. Root `.env.example`
   ```
   POSTGRES_USER=banyan
   POSTGRES_PASSWORD=changeme
   POSTGRES_DB=banyanboard
   ```

**Verification:**
- `docker compose up -d` reports both services started
- `docker compose ps` shows both `(healthy)` within 30 seconds
- `curl -fsS http://localhost:3001/health/live` returns `200` with JSON body
- `docker compose down` leaves the volume intact; `docker compose down -v` removes it

---

### Phase 4: PostgreSQL client + connectivity integration test

**Goal**: Real `pg.Pool` connected to PostgreSQL, `SELECT 1` works, 4 Vitest integration tests passing.

**Files to create / update**:

1. `backend/src/config/db.ts`
   - Creates `pg.Pool` from `config.databaseUrl`, `config.pgPoolMax`, `config.pgPoolIdleTimeoutMs`
   - Exports `pool: pg.Pool`
   - Exports `checkDatabaseConnection(): Promise<void>` — runs `SELECT 1`, throws on failure
   - Exports `closePool(): Promise<void>` for graceful shutdown

2. `backend/src/repositories/HealthRepository.ts` (updated from Phase 2 stub)
   - Constructor receives `pool: pg.Pool` (or imports the singleton)
   - `async ping(): Promise<boolean>` runs `await pool.query('SELECT 1'); return true;` catches error and returns false

3. `backend/src/index.ts` (updated)
   - At startup, after `app.listen()`, runs `await checkDatabaseConnection()` and logs success/failure
   - On `SIGTERM`/`SIGINT`: close HTTP server, then `closePool()`

4. `backend/src/__tests__/db.test.ts` — Vitest + real Postgres (4 tests)
   - Test 1: `SELECT 1` returns scalar `1`
   - Test 2: `checkDatabaseConnection()` resolves against a real DB
   - Test 3: invalid `DATABASE_URL` causes `checkDatabaseConnection()` to reject with a descriptive error
   - Test 4: pool is properly closed after suite (no hanging handles — Vitest verifies process exits cleanly)

5. `backend/migrations/.gitkeep` — empty migrations directory (real migrations come with FEAT-002)

6. `backend/src/__tests__/setup.ts` — Vitest setup file that ensures `process.env.DATABASE_URL` points at the dev compose Postgres (or a `TEST_DATABASE_URL` if defined). Registered in `vitest.config.ts` `test.setupFiles`.

**Test execution model**:
- Tests run **outside** the backend container (i.e., on the host, `npm test --prefix backend`)
- They connect to PostgreSQL via `localhost:5432` (port-published from compose)
- `docker compose up -d db` must be running before tests
- Documented in README under "Running tests"

**Verification:**
- `docker compose up -d db` brings up Postgres
- `npm test --prefix backend` exits 0 with 9 passing tests (5 health + 4 db)

---

### Phase 5: Observability foundation

**Goal**: Logger interface + pino implementation + request correlation middleware. 4 Vitest tests passing.

**Files to create**:

1. `backend/src/types/logger.ts`
   ```ts
   export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

   export interface LogContext {
     [key: string]: unknown;
   }

   export interface TraceContext {
     traceId: string;
     spanId: string;
   }

   export interface Logger {
     trace(message: string, context?: LogContext): void;
     debug(message: string, context?: LogContext): void;
     info(message: string, context?: LogContext): void;
     warn(message: string, context?: LogContext): void;
     error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
     fatal(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
     child(context: LogContext): Logger;
     withTraceContext(traceContext: TraceContext): Logger;
   }
   ```

2. `backend/src/config/logger.ts`
   - `createLogger(deps: { config }): Logger`
   - Internally uses `pino` with:
     - `level: config.logLevel`
     - `transport`: `pino-pretty` when `config.logFormat === 'text'`, otherwise default JSON
     - `redact`: parsed from `config.logRedactPatterns`
     - `base`: `{ service: config.serviceName, version: config.serviceVersion, environment: config.nodeEnv }`
   - Wraps pino to implement the `Logger` interface (especially `withTraceContext()` which calls `pino.child({ traceId, spanId })`)

3. `backend/src/middleware/requestContext.ts`
   - Reads `req.headers.traceparent` and parses to `{ traceId, spanId }` (W3C format `00-<32hex>-<16hex>-<2hex>`)
   - If absent or malformed, generates a new `traceId` (random 16-byte hex) and `spanId` (random 8-byte hex)
   - Sets `req.traceContext = { traceId, spanId }`
   - Sets `req.logger = rootLogger.withTraceContext(req.traceContext)`
   - Sets `res.setHeader('traceparent', formatTraceparent(req.traceContext))`

4. `backend/src/middleware/requestLogger.ts`
   - On `res` finish event: emits one log line with `method`, `path` (the route pattern, not the raw URL), `statusCode`, `durationMs`
   - Uses `req.logger` so the line includes `traceId`

5. `backend/src/middleware/errorHandler.ts`
   - Catches all errors not handled by route handlers
   - Logs via `req.logger.error('Unhandled error', err, { route: req.path })`
   - Returns JSON `{ error: { message, traceId } }` with appropriate status code

6. `backend/src/app.ts` (updated)
   - Middleware order: `requestContext` -> `requestLogger` -> `express.json()` -> routes -> `errorHandler` (last)

7. Express types extension: `backend/src/types/express.d.ts`
   ```ts
   import { Logger, TraceContext } from './logger';
   declare global {
     namespace Express {
       interface Request {
         logger: Logger;
         traceContext: TraceContext;
       }
     }
   }
   export {};
   ```

8. `backend/src/__tests__/logger.test.ts` — Vitest (4 tests)
   - Test 1: Logger emits JSON when `LOG_FORMAT=json` with required fields `level`, `time`, `msg`, `service`, `version`
   - Test 2: `LOG_LEVEL=warn` causes `info` calls to produce no output
   - Test 3: `withTraceContext({ traceId, spanId })` produces a child logger whose output includes those fields
   - Test 4: redaction — a log call with `{ password: 'secret' }` writes `"password":"[Redacted]"`

**Verification:**
- `npm test --prefix backend` exits 0 with 13 passing tests
- `LOG_FORMAT=json npm run dev --prefix backend` emits JSON to stdout
- A request to `/health/live` produces an access log line with a `traceId` field

---

### Phase 6: Layering enforcement

**Goal**: `controllers/**` cannot import `pg`, cannot import from `repositories/`, cannot contain raw SQL. Verified by lint + a thin Vitest test.

**Files to update**:

1. `backend/.eslintrc.cjs` (extend Phase 1 config)
   ```js
   {
     // ...existing config...
     overrides: [
       {
         files: ['src/controllers/**/*.ts'],
         rules: {
           'no-restricted-imports': ['error', {
             paths: [
               { name: 'pg', message: 'Controllers may not import database drivers. Delegate to a Service which calls a Repository.' },
               { name: '@prisma/client', message: 'Same as above — no DB clients in controllers.' },
               { name: 'kysely', message: 'Same as above — no DB clients in controllers.' }
             ],
             patterns: [
               { group: ['**/repositories/**'], message: 'Controllers may not import from repositories. Call a Service instead.' },
               { group: ['**/config/db'], message: 'Controllers may not import the DB pool. Call a Service instead.' }
             ]
           }]
         }
       },
       {
         files: ['src/services/**/*.ts'],
         rules: {
           'no-restricted-imports': ['error', {
             paths: [
               { name: 'pg', message: 'Services may not import pg directly. Delegate to a Repository.' }
             ],
             patterns: [
               { group: ['**/config/db'], message: 'Services may not import the DB pool. Use a Repository.' }
             ]
           }]
         }
       },
       {
         files: ['src/**/*.test.ts'],
         rules: { 'no-console': 'off' }
       }
     ]
   }
   ```

2. `backend/src/__tests__/layering.test.ts` — Vitest structural test (safety net)
   - Reads all `.ts` files under `src/controllers/`
   - Asserts no file content matches `/\b(SELECT|INSERT|UPDATE|DELETE)\b.*\b(FROM|INTO|WHERE)\b/i` (raw SQL)
   - Asserts no file content contains `import 'pg'` or `from 'pg'`
   - One test per assertion; both pass on the current health controller

**Verification:**
- `npm run lint --prefix backend` exits 0 on the existing controllers
- `npm test --prefix backend` exits 0 with 15 passing tests (5 + 4 + 4 + 2)
- Manual smoke check: temporarily add `import { Pool } from 'pg'` to `HealthController.ts` -> `npm run lint` exits non-zero; revert.

---

### Phase 7: Documentation + memory-bank updates

**Goal**: Root `README.md` has a working three-command quickstart. memory-bank files reflect final choices.

**Files to create / update**:

1. Root `README.md`
   - Title: `BanyanBoard`
   - One-sentence value proposition
   - **Prerequisites**: Docker Desktop (or Docker Engine 24+ with Compose v2), Node 20 LTS (optional, for running tests outside containers)
   - **Quickstart (three commands)**:
     ```bash
     cp backend/.env.example backend/.env
     cp .env.example .env
     docker compose up -d
     ```
     Then `curl http://localhost:3001/health/live` should return `{ "status": "ok", ... }`
   - **Architecture diagram** (ASCII, taken from systemPatterns.md)
   - **Layered architecture rules** — controllers cannot import `pg` etc.
   - **Running tests**: `docker compose up -d db` then `npm test --prefix backend`
   - **Project structure** (the directory tree from Phase 1)
   - **Next steps**: link to `memory-bank/roadmap.md`

2. `memory-bank/techContext.md` (updates by Document sub-agent during build)
   - **Data Layer** — replace "TBD" with: "node-postgres (`pg`) v8 for raw DB access; `node-pg-migrate` for migrations"
   - **Development Tools** — replace test framework TBD with "Vitest 2.x for backend (consistency with frontend Vite)"
   - **Development Tools** — replace lint TBD with "ESLint 9 + Prettier 3 + `@typescript-eslint`; layering enforced via `no-restricted-imports`"
   - Add a row to "Recent Technology Changes" dated 2026-05-16: "Foundation libraries finalized — see TASK-001 architecture decision"

3. `memory-bank/systemPatterns.md` Testing Patterns section
   - **Test location**: `backend/src/__tests__/` for backend; co-located `.test.tsx` for frontend components (per Vitest convention)
   - **File mapping**: One test file per feature (e.g., `health.test.ts`, `db.test.ts`, `logger.test.ts`); one cross-cutting structural test (`layering.test.ts`)
   - **Naming convention**: `<feature>.test.ts`
   - **Framework**: Vitest 2.x for both frontend and backend
   - **Assertion style**: Vitest's built-in `expect` (Jest-compatible)
   - **Mocking approach**: Prefer integration tests over mocks for repositories and controllers (real Postgres via Docker, real HTTP via supertest). Mock only at external integration boundaries (none in MVP).
   - **Emphasis**: Integration-first; unit tests only for stateless helpers (env validation, traceparent parsing)
   - **Typical test-to-source ratio**: ~1:1 for cross-cutting concerns (logger, env, layering); per-feature integration coverage of all acceptance criteria
   - **What is NOT typically tested**: Express routing internals, `pg` driver internals, ESLint rule wiring, Docker healthcheck timing

4. `memory-bank/tasks/TASK-001.md` Execution State — to be updated by `/banyan-build` as phases complete.

**Verification:**
- `memory-bank/techContext.md` no longer contains "TBD" in Data Layer / Development Tools rows for tests/lint/ORM
- `memory-bank/systemPatterns.md` Testing Patterns section no longer contains `[To be defined]`
- A new developer can clone the repo, follow the README quickstart, and reach a healthy `/health/live` in under 10 minutes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Raw `pg` choice means hand-rolled types drift from real schema | Medium | Medium | Repository pattern isolates the risk; an integration test queries every endpoint at least once; revisit Kysely if 3+ repositories diverge |
| Vitest is less familiar than Jest to some Node developers | Low | Low | API is Jest-compatible; document in README |
| `pino-pretty` only loaded in dev — production accidentally enables it | Low | Low | `pino-pretty` is a devDependency; production runtime uses `LOG_FORMAT=json` by default |
| Docker hot-reload friction (Windows bind-mount slowness) | Medium | Medium | `docker-compose.override.yml` uses anonymous volume for `node_modules` to avoid host-OS native module mismatch; documented in README |
| Test runner needs `docker compose up -d db` first — confusing for first-time contributors | Medium | Low | README explicitly documents the dependency; consider a `npm run test:setup` script in a future task |
| `noUncheckedIndexedAccess: true` surprises developers with `T \| undefined` everywhere | Low | Low | Documented in README "Architecture Guardrails"; pattern is well-established in modern TS projects |
| Layering ESLint rule misses raw SQL in template literals | Medium | Low | `layering.test.ts` regex-scans for SQL keywords; belt-and-braces |
| Postgres healthcheck `pg_isready` reports healthy before initial DB init completes | Low | Medium | `start_period: 5s` and `retries: 10` give the init script time; backend's own `checkDatabaseConnection()` retries |
| OTel SDK migration in a future task breaks Logger consumers | Low | Low | `Logger` interface is OTel-shaped; concrete implementation swap is internal to `config/logger.ts` |
| Multi-stage Dockerfile cache invalidation on every code change | Low | Low | `deps` stage cached by `package.json` + `package-lock.json` hash; only `build` rebuilds on src change |

---

## Validation Checklist

- [x] Meets all system requirements (Express + TS strict + Postgres + Docker Compose + health endpoint + integration tests + lint + logger + README)
- [x] Respects all technical constraints (greenfield, self-hosted, layered, 12-Factor, strict TS, no `console.log`, env-driven config)
- [x] Addresses all non-functional requirements (p95 < 200ms via `/health` < 50ms; small-team scale; HTTPS at deployment layer documented as future concern; healthchecks for availability)
- [x] Technically feasible — every chosen library is widely deployed in production Node.js services
- [x] Risks identified and acceptable (table above)
- [x] **Complies with all Guiding Principles in systemPatterns.md**:
  - Clean Architecture: type-folder layout + ESLint enforcement
  - Simplicity over Cleverness: raw `pg` over Prisma, no feature folders, no OTel SDK day one
  - No Premature Abstractions: Logger interface kept minimal; no migration tool other than chosen
  - 12-Factor Config: `config/env.ts` validates and fails fast
  - Optimistic UI: N/A for backend foundation
- [x] **Respects established patterns in systemPatterns.md**: Repository Pattern, Service Layer, layered architecture diagram
- [x] Observability architecture defined (logger + correlation middleware; OTel deferral explicit)
- [x] Trace context propagation across all service boundaries (incoming HTTP via `traceparent`; outgoing N/A in MVP; future boundaries documented)
- [x] Logging strategy consistent with observability-requirements.md (structured JSON, required fields, redaction, env-driven config, fail-fast validation, no `console.log`)
- [x] Metrics strategy follows naming conventions (deferred to next feature with documented plan)
- [x] All 9 blocking decisions resolved with a single chosen answer (see Decision Summary table)

---

## Next Steps

1. `/banyan-build TASK-001` begins **Phase 1** (TypeScript scaffolding + ESLint).
2. After each phase completes and is committed, the human reviewer signs off before the next `/banyan-build` invocation.
3. Once Phase 7 is committed, `/banyan-reflect TASK-001` captures learnings and `/banyan-archive TASK-001` finalizes the feature branch.
4. Future tasks (FEAT-002 onward) inherit:
   - Type-folder layout for new entities (boards, columns, cards, users)
   - `Repository` pattern with raw `pg` queries
   - Vitest test files at `backend/src/__tests__/<feature>.test.ts`
   - `pino` logger via the `Logger` interface
   - ESLint layering rules automatically apply to new controllers
5. Deferred-to-future-task work (not blocking TASK-001):
   - Full OpenTelemetry SDK wiring (`@opentelemetry/sdk-node`, exporters, collector)
   - Metrics endpoint (`/metrics` Prometheus format)
   - CI/CD pipeline (GitHub Actions)
   - Production deployment artifacts (reverse proxy, HTTPS termination)
   - Pre-commit hooks
