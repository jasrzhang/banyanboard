# Architecture Decision: Activity Feed Realtime Transport & Backend Event Wiring

**Created**: 2026-05-25
**Status**: DECIDED
**Decision Type**: Architecture

---

## Context

### System Requirements

- Capture board events (card created, moved, updated, deleted) and persist them to a new `activity_events` PostgreSQL table.
- Serve a REST endpoint `GET /api/boards/:boardId/activity` returning the 50 most recent events for initial panel load.
- Deliver new events to open feed panels in near-realtime (within 3 seconds, same session; within 5 seconds, cross-tab).
- Emit events from service-layer hooks: after a successful repository write, `CardService`/`ColumnService` fire `activityEmitter.emit('activity', event)`.
- Wire a shared `ActivityEventEmitter` singleton so both `ActivityService` (records to DB, then re-emits) and `ActivitySSEController` (fans out to open HTTP connections) share the same in-process emitter.
- No page reload required for feed updates.

### Technical Constraints

- **No WebSockets in MVP** — hard constraint in `techContext.md` and `productBrief.md`. WebSocket is explicitly out of scope; this document explores only SSE vs. short-poll.
- **Stack**: Node.js/Express, TypeScript, PostgreSQL via `node-postgres`, `node-pg-migrate`.
- **Architecture pattern**: Controller → Service → Repository, constructor DI, no IoC container — manual wiring in route modules and `app.ts`.
- **Deployment**: Docker Compose (dev + prod candidate) behind a potential reverse proxy (nginx). SSE connections must survive proxy keep-alive timeouts.
- **In-process only**: MVP uses Node.js `EventEmitter`, not an external message bus. Single Node.js process; no horizontal scaling in MVP scope.
- **Browser targets**: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ — all support native `EventSource` and SSE.
- **Concurrent users**: 2–15 per deployment. Sustained open HTTP connections are negligible at this scale.
- **Existing DI pattern**: Services receive dependencies via constructor arguments. Route modules instantiate concrete classes and wire them (`new Repo(pool)` → `new Service(repo)` → `new Controller(service)`). `app.ts` calls `createApp()` and registers routers; it does not currently instantiate anything itself — routers own their own wiring.

### Non-Functional Requirements

- **Latency**: Feed updates appear ≤3s (same session), ≤5s (cross-tab).
- **Performance**: API p95 < 200ms. SSE persistent connections have negligible overhead at 2–15 users. The `activity_events` table must carry an index on `(board_id, created_at DESC)`.
- **Reliability**: `ActivityService.recordEvent` MUST NOT throw. DB errors are caught, logged at WARN, and the emitter is still called so in-flight SSE subscribers do not miss the event. On connection loss, browser-native SSE reconnect handles recovery (best-effort).
- **Observability**: Structured JSON logging via `rootLogger` (pino, already wired). All SSE connection lifecycle events and event-emission failures logged with `traceId`. No `console.log` in production code (enforced by `no-console` ESLint rule).
- **Security**: SSE endpoint is board-ID-scoped. For MVP (no auth) this matches the posture of all other board endpoints — clients can only request data for a `boardId` they know.
- **Graceful shutdown**: SSE connections must be cleanly closed on SIGTERM/SIGINT before the process exits. The existing `gracefulShutdown` in `index.ts` calls `server.close()`; once the HTTP server stops accepting connections, open SSE response streams will terminate naturally.

---

## Component Analysis

### Core Components

| Component | Purpose | Responsibilities |
|-----------|---------|------------------|
| `ActivityEventEmitter` | In-process event bus | Typed wrapper around Node.js `EventEmitter`; exposes `emit('activity', event)` and `on('activity', listener)`. Single shared instance created at app startup. |
| `ActivityRepository` | Data access | `insert(event)` writes to `activity_events`; `findByBoardId(boardId, limit=50)` reads recent events ordered by `created_at DESC`. |
| `ActivityService` | Business logic + DB write + re-emit | Constructor `(repo, emitter)`. `recordEvent`: writes to DB (catches errors, logs WARN, never throws), then calls `emitter.emit('activity', event)`. `getByBoardId`: delegates to repo. |
| `ActivityController` | REST GET endpoint | Validates `boardId` UUID, calls `activityService.getByBoardId`, returns JSON array. |
| `ActivitySSEController` | SSE streaming (Phase 2) | Sets `text/event-stream` headers; registers an `activityEmitter` listener filtered to the board; writes `data: <json>\n\n` per event; sends `: heartbeat\n\n` every 25s; removes listener on client disconnect. |
| `app.ts` singleton site | Shared emitter creation | The `ActivityEventEmitter` singleton is the only cross-cutting object that cannot live inside a single route module. Its creation site needs a decision (see Singleton Wiring Decision). |

