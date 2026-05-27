# System Architecture Patterns

This file documents the architectural patterns, design patterns, and system structure used in this project.

## Domain Event Pattern

Card actions (create, move, label, assign, delete) emit domain events.
Consumers subscribe to event streams rather than polling.
Events: timestamp, actor, action type, card ID, before/after state.
In-process emitter for v1; design for future message bus.

## Error Handling

Structured JSON with code, message, details. Extend base AppError.

## Guiding Principles

| Principle                  | Description                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean Architecture         | Controllers → Services → Repositories. No business logic in route handlers. No database calls in controllers.                                                             |
| Simplicity over Cleverness | Prefer explicit, readable code. Avoid patterns that require explanation to understand.                                                                                    |
| No Premature Abstractions  | Don't create a shared abstraction until there are 3+ concrete implementations. Three similar functions are better than one over-generalized helper.                       |
| 12-Factor Config           | All environment-specific values (DB URL, port, JWT secret) via environment variables. No hardcoded config in source. Fail fast at startup if required values are missing. |
| Graceful Shutdown          | All services handle SIGTERM and SIGINT to shut down cleanly (critical for container orchestration). Connections close, in-flight requests complete, process exits.        |
| Optimistic UI              | Card drag-and-drop updates the UI immediately, then confirms with the server. Rollback on error.                                                                          |

## System Architecture

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

All services orchestrated via Docker Compose for local development.
```

### Component Responsibilities

- **React Frontend**: Renders boards, columns, and cards. Handles drag-and-drop interactions. Calls REST API. No business logic beyond UI state.
- **Express Backend**: Routes → Controllers → Services → Repositories. Validates input, enforces auth, delegates to service layer.
- **Service Layer**: Business logic — e.g., column ordering, due date validation, label management, activity event recording.
- **Repository Layer**: SQL queries via `pg`. One repository per domain entity (BoardRepository, ColumnRepository, CardRepository, ActivityRepository).
- **ActivityEventEmitter**: In-process typed event bus for activity events. Decouples event producers (controllers) from consumers (SSE route, future subscribers).
- **PostgreSQL**: Source of truth for all boards, columns, cards, users, labels, and activity events.

### Data Flow Patterns

#### Card Move (Drag and Drop)

```
User drags card → React updates local state (optimistic) →
PATCH /api/cards/:id { columnId, position } →
Controller validates → CardService.moveCard() →
CardRepository.updatePosition() → DB →
200 OK → React confirms state
          (on error: React reverts to previous state)