### Component Interactions

```
CardService / ColumnService
  │  (after repo write succeeds)
  └──► activityEmitter.emit('activity', event)
                │
                ▼
       ActivityEventEmitter  ◄─── ActivitySSEController.stream()
                │                  registers listener: emitter.on('activity', writeToStream)
                │
                ▼
       ActivityService.recordEvent()
         │  (listener registered in ActivityService constructor)
         ├──► ActivityRepository.insert(event)   ──► PostgreSQL
         └──► (on DB error) logger.warn(...)       // never rethrows

REST path (initial load):
  GET /api/boards/:boardId/activity
    └──► ActivityController.getActivity()
          └──► ActivityService.getByBoardId()
                └──► ActivityRepository.findByBoardId()  ──► PostgreSQL
```

**Note on listener ordering**: `ActivityService` registers its `'activity'` listener in its constructor. `ActivitySSEController` registers per-connection listeners when a client connects. Both receive the same emitted event; order between them is insertion-order (Node.js guarantee). The DB write happens asynchronously inside `ActivityService.recordEvent` — the SSE fan-out in `ActivitySSEController` happens synchronously on `emit`, before the DB write completes. This is intentional: SSE latency must not block on the DB write. The event is guaranteed to arrive at SSE subscribers within milliseconds of `emit`; the DB write follows independently.

---

## Options Explored

### Option 1: Server-Sent Events (SSE)

**Description**: The Express backend exposes `GET /api/boards/:boardId/activity-stream` as a long-lived HTTP endpoint using `text/event-stream` content type. The browser uses the native `EventSource` API. The `ActivitySSEController` registers a listener on the shared `ActivityEventEmitter` when a client connects, writes JSON frames to the response stream on each matching event, and sends a heartbeat comment every 25 seconds to keep the connection alive through proxies. The listener is removed when the client disconnects (`req.on('close', ...)`).

**Architecture Diagram**:

```
Browser (EventSource)          Express (ActivitySSEController)        ActivityEventEmitter
      │                                    │                                   │
      │── GET /activity-stream ──────────►│                                   │
      │                                    │── emitter.on('activity', fn) ────►│
      │                                    │                                   │
      │                  ... time passes ...
      │                                    │                           emit('activity', e)
      │                                    │◄───────────────────────────────── │
      │◄── data: {"eventType":"card_created",...}\n\n ──────────────────────── │
      │◄── : heartbeat\n\n (every 25s) ────│                                   │
      │                                    │                                   │
      │── [tab close / panel close] ──────►│ req.on('close')                   │
      │                                    │── emitter.off('activity', fn) ───►│
```

**Pros**:
- Zero additional npm dependencies. Browser `EventSource` is native; no client-side library needed.
- Unidirectional (server-to-client) — exactly matches the use case. There is no client-to-server realtime need in the feed.
- Browser-native automatic reconnection with exponential backoff. The `retry:` field can tune the interval. The `id:` field can help clients detect missed events on reconnect (best-effort for MVP).
- HTTP/1.1 compatible and proxy-transparent when heartbeats are sent at the right cadence (25s is well within typical 60s proxy idle timeouts). Works through nginx with `proxy_buffering off; proxy_cache off; chunked_transfer_encoding on`.
- No polling DB on every interval — events are push-based from the emitter. Zero database reads for the streaming path.
- Latency is effectively zero from `emit` to client receipt (bounded only by network RTT). Well within the ≤3s requirement.
- SSE connections hold an open file descriptor and an emitter listener — total cost at 15 users is 15 open HTTP connections and 15 listener registrations per board. Negligible.
- Fits the existing Express pattern naturally: the SSE handler is a normal Express route handler that simply does not call `res.end()` until the client disconnects.
- Aligns with acceptance criteria AC-ERROR-1 (reconnecting state) and AC-ERROR-2 (error state) — browser `EventSource` fires `onerror` on connection loss, enabling the `useActivityFeed` hook to surface "Reconnecting..." UI.

**Cons**:
- Requires deliberate nginx/proxy configuration to prevent response buffering (`proxy_buffering off`) — documented in runbook.
- Each open SSE connection occupies one Node.js socket handle. At 2–15 users this is irrelevant, but it is a ceiling factor for post-MVP scale.
- HTTP/1.1 browsers limit to 6 connections per origin per domain — in practice this is not an issue since SSE uses one connection out of that budget, and the app uses the same backend origin for all API calls.
- Graceful shutdown requires draining open SSE streams before process exits. The existing `server.close()` in `gracefulShutdown` handles this: it stops accepting new connections and waits for existing ones to close. SSE controllers must not prevent shutdown indefinitely — the 25s heartbeat interval means a client will time out within one heartbeat cycle after `server.close()` stops sending.

**Technical Fit**: High — matches existing Express pattern (route handler), no new dependencies, aligns with "Simplicity over Cleverness" principle.
**Complexity**: Low — SSE is a simple protocol. The handler sets 3 response headers and writes newline-delimited strings.
**Scalability**: Medium — sufficient for MVP (2–15 users). Would require a pub/sub layer (Redis, Kafka) to scale horizontally beyond a single Node.js process, but that is explicitly post-MVP.

---

### Option 2: Short-Poll (REST GET every 5 seconds)

**Description**: No persistent connection. The frontend calls `GET /api/boards/:boardId/activity?since=<iso-timestamp>` every 5 seconds using `setInterval` (or `useQuery` with `refetchInterval`). The backend returns all events newer than the `since` parameter. The emitter is still used internally, but only `ActivityService` listens to it (for DB write). There is no `ActivitySSEController`; the existing `ActivityController` handles both initial load and periodic refresh.

**Architecture Diagram**:

```
Browser (setInterval / React Query)    Express (ActivityController)     PostgreSQL
      │                                          │                          │
      │── GET /activity?since=T0 ──────────────►│── findByBoardId(since) ─►│
      │◄── 200 [{...},{...}] ──────────────────── │◄── rows ─────────────── │
      │                                          │                          │
      │  ... 5 seconds pass ...                  │
      │── GET /activity?since=T1 ──────────────►│── findByBoardId(since) ─►│
      │◄── 200 [{...}] or 200 [] ───────────────│◄── rows ─────────────── │
```

**Pros**:
- Trivially simple backend implementation: no persistent connections, no listener management, no heartbeat. The existing `ActivityController.getActivity` endpoint is sufficient — add a `since` query param and the frontend does the rest.
- Zero proxy/nginx concerns. Standard HTTP request-response; no special configuration needed.
- No open connection per client. Server is completely stateless between requests.
- Simpler graceful shutdown: no open streams to drain. SIGTERM is handled naturally.
- If the DB is the source of truth and all events are persisted (which they are — `ActivityService.recordEvent` writes before emitting), polling is loss-free: every poll catches any missed events from the interval window.
- Easier to reason about in integration tests: each poll is a standard HTTP call.

**Cons**:
- Worst-case latency is the poll interval (5s). Average latency is ~2.5s. The ≤3s same-session requirement is met on average but not at worst case. Cross-tab latency at ≤5s is met only if both clients happen to be near their poll cycle — worst case is ~9.5s (one client is mid-cycle when the other posts an event, and the second client is also mid-cycle).
- Continuous DB queries regardless of activity. At 15 users, that is 15 queries every 5 seconds = 3 queries/second to the `activity_events` table when the feed is open. With the compound index `(board_id, created_at DESC)` and small result sets this is fast, but it is wasted work when nothing has changed.
- The emitter is still needed for the DB write path in `ActivityService`, but it carries no additional value for the streaming path — its in-process pub/sub advantage is unused.
- Acceptance criteria AC-ERROR-1 (reconnecting state) becomes moot — there is no persistent connection to lose. On the other hand AC-ERROR-2 (error state) still applies: if the poll returns a non-200 the UI should show an error.
- `useActivityFeed` hook becomes `useQuery` with `refetchInterval: 5000`, which is simpler to implement but lacks the low-latency delivery guarantee of SSE.
- Product direction post-MVP explicitly lists "Real-time collaboration (WebSocket sync)" as a future enhancement. Starting with short-poll instead of SSE creates a second migration step (poll → SSE → WebSocket) rather than one (SSE → WebSocket). SSE is closer to the post-MVP architecture.