```

#### Board Load

```
User opens board → GET /api/boards/:id →
Controller → BoardService.getBoardWithColumns() →
BoardRepository.findWithColumnsAndCards() →
JOIN query (boards + columns + cards) →
JSON response → React renders columns and cards
```

## Design Patterns Used

### App Factory Pattern (Express) — Configuration & Testing

- **Problem**: Express app needs to be testable; configuration must be injectable
- **Implementation**: `createApp()` function in `src/app.ts` returns a configured Express app; called by server entry point in `src/index.ts`
- **Trade-offs**: Minimal boilerplate; enables easy HTTP testing via supertest
- **Example**: `backend/src/app.ts`

### 12-Factor Configuration Pattern — Environment-Driven Config

- **Problem**: Config differs by environment (dev, test, production); must fail fast on missing required values
- **Implementation**: `src/config/env.ts` exports a frozen `config` object with:
  - `requireEnv(key)` — throws ConfigurationError if missing
  - `optionalEnv(key, default)` — returns env var or sensible default
  - `optionalIntEnv(key, default)` — parses and validates integer env vars
- **Trade-offs**: Small module; prevents hardcoded values anywhere in codebase
- **Example**: `backend/src/config/env.ts` (DATABASE_URL required at startup)

### Graceful Shutdown Pattern — Process Management

- **Problem**: Server must close cleanly on SIGTERM/SIGINT (container orchestration, rolling deployments)
- **Implementation**: Register handlers for SIGTERM and SIGINT that call `server.close()` and exit
- **Trade-offs**: Simple pattern; prevents connection leaks during shutdown
- **Example**: `backend/src/index.ts`

### Repository Pattern — Data Access

- **Problem**: Decouple business logic from SQL queries
- **Implementation**: One class per entity (BoardRepository, CardRepository, etc.) with typed methods
- **Trade-offs**: Slight boilerplate; prevents query logic from leaking into services

### Service Layer — Business Logic

- **Problem**: Route handlers becoming bloated with logic
- **Implementation**: Service classes called by controllers; no Express req/res in services
- **Trade-offs**: Extra indirection for simple CRUD; pays off as logic grows

### Observability Pattern — Structured Logging with Request Correlation

- **Problem**: Production bugs require trace context across log lines; `console.log` is unsearchable in JSON log aggregators
- **Implementation** (wired in Phase 5):
  - `src/types/logger.ts` — `Logger` interface with OTel-shaped API (`trace/debug/info/warn/error/fatal` + `child()` + `withTraceContext()`)
  - `src/config/logger.ts` — `createLogger()` factory wrapping pino v9; exports `rootLogger` singleton
  - `src/middleware/requestContext.ts` — parses W3C `traceparent` header or generates `traceId`/`spanId` via `randomBytes`; attaches `req.logger` (child of rootLogger) and `req.traceContext`; echoes `traceparent` in response headers
  - `src/middleware/requestLogger.ts` — emits one access log per response with method, path, statusCode, durationMs, traceId
  - `src/middleware/errorHandler.ts` — Express 4-arg error handler; logs unhandled errors with route and traceId; returns JSON `{ error: { message, traceId } }`
- **Configuration**: `LOG_LEVEL`, `LOG_FORMAT` (json/text), `LOG_OUTPUT`, `LOG_REDACT_PATTERNS` env vars; pino-pretty for text in dev
- **Trade-offs**: pino is synchronous to a custom stream (testable); `Logger` interface keeps OTel SDK wiring mechanical in future
- **Key constraint**: `no-console: error` ESLint rule forces all production logging through the Logger interface

### ActivityEventEmitter Wrapper Pattern — In-Process Event Bus

- **Problem**: Extending Node.js `EventEmitter` in TypeScript causes `noImplicitOverride` conflicts on inherited method signatures; also needs `setMaxListeners(0)` for unbounded SSE subscriber counts.
- **Implementation**: `ActivityEventEmitter` holds a private inner `EventEmitter` instance and re-exposes `on/off/emit` as typed methods. `setMaxListeners(0)` called in constructor. Exported as `activityEmitter` singleton from `src/events/ActivityEventEmitter.ts`.
- **Trade-offs**: One extra indirection layer; avoids TypeScript override friction and keeps the API fully typed.
- **Example**: `backend/src/events/ActivityEventEmitter.ts`

### Fire-and-Forget Activity Hooks — Non-Blocking Event Emission

- **Problem**: Activity recording (DB write + in-process emit) must never delay the HTTP response to the client.
- **Implementation**: Controllers call `activityService.recordEvent()` _after_ `res.json()` via `void promise.catch(logger.error)`. No `await`; errors are logged but don't propagate to the response.
- **Trade-offs**: Event emission is best-effort — a DB failure will log an error but the card operation has already succeeded. This is intentional for MVP resilience.
- **Example**: `backend/src/controllers/ColumnController.ts` (card_created), `backend/src/controllers/CardController.ts` (card_moved / card_updated)

### Pre-Update Context Capture — Semantic Event Typing

- **Problem**: To distinguish `card_moved` from `card_updated`, the controller needs the card's previous `columnId` before the PATCH is applied.
- **Implementation**: `CardController.updateCard()` calls `cardService.getCardContext(id)` before delegating to `cardService.updateCard()`. The before/after `columnId` comparison determines which event type to emit.
- **Trade-offs**: One extra DB read per card update. Acceptable for MVP; can be eliminated later with a returning-clause or optimistic diff.
- **Example**: `backend/src/controllers/CardController.ts`

### activityService Singleton Export — Cross-Route DI Without Circular Imports

- **Problem**: `ColumnController` and `CardController` both need `activityService`, but each lives in its own route module. Re-instantiating creates divergent emitter instances; importing from the controller module risks circular dependencies.
- **Implementation**: `src/routes/activity.ts` creates the `activityService` singleton and exports it by name. `src/routes/columns.ts` and `src/routes/cards.ts` import it from the activity route module. No class-level DI container needed.
- **Trade-offs**: Route modules gain a mild coupling to each other; acceptable at MVP scale. Eliminates the need for a DI framework.
- **Example**: `backend/src/routes/activity.ts` (export), `backend/src/routes/columns.ts` + `cards.ts` (import)

## Integration Patterns

[To be documented as integrations are built — no external integrations in MVP]

## Testing Patterns

### Test Organization

- **Test location**: `backend/src/__tests__/` — all test files co-located under one directory
- **File mapping**: `<feature>.test.ts` maps to the feature being tested (e.g., `health.test.ts`, `db.test.ts`, `logger.test.ts`, `layering.test.ts`)
- **Naming convention**: lowercase hyphenated domain noun, `.test.ts` suffix

### Test Grouping

- **Within-file structure**: Top-level `describe` groups all tests for one feature; nested `describe` for sub-features or scenarios
- **Describe/context nesting**: Max 2 levels deep (feature > scenario)
- **Setup sharing**: Factory helpers (e.g., `captureLogger()`, `createApp()`) defined at the top of the test file; no shared fixtures across files

### Test Framework & Style

- **Framework**: Vitest v2 — ESM-native, fast, no separate config needed beyond `vitest.config.ts`
- **Assertion style**: `expect().toBe()`, `expect().toMatchObject()`, `expect().toHaveLength()`, `expect().rejects.toThrow()` — Vitest built-in matchers
- **Mocking approach**: Dependency injection preferred over mocks — `createApp()` and `createLogger(deps)` enable test wiring without patching modules; `vi.mock()` reserved for unavoidable system boundaries (e.g., `node:fs` in structural tests)

### Test Scope Preferences

- **Emphasis**: Integration-first — HTTP endpoint tests use supertest against a real Express app; DB connectivity tests use real PostgreSQL (docker-compose); unit tests cover stateless helpers only
- **Typical test-to-source ratio**: ~1 test file per feature vertical slice; 2–5 tests per file for the foundation suite (15 non-DB tests total as of Phase 6)
- **What is NOT tested**: Docker healthcheck timing (environmental/non-deterministic), TypeScript compilation (covered by `tsc --noEmit`), ESLint rule configuration itself, third-party library internals (express routing, pg driver)

<!-- AUTO-MANAGED: c4-architecture-start -->

## C4 Architecture

<!--
  This section is auto-managed by /banyan-c4. Run /banyan-c4 to populate or refresh.
  Until /banyan-c4 has been run for the first time, this section is a placeholder.
  Do not hand-edit between the AUTO-MANAGED markers — edits will be overwritten.
-->

C4 architecture documentation has not been generated for this project yet.

To populate this section, run `/banyan-c4`.

<!-- AUTO-MANAGED: c4-architecture-end -->