**Technical Fit**: High — standard REST, no new patterns. But does not advance toward post-MVP realtime goals.
**Complexity**: Low — simpler than SSE on the backend; roughly equivalent on the frontend.
**Scalability**: High (stateless) — but at the cost of constant DB load. Ironically worse for the DB at scale than SSE's push model.

---

## Evaluation Matrix

| Criteria | Option 1: SSE | Option 2: Short-Poll |
|----------|--------------|---------------------|
| Latency (≤3s same session) | High — push is near-instant | Medium — worst case 5s; avg 2.5s |
| Latency (≤5s cross-tab) | High — meets requirement | Low — worst case ~9.5s, misses requirement |
| Maintainability | High — clean handler, clear lifecycle | High — simple REST, well-understood |
| Performance (DB load) | High — zero DB reads for streaming | Medium — 3 queries/s at 15 users |
| Security | High — same posture as REST endpoints | High — same posture as REST endpoints |
| Observability | High — connection lifecycle events are loggable | High — standard HTTP request logging |
| Proxy/Docker complexity | Medium — nginx config change required | High — no special config needed |
| Implementation cost | Medium — SSE handler + heartbeat + listener cleanup | Low — `refetchInterval` on existing endpoint |
| Alignment with post-MVP roadmap | High — natural stepping stone to WebSocket | Low — second migration step needed |
| NFR compliance (≤5s cross-tab) | PASS | FAIL (worst-case) |

---

## Singleton Wiring Decision: `ActivityEventEmitter` in `app.ts`

The current codebase wires dependencies inside each route module. For example, `backend/src/routes/boards.ts` instantiates `BoardRepository`, `BoardService`, and `BoardController` locally. This works because no dependency is shared between route modules.

`ActivityEventEmitter` is different: it must be shared between:
1. `ActivityService` (registered listener writes events to DB and re-emits to SSE subscribers)
2. `ActivitySSEController` (registers per-connection listeners that write to SSE streams)
3. Indirectly, `CardController` and `ColumnController` — they call `activityService.recordEvent()`, which internally calls `emitter.emit()`. They do not hold a direct reference to the emitter.

**Two sub-options were considered:**

**Sub-option A: Create the singleton in `app.ts` / `createApp()`**

`createApp()` creates `ActivityEventEmitter` once, then passes it to both the `activity` route module (for `ActivityService` and `ActivitySSEController`) and to the `cards` and `columns` route modules (so their controllers can call `activityService.recordEvent`).

Problem: `createApp()` currently takes no parameters and returns a plain Express app. Introducing service-layer dependencies into `createApp()` moves it away from "app factory" toward "composition root." The route modules would need to accept the emitter as a parameter, which changes their current module-level instantiation pattern.

**Sub-option B: Create the singleton in a dedicated module `src/events/ActivityEventEmitter.ts` and import it where needed**

The singleton is exported from `src/events/ActivityEventEmitter.ts` using a module-level `export const activityEmitter = new ActivityEventEmitter()`. Route modules import this singleton directly. No change to `createApp()` signature.

This is the simplest approach and consistent with how `pool` (the PostgreSQL connection pool) is shared: `pool` is a module-level export from `src/config/db.ts`, imported by every route module that needs it. This is already an established pattern in the codebase — one precedent singleton (the pg pool) is shared via module export without going through `createApp()`.

**Decision: Sub-option B — module-level singleton export, consistent with the `pool` pattern.**

Rationale:
- The `pool` precedent proves this pattern is acceptable in this codebase. Adding a second singleton exported from a module is not a new pattern — it is an extension of the existing one.
- It requires zero changes to `createApp()` or its call sites in tests.
- The "No Premature Abstractions" principle is respected: there is no need to build a DI container or parameterize `createApp()` for a single shared object.
- The emitter is not configurable at runtime (there is no test-time override needed for the emitter itself — tests that need to spy on emitted events can import the same singleton or use the `ActivityService` constructor to inject a test emitter).
- If a future need arises to override the emitter in tests, the `ActivityService` constructor already accepts it via DI — individual unit tests can pass a mock; the module-level singleton is only used in production wiring.

---

## Observability Architecture

### Logging

- **Library**: `rootLogger` from `backend/src/config/logger.ts` (pino v9 wrapped behind the `Logger` interface defined in `src/types/logger.ts`). Already present in the codebase.
- **Format**: Structured JSON with `traceId`, `spanId`, `service`, `version` fields. Configured via `LOG_LEVEL`, `LOG_FORMAT`, `LOG_OUTPUT` environment variables.
- **SSE-specific log events**:
  - `debug` — SSE client connected `{ boardId, traceId }`
  - `debug` — SSE client disconnected `{ boardId, listenersRemaining, traceId }`
  - `warn` — `ActivityService.recordEvent` DB write failed `{ boardId, cardId, eventType, error, traceId }` (does NOT rethrow)
  - `warn` — SSE write to closed response attempted `{ boardId, traceId }`
  - `info` — heartbeat sent (only at `trace` level in production; `debug` in dev) — avoid log noise

### Distributed Tracing

The SSE stream does not have a conventional request-response lifecycle, so tracing is handled as follows:

- **Initial REST load** (`GET /api/boards/:boardId/activity`): Full W3C Trace Context propagation via the existing `requestContext` middleware. `req.traceContext` is set by `createRequestContext(rootLogger)` before the route handler runs. `ActivityController` uses `req.traceContext.traceId` in error responses (matching the existing `BoardController` / `CardController` pattern).
- **SSE stream connection** (`GET /api/boards/:boardId/activity-stream`): A root span is created for the connection lifecycle. The `traceId` from the incoming `traceparent` header (extracted by the `requestContext` middleware) is bound to a child logger for the duration of the connection. Each event written to the stream is logged with the connection's `traceId`.
- **Event emission** (in-process): Events emitted via `activityEmitter.emit('activity', event)` are in-process and synchronous — no cross-service boundary, no trace propagation needed. The `traceId` of the originating HTTP request (the card create/update call) is captured in the `ActivityEvent` payload as `sourceTraceId` for correlation.

| From | To | Protocol | Propagation Method |
|------|----|----------|--------------------|
| Browser (card CRUD) | Express CardController | HTTP | `traceparent` header (existing) |
| CardController | ActivityService | In-process call | `traceId` passed in `ActivityEvent.sourceTraceId` |
| ActivityService | ActivityRepository | In-process call | Same trace context (pino child logger) |
| ActivitySSEController | Browser EventSource | HTTP streaming | Logged at connection; `traceId` in log only |

**Sampling**: `OTEL_TRACES_SAMPLER_ARG` (default `1.0` in dev). SSE connection spans are low-volume at MVP scale — no special sampling needed.

### Metrics

- **Standard Metrics** (already present via Express middleware):
  - `http_requests_total{method, route, status_code}` — counts SSE connection initiations as `GET /api/boards/:boardId/activity-stream 200`
  - `http_request_duration_seconds{method, route}` — duration is not meaningful for SSE streams (connection is long-lived); if the metrics middleware measures this at request end it will record the full session duration. This is acceptable and expected behavior for SSE.

- **Custom Business Metrics** (new, to be added in Phase 2):
  - `activity_sse_connections_active{board_id}` — Gauge tracking currently open SSE connections per board. Labels: `board_id` is low-cardinality at MVP scale (tens of boards). **Note**: if board count grows significantly post-MVP, `board_id` as a label must be re-evaluated for cardinality.
  - `activity_events_emitted_total{event_type}` — Counter of events emitted by type (`card_created`, `card_moved`, `card_updated`, `card_deleted`).
  - `activity_record_failures_total` — Counter of DB write failures caught in `ActivityService.recordEvent`.

### Configuration Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `LOG_LEVEL` | Log verbosity | `info` |
| `LOG_FORMAT` | Output format (`json`/`text`) | `json` |
| `LOG_OUTPUT` | Destination (`stdout`/`file`/`both`) | `stdout` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint | — (console exporter in dev) |
| `OTEL_SERVICE_NAME` | Service identifier | `banyanboard-backend` (from `config.serviceName`) |
| `OTEL_TRACES_SAMPLER_ARG` | Sampling ratio | `1.0` (dev) |
| `SSE_HEARTBEAT_INTERVAL_MS` | SSE heartbeat cadence | `25000` (25s) |

`SSE_HEARTBEAT_INTERVAL_MS` is read via `optionalIntEnv('SSE_HEARTBEAT_INTERVAL_MS', 25000)` in the SSE controller, following the 12-Factor Config pattern already established in `src/config/env.ts`.

---

## Decision

**Chosen**: Option 1 — Server-Sent Events (SSE)

### Rationale

The cross-tab latency requirement (≤5s) is the deciding factor. Short-poll at 5-second intervals has a worst-case cross-tab latency of approximately 9.5 seconds (one client posts an event mid-poll-cycle for the receiving client), which materially violates the specified NFR. SSE's push delivery makes both the ≤3s and ≤5s requirements reliably achievable — latency is bounded only by network RTT, which on a LAN or local Docker network is effectively zero.

Beyond latency, SSE is the better MVP choice because:

1. **No new dependencies.** Browser `EventSource` is native in all target browsers. The backend implementation is a route handler that sets three response headers and writes newline-delimited strings — no new npm packages required.

2. **Alignment with the existing architecture and Guiding Principles.** "Simplicity over Cleverness" — an SSE handler is a simple, explicit Express route. The protocol is HTTP, so it slots into the existing Controller → Service → Repository pattern without requiring a new abstraction layer.

3. **Zero wasted DB reads during idle periods.** Short-poll queries the database every 5 seconds per open client regardless of whether anything has changed. At 15 users that is 3 DB queries/second of constant background load. SSE pushes events only when they are available.

4. **SSE is closer to the post-MVP architecture.** The product brief lists "Real-time collaboration (WebSocket sync)" as a future enhancement. SSE (persistent HTTP, unidirectional push) is architecturally adjacent to WebSocket (persistent connection, bidirectional). Migrating from SSE to WebSocket requires replacing the transport layer, not the event schema, emitter infrastructure, or service wiring. Short-poll would require two migrations.

5. **Proxy/Docker concern is manageable.** The only operational requirement is `proxy_buffering off; proxy_cache off` in the nginx config, plus the 25-second heartbeat. This is a one-line config change with a documented rationale. The heartbeat also serves as an implicit health signal — if the browser stops receiving heartbeats it can surface the "Reconnecting..." state (AC-ERROR-1).

### Trade-offs Accepted

- **Nginx configuration required.** Self-hosters must add `proxy_buffering off` to their nginx site config if they run BanyanBoard behind a reverse proxy. This will be documented in the deployment runbook and in a `docker-compose.nginx.yml` example configuration. Failure to configure this results in the SSE stream appearing to stall (buffered responses), not a crash — a detectable and documentable failure mode.
- **Open connection per active feed panel.** Each browser tab with an open activity feed holds one HTTP connection to the backend. At 2–15 users this is negligible. If a user opens the same board in 10 tabs simultaneously they create 10 SSE connections — acceptable and benign at MVP scale.
- **No guaranteed event replay on reconnect.** After a reconnect, the browser `EventSource` can send the `Last-Event-ID` header if the server sets `id:` fields on events. For MVP, replaying missed events is explicitly out of scope (best-effort). Events missed during a disconnect gap will not appear in the feed. Users can reload the panel (which triggers the REST initial-load endpoint) to see current state.

### Singleton Wiring Decision

`ActivityEventEmitter` is created as a **module-level singleton export** from `backend/src/events/ActivityEventEmitter.ts`, following the exact same pattern as the `pool` export from `backend/src/config/db.ts`. Route modules (`activity.ts`, `cards.ts`, `columns.ts`) import this singleton directly. `createApp()` requires no changes.

This is the simplest approach that is consistent with established codebase patterns and respects the "No Premature Abstractions" principle. No DI container, no parameterized `createApp()`, no new patterns.

---

## Implementation Guidelines

1. **`ActivityEventEmitter` module** (`backend/src/events/ActivityEventEmitter.ts`): Export the class and the module-level singleton `export const activityEmitter = new ActivityEventEmitter()`. The class adds TypeScript typing over raw `EventEmitter` — define `ActivityEvent` as the payload type and create typed `emit`/`on` overloads so all listeners are type-safe.

2. **`ActivityService` constructor DI**: Constructor accepts `(repo: ActivityRepository, emitter: ActivityEventEmitter)`. Register the `'activity'` listener in the constructor body. This preserves testability — unit tests can pass a mock emitter without touching the module-level singleton.

3. **SSE handler (`ActivitySSEController.stream`)**: Set exactly these headers before writing anything: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Flush the connection immediately with a comment line (`: connected\n\n`) so the browser knows the stream is live. Register a per-connection listener on `activityEmitter` filtered by `boardId`. Write `data: <json>\n\n` per event (include `id:` field with the event UUID for `Last-Event-ID` support). Send `: heartbeat\n\n` at the configured interval. On `req.on('close', cleanup)` remove the listener and clear the heartbeat timer. Never call `res.end()` except in the cleanup.

4. **`app.ts` change is minimal**: Register the new activity router only. The emitter singleton lives in its own module. The router module (`routes/activity.ts`) imports the singleton and wires `ActivityRepository`, `ActivityService`, `ActivityController`, and `ActivitySSEController` using the same pattern as `routes/boards.ts`.

5. **`ColumnController` and `CardController` hooks**: Import `activityService` from the `activity` routes module is not possible (circular). Instead, the `cards.ts` and `columns.ts` route modules import `activityEmitter` from `src/events/ActivityEventEmitter.ts` and create their own `ActivityService` instance (sharing the same singleton emitter). Alternatively, `ActivityService` can be exported from `routes/activity.ts` and imported by `cards.ts` and `columns.ts`. The second approach avoids duplicate `ActivityService` instances; it requires that `routes/activity.ts` be imported first (Node.js module load order is top-level in `app.ts`, which registers all routers). The implementation team should choose the no-duplicate approach: export `activityService` from `routes/activity.ts` and import it in `cards.ts` and `columns.ts`.

6. **`ActivityService.recordEvent` contract**: This method MUST follow the fire-and-forget contract: `(a)` await the repository insert inside a try/catch; `(b)` on catch, call `req.logger` (if available) or `rootLogger` at `warn` level with the error; `(c)` call `emitter.emit('activity', event)` unconditionally (whether the DB write succeeded or not), so SSE subscribers always receive the event. The trade-off: the feed shows an event that failed to persist — this is acceptable for MVP. Strictly the event is in-flight in memory.

7. **Nginx/proxy runbook entry**: Document `proxy_buffering off; proxy_read_timeout 3600s; proxy_send_timeout 3600s;` for the SSE location block in the deployment runbook. Include the docker-compose example nginx config.

8. **Graceful shutdown**: The existing `server.close()` in `index.ts` is sufficient. When the server stops accepting connections, the Node.js HTTP server will stop writing to open SSE streams. Clients will receive an `error` event on their `EventSource` and enter the "Reconnecting..." state — a clean UX on planned restarts.

---

## Validation Checklist

- [x] Meets all system requirements (event capture, REST endpoint, ≤3s same-session, ≤5s cross-tab)
- [x] Respects technical constraints (no WebSocket, Docker/Express stack, manual DI, no new runtime dependencies)
- [x] Addresses non-functional requirements (latency, p95 performance via DB index, reliability via non-throwing `recordEvent`)
- [x] Technically feasible (SSE is HTTP/1.1 native; existing Express handles it as a normal route handler)
- [x] Risks identified and acceptable (nginx config, no guaranteed replay, open connections)
- [x] Complies with Guiding Principles in systemPatterns.md — no deviations required
- [x] Respects established patterns (Controller → Service → Repository, constructor DI, module-level singleton consistent with `pool` precedent)
- [x] Observability architecture defined (logging events, tracing boundary, metrics)
- [x] Trace context propagation across all service boundaries documented
- [x] Logging strategy consistent with observability-requirements.md (rootLogger, structured JSON, no console.log)
- [x] Metrics strategy follows naming conventions (snake_case, `_total` / `_active` suffixes, cardinality note)

### Guiding Principle Compliance Notes

| Principle | Compliance |
|-----------|------------|
| Clean Architecture | SSE handler lives in `ActivitySSEController` (controller layer). No business logic in route handler. No DB access in controller. |
| Simplicity over Cleverness | SSE handler is ~40 lines: set headers, register listener, write string, cleanup on close. No framework, no abstraction. |
| No Premature Abstractions | Singleton exported from module (like `pool`). No DI container introduced. No generic `StreamController` base class. |
| 12-Factor Config | `SSE_HEARTBEAT_INTERVAL_MS` via `optionalIntEnv`. All observability vars via env. |
| Graceful Shutdown | `server.close()` drains open SSE connections. No additional shutdown logic needed. |
| Optimistic UI | Not directly applicable to the feed; card drag-and-drop optimistic behavior is unchanged. |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Nginx proxy buffers SSE stream, stalling feed updates | Medium (self-hosted Docker users likely to add nginx) | High (feed appears broken) | Document `proxy_buffering off` in runbook; ship example nginx config in repo |
| EventEmitter listener leak if `req.on('close')` not triggered | Low (Node.js fires 'close' reliably on disconnect) | Medium (memory growth over time) | Unit test verifies listener is removed on disconnect; log `listenersRemaining` on each disconnect |
| `ActivityService.recordEvent` DB failure causes emitter not to fire | Mitigated by design (emit is called unconditionally after catch) | High (SSE subscribers miss event) | Contract is explicit in implementation guideline #6; test covers DB-error-but-emitter-still-fires scenario |
| `activity_events` table grows unbounded | Low for MVP (small teams, low event volume) | Low | 50-event cap on REST endpoint for MVP; post-MVP: TTL-based cleanup job |
| Module load order issue (circular import if `cards.ts` imports from `routes/activity.ts`) | Medium (subtle) | Medium (runtime crash at startup) | Use the `activityService` export from `routes/activity.ts` pattern; verify with startup smoke test; document load order dependency |
| Open SSE connections prevent graceful shutdown from completing quickly | Low (Node.js drains on `server.close()`) | Low (shutdown delay) | `server.close()` callback fires after all connections close; add a 10s forced shutdown timeout in `index.ts` if not already present |

---

## Next Steps

1. **Phase 1 (Backend Core)**: Implement `ActivityEventEmitter` module with singleton export; `ActivityRepository`; `ActivityService` with constructor DI and non-throwing `recordEvent`; `ActivityController` for REST GET; migration for `activity_events` table with compound index; wire hooks into `ColumnController` (card_created) and `CardController` (card_moved / card_updated). Export `activityService` from `routes/activity.ts` and import in `cards.ts` and `columns.ts`.

2. **Phase 2 (Backend SSE Transport)**: Implement `ActivitySSEController` with SSE headers, heartbeat (`SSE_HEARTBEAT_INTERVAL_MS`), per-connection emitter listener filtered by `boardId`, and cleanup on `req.close`. Add `GET /api/boards/:boardId/activity-stream` route. Add `activity_sse_connections_active` gauge metric.

3. **Nginx runbook entry**: Add SSE-specific nginx config example (`proxy_buffering off; proxy_read_timeout 3600s`) to `docs/deployment.md` or equivalent before the first production deployment.

4. **Phase 3 (Frontend)**: Implement `useActivityFeed(boardId)` hook using native `EventSource`; `ActivityFeedPanel` with `role="log" aria-live="polite"`; toggle in `BoardHeader`. Layout decision from the parallel UI/UX creative phase.
