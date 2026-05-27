# Architecture Decision: Card Labels — Backend API & Card-Label Assignment Shape

**Created**: 2026-05-27
**Status**: DECIDED
**Decision Type**: Architecture
**Task**: TASK-006
**Resolves**: Creative Q4 (card-label assignment API shape) and overall label backend structure

---

## Context

### System Requirements

- Board-scoped label CRUD: `GET / POST / PATCH / DELETE /api/boards/:boardId/labels`.
- Card-label assignment API exposed under `/api/cards/:cardId/labels` (shape TBD — Q4).
- One new migration: add nullable `icon VARCHAR(10)` column to `labels` table.
- `BoardView.allLabels` must be able to fetch labels independently of card data (so freshly created, unassigned labels appear as filter chips).
- Existing `GET /api/boards/:id` already returns `card.labels[]` nested per card via a single `json_agg` join (see `BoardRepository.findByIdWithColumnsAndCards`) — no change required to the board-load query for read-side display of assigned labels.
- Duplicate-name protection per board (`UNIQUE (board_id, name)` already migrated; surfaced to user as 409 Conflict).
- All endpoints must follow the established Controller → Service → Repository pattern.
- No activity event recording in this task (out of scope per spec), but the architecture must leave a clean integration seam for a future task that wires `activityService.recordEvent` into the label endpoints without re-architecting them.

### Technical Constraints

- **Stack**: Node.js 20 / Express 4 / TypeScript 5 / PostgreSQL 15 via `node-postgres`, migrations via `node-pg-migrate`. Validation via Zod.
- **Architecture**: Clean architecture (controllers thin, services own business logic, repositories own SQL). Constructor DI wired in route modules; no IoC container. Pattern verified in `BoardController`, `CardController`, `ColumnController`.
- **No business logic in route handlers** (Guiding Principle).
- **12-Factor**: no hardcoded config. Label endpoints have no env-var surface beyond what's already in `config/env.ts`.
- **No premature abstractions** (Guiding Principle): label resources are simple CRUD; do not over-engineer.
- **Optimistic UI** (Guiding Principle): card-label assignment must be friendly to TanStack Query optimistic updates, with rollback on error (the `useUpdateCard` pattern is the reference).
- **Existing singleton wiring pattern**: `activityService` lives in `routes/activity.ts` and is imported by `routes/cards.ts` / `routes/columns.ts`. The label routes must use the same pattern if/when they need to emit events.
- **Existing routing pattern**: Board-scoped sub-resources mount on `/api/boards` and use `Router({ mergeParams: true })` to access `:boardId`. The current `activityRouter` is the precedent (`/api/boards/:boardId/activity`).

### Non-Functional Requirements

- **API p95 < 200ms** — All label endpoints are single-table reads/writes or a 2-row composite-key write to `card_labels`. No performance risk at the 2–15 user MVP scale.
- **Observability**: All operations use `req.logger` (child of `rootLogger` with `traceId`). Errors flow through the centralized `errorHandler`; user-visible errors carry `traceId`.
- **Security**: Board-ID-scoped routes match the existing MVP posture (no auth). Label endpoints validate that the label belongs to the supplied `boardId` before mutating, preventing cross-board label leakage even if a client guesses an ID.
- **Reliability**: Card-label assignment must be atomic (all-or-nothing per request) — partial assignment failures would leave the UI's optimistic state inconsistent with the DB.
- **Maintainability**: API surface must be small enough that one developer can hold the entire label feature in their head.

---

## Component Analysis

### Core Components

| Component | Purpose | Responsibilities |
|-----------|---------|------------------|
| `LabelRepository` | Data access for `labels` and `card_labels` tables | `findByBoardId`, `findById`, `create`, `update`, `delete`, `existsForBoard`, plus card-assignment methods: `getAssignedLabelIds`, `replaceAssignments` (transactional). |
| `LabelService` | Business logic for label CRUD + assignment | Duplicate-name handling (mapped to typed `DuplicateLabelError`), board-scoped existence checks, transactional replace-all assignment semantics. No HTTP or `req/res`. |
| `LabelController` | HTTP layer for `/api/boards/:boardId/labels` | Zod validation of body + URL params; maps `DuplicateLabelError` to 409; maps not-found to 404; calls service; returns JSON. |
| `CardLabelController` | HTTP layer for `PUT /api/cards/:cardId/labels` | Zod validation; resolves card → boardId; delegates to `LabelService.replaceCardLabels`. |
| `labelSchemas.ts` | Zod schemas: `CreateLabelSchema`, `UpdateLabelSchema`, `ReplaceCardLabelsSchema` | Single source of truth for label DTO validation; exports inferred TypeScript types. |
| `labelsRouter` | Express router for `/api/boards/:boardId/labels` | Mounted via `app.use('/api/boards', labelsRouter)`, using `Router({ mergeParams: true })` (matches `activityRouter` precedent). |
| `cardLabelsRouter` | Routes mounted under `/api/cards/:cardId/labels` | Either added to the existing `cardsRouter` or mounted as a separate router — see Routing Layout decision. |
| `DuplicateLabelError` | Typed domain error | Thrown by `LabelService` when `UNIQUE (board_id, name)` violated; mapped to 409 by controller (avoids leaking PG error codes). |

### Component Interactions

```
HTTP request
  │
  ▼
labelsRouter / cardLabelsRouter
  │
  ▼
LabelController / CardLabelController     ── validates URL params + body (Zod)
  │
  ▼
LabelService                              ── business rules (board scope, dup-name mapping)
  │
  ▼
LabelRepository                           ── SQL via pg
  │
  ▼
PostgreSQL (labels + card_labels tables)
```

**Future integration seam** (out of scope this task, but the architecture allows it):

```
CardLabelController.replaceCardLabels()
  │
  ├──► LabelService.replaceCardLabels(cardId, labelIds) ──► transaction commits
  │
  ├──► res.status(200).json({ labels })            ◄── HTTP response sent
  │
  └──► (fire-and-forget) activityService.recordEvent({
         boardId, cardId,
         eventType: 'card_labels_updated',
         payload: { added: [...], removed: [...] }
       })
```

The replace-all shape (Option A below) makes computing `{ added, removed }` trivial because the service already loaded both the pre-state and the post-state inside the same transaction.

---

## Options Explored

### Option A: Replace-all endpoint — `PUT /api/cards/:cardId/labels`

**Description**: Single endpoint accepts the complete desired label set; backend computes the diff inside a transaction and writes the result.

**API shape**:

```typescript
// frontend/src/types/api.ts
export interface ReplaceCardLabelsRequest {
  labelIds: string[];
}

// Backend Zod (backend/src/schemas/labelSchemas.ts)
export const ReplaceCardLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).max(50),
});

// Route: PUT /api/cards/:cardId/labels
// Response 200: { labels: Label[] }   (the resulting full label set)
// Response 404: card not found
// Response 400: invalid labelId UUID, body shape, or any labelId not on the card's board
```

**Repository signature** (transactional):

```typescript
async replaceAssignments(
  cardId: string,
  labelIds: string[],
): Promise<Array<{ id: string; name: string; color: string; icon: string | null }>>
```

Implementation runs in a `BEGIN/COMMIT` block:
1. `DELETE FROM card_labels WHERE card_id = $1 AND label_id <> ALL($2)`
2. `INSERT INTO card_labels (card_id, label_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`
3. `SELECT l.id, l.name, l.color, l.icon FROM card_labels cl JOIN labels l ON l.id = cl.label_id WHERE cl.card_id = $1`

**Optimistic update (frontend, TanStack Query)**:

```typescript
useMutation({
  mutationFn: ({ cardId, labelIds }) => replaceCardLabels(cardId, labelIds),
  onMutate: async ({ cardId, labelIds }) => {
    await queryClient.cancelQueries({ queryKey: ['board', boardId] });
    const previous = queryClient.getQueryData<Board>(['board', boardId]);
    if (previous) {
      const newLabels = previous.columns
        .flatMap((c) => c.cards)
        .find((c) => c.id === cardId)?.labels ?? [];
      // resolve labelIds → Label[] via board's full label list
      queryClient.setQueryData<Board>(['board', boardId], applyCardLabels(previous, cardId, labelIds));
    }
    return { previous };
  },
  onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(['board', boardId], ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['board', boardId] }),
});
```

Mirrors the existing `useUpdateCard` shape exactly — one snapshot, one rollback, one invalidate.

- **Pros**:
  - **Idempotent**: re-sending the same `labelIds` array yields the same end state. Safe to retry on network flakes.
  - **Single source of truth**: server returns the post-state label set; the client never has to reconcile per-label optimistic deltas.
  - **No race conditions**: each click sends a single complete request. Last-write-wins is natural and matches user intent (the modal shows the user's current selection; what they save is what they meant).
  - **Transactional atomicity**: cannot leave a card half-assigned if a constraint fails mid-write.
  - **Activity event granularity is easy**: server has pre-state and post-state inside the transaction, so it can emit a single `card_labels_updated` event with `{ added: [...], removed: [...] }` — richer than per-label events would be.
  - **Matches the existing optimistic update pattern**: `useUpdateCard` is a snapshot/rollback/invalidate flow. A replace-all label mutation drops in with the same shape.
  - **Smaller API surface**: one route, one schema, one controller method, one repository method, one frontend mutation hook.
  - **Aligns with the spec's `AssignLabelsRequest` DTO** already named in the In-Scope list.
- **Cons**:
  - Wire payload includes the full `labelIds` set even for single-label toggles. In practice this is trivial: each card averages 0–5 labels, max 50 enforced.
  - All-or-nothing failure mode: if any `labelId` is invalid, the entire request fails. Acceptable for MVP — the picker only shows valid labels for the board.
- **Technical Fit**: **High** — mirrors `useUpdateCard`, matches the existing PATCH-then-invalidate convention, fits the `BoardRepository`-style transactional pattern in `createWithDefaultColumns`.
- **Complexity**: **Low** — one route, one schema, one transactional repo method.
- **Scalability**: **High** — request size is bounded (max 50 labels per card); endpoint is O(1) HTTP calls per user action.

---

### Option B: Individual toggle endpoints — `POST /api/cards/:cardId/labels/:labelId` and `DELETE /api/cards/:cardId/labels/:labelId`

**Description**: One endpoint per atomic add or remove operation; client fires N requests when toggling N labels.

**API shape**:

```typescript
// Route: POST /api/cards/:cardId/labels/:labelId
//   - 201 Created on insert, 204 No Content if already assigned (idempotent)
//   - 404 if card or label not found
//   - 400 if label not on card's board

// Route: DELETE /api/cards/:cardId/labels/:labelId
//   - 204 No Content on delete or no-op
//   - 404 if card not found
```

**Repository signatures**:

```typescript
async assignLabel(cardId: string, labelId: string): Promise<void>
async unassignLabel(cardId: string, labelId: string): Promise<void>
```

**Optimistic update (frontend)**:

```typescript
const assignMutation = useMutation({
  mutationFn: ({ cardId, labelId }) => assignLabel(cardId, labelId),
  onMutate: async ({ cardId, labelId }) => {
    /* add labelId to card optimistically */
  },
  onError: /* remove labelId on rollback */,
  onSettled: () => queryClient.invalidateQueries(['board', boardId]),
});

const unassignMutation = useMutation({
  mutationFn: ({ cardId, labelId }) => unassignLabel(cardId, labelId),
  onMutate: /* remove labelId optimistically */,
  onError: /* add labelId back on rollback */,
  onSettled: () => queryClient.invalidateQueries(['board', boardId]),
});
```

Two separate hooks; the picker UI maintains a derived list of pending operations.

- **Pros**:
  - RESTful resource semantics — `card_labels` is a true subresource of `cards`.
  - Each toggle is a minimal-payload request (zero-byte body).
  - Per-label activity events fall out naturally if/when activity recording is added.
- **Cons**:
  - **Race condition risk**: rapid toggling (off → on → off) can land out of order on the server depending on network conditions and pending request handling. Mitigations exist (request-ID ordering, AbortSignal per label, debouncing) but require ongoing maintenance.
  - **Optimistic state complexity**: with two distinct mutation hooks, the rollback context for label X must be tracked separately from label Y. If two parallel mutations both error out, rollback ordering matters. The simple `previous` snapshot pattern from `useUpdateCard` doesn't compose — each in-flight mutation needs its own snapshot reference.
  - **Network amplification**: assigning three labels in a "save" action becomes three HTTP requests (or three in-flight optimistic mutations). At MVP scale not a problem; at scale this multiplies SQL connections and trace volume.
  - **Activity event granularity is the wrong shape**: per-label events would flood the feed during a multi-label assignment. The user thinks "I labeled this card with X, Y, Z" — one event — but the API forces three.
  - **Larger API surface**: two routes, two schemas, two controller methods, two repository methods, two frontend hooks.
  - **Inconsistent with `useUpdateCard`**: card title/description/dueDate are mutated via a single PATCH that accepts multiple fields. Card labels would diverge from that established pattern for no clear user-facing benefit.
  - **More test surface**: two endpoints × (happy / 404 / 400 / 409 / dup-toggle) cases vs. one endpoint × the same cases.
- **Technical Fit**: **Medium** — REST-pure, but breaks the established mutation idiom in the codebase.
- **Complexity**: **Medium** — two endpoints, two mutation hooks, race-condition mitigation logic.
- **Scalability**: **Medium** — N HTTP calls per user toggle session vs. 1.

---

### Option C (briefly considered, rejected): Hybrid — replace-all for "save" + individual for "live toggle"

Have both Option A and Option B endpoints — A for batch save flows, B for live toggling.

- **Rejected because**: violates the "Simplicity over Cleverness" and "No Premature Abstractions" Guiding Principles. Two endpoints solving overlapping problems doubles maintenance and confuses callers. We do not have evidence of two distinct user flows that need different shapes — the picker can use either pattern uniformly.

---

## Evaluation Matrix

| Criteria | Option A (Replace-all) | Option B (Individual toggle) |
|----------|------------------------|------------------------------|
| Scalability | High | Medium |
| Maintainability | High | Medium |
| Performance | High | Medium |
| Security | High | High |
| Observability | High (single event per save) | Medium (event-per-toggle flood) |
| Implementation Cost | Low | Medium |
| Optimistic-UI fit | High (mirrors `useUpdateCard`) | Medium (per-mutation snapshot) |
| Race-condition surface | None (last-write-wins) | Real (parallel toggles) |
| API surface size | 1 endpoint | 2 endpoints |
| Activity-event granularity (future) | Rich diff | Per-label spam |

---

## Observability Architecture

Label endpoints inherit the existing per-request observability wiring — no new patterns introduced.

### Logging

- **Library**: `pino v9` via `rootLogger` (`src/config/logger.ts`); child loggers per request via `createRequestContext` middleware.
- **Format**: Structured JSON with `traceId`, `spanId`, `method`, `path`, `statusCode`, `durationMs` — populated by `requestLogger` middleware.
- **Configuration**: existing `LOG_LEVEL`, `LOG_FORMAT`, `LOG_OUTPUT`, `LOG_REDACT_PATTERNS` env vars apply.

**Labels-specific log lines**:

| Event | Level | Fields |
|-------|-------|--------|
| Duplicate-name attempted | warn | `boardId`, `labelName`, `traceId` |
| Label not found in board scope | warn | `boardId`, `labelId`, `traceId` |
| Replace-all card-labels invoked | info | `cardId`, `addedCount`, `removedCount`, `traceId` |
| DB write failure | error | `operation`, `err`, `traceId` (routed through `errorHandler`) |

### Distributed Tracing

- **W3C Trace Context**: already wired in `requestContext` middleware. Label endpoints inherit `req.traceContext` and echo `traceparent` in responses. No new propagation boundaries are introduced (no new external calls, no new background work).

### Metrics

- Generic HTTP request metrics (count, duration by route) will be picked up by the future OpenTelemetry SDK wiring (deferred per `techContext.md`). No label-specific custom metrics needed at MVP scale.

### Configuration Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `LOG_LEVEL` | Log verbosity | `info` |
| `LOG_FORMAT` | json or text | `json` |
| `LOG_OUTPUT` | stdout (only option in MVP) | `stdout` |
| `LOG_REDACT_PATTERNS` | Redact field names | `password,secret,token,apiKey,authorization` |

No new environment variables are required by this feature.

---

## Decision

**Chosen**: **Option A — Replace-all endpoint** (`PUT /api/cards/:cardId/labels`).

### Rationale

1. **Mirrors the established codebase mutation idiom.** `useUpdateCard` uses a snapshot/rollback/invalidate flow against a single PATCH. The replace-all label endpoint drops into the exact same shape; a new `useAssignLabels` hook will look like a near-clone of `useUpdateCard`, which keeps the frontend mutation patterns uniform and trivial to learn.
2. **Eliminates race conditions by design.** A single request per save operation means last-write-wins is the natural semantic. The picker UI (per the UI/UX design exploration) can either commit immediately on each toggle or batch on close — either flow is one request, with no per-label ordering concerns.
3. **Single transaction, atomic state.** The repository runs `DELETE` + `INSERT … ON CONFLICT DO NOTHING` + `SELECT` inside one `BEGIN/COMMIT`. The card is never observably in a "half-assigned" state.
4. **Smaller API surface.** One route, one Zod schema, one controller method, one repository method, one frontend mutation hook. Fewer tests, fewer docs, fewer places to introduce bugs. Aligns with "Simplicity over Cleverness" and "No Premature Abstractions".
5. **Better future activity-event shape.** When a future task wires `activityService.recordEvent` into label mutations, the controller already has pre-state and post-state in scope. It emits one rich event (`{ added: [...], removed: [...] }`) per user action — matching how users think about labeling. Option B would force per-label events, which would spam the activity feed during multi-label saves.
6. **Idempotency.** Re-sending the same `labelIds` array is a safe no-op. Network retries don't require careful side-effect reasoning.

### Trade-offs Accepted

- **Slightly larger request payload for single-label toggles**: even when a user toggles one label, the request carries the full `labelIds` array. With a max of 50 label UUIDs (each ~36 chars = ~1.8 KB worst case), this is negligible — well under any practical concern.
- **All-or-nothing validation**: if the client sends an invalid label UUID, the entire request fails (400). Acceptable because the picker only surfaces valid board labels; this would only occur if a label was deleted concurrently in another tab, which is a deliberate consistency property (the client should refetch labels on 400 and retry).
- **No per-label REST semantics**: we deviate from "pure" REST resource modeling. We do this knowingly: REST purity is not a Guiding Principle in this codebase, but mutation-pattern consistency is implicitly one.

### Compliance with Guiding Principles

| Principle | How this decision complies |
|-----------|----------------------------|
| Clean Architecture | Controller → Service → Repository; no business logic in route handlers; no SQL in services. |
| Simplicity over Cleverness | One endpoint, one schema, one hook. No diff orchestration in the client. |
| No Premature Abstractions | Two repository methods for two distinct concerns (board CRUD vs. card assignment). Not abstracted into a generic "join-table manager". |
| 12-Factor Config | No new env vars; reuses existing `config` object. |
| Graceful Shutdown | No new long-lived connections or background workers introduced. |
| Optimistic UI | Replace-all shape is the cleanest fit for snapshot/rollback/invalidate in TanStack Query. |

---

## Detailed Component Specs

### Migration: `1747600006000_add-icon-to-labels.js`

```javascript
export const up = (pgm) => {
  pgm.addColumn('labels', {
    icon: { type: 'varchar(10)', notNull: false, default: null },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('labels', 'icon');
};
```

Notes:
- `varchar(10)` accommodates a single emoji character (up to a 4-byte grapheme cluster with potential ZWJ sequences); 10 chars is a generous upper bound that still bounds storage.
- Nullable with default `null` — existing rows remain valid; no backfill needed.
- The `BoardRepository.findByIdWithColumnsAndCards` query must be updated to include `'icon', l.icon` in the per-label `json_build_object` so the board-load endpoint returns icons alongside other label fields. This is a single-line change in the existing query.

---

### LabelRepository Interface

File: `backend/src/repositories/LabelRepository.ts`

```typescript
import type { Pool, PoolClient } from 'pg';

export interface LabelRow {
  id: string;
  boardId: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface LabelCreateInput {
  boardId: string;
  name: string;
  color: string;
  icon?: string | null;
}

export interface LabelUpdateInput {
  name?: string;
  color?: string;
  icon?: string | null;
}

/** Thrown by `create` and `update` when `(board_id, name)` unique constraint is violated. */
export class DuplicateLabelError extends Error {
  constructor(public readonly name: string) {
    super(`A label with name "${name}" already exists on this board`);
    this.name = 'DuplicateLabelError';
  }
}

export class LabelRepository {
  constructor(private readonly pool: Pool) {}

  /** Returns all labels for the given board, ordered by name (case-insensitive). */
  async findByBoardId(boardId: string): Promise<LabelRow[]>;

  /** Returns the label if found, or null. Used for ownership/board-scope validation. */
  async findById(labelId: string): Promise<LabelRow | null>;

  /**
   * Inserts a new label. Throws DuplicateLabelError if (boardId, name) collides.
   * Detect by catching PG error code '23505' and inspecting `constraint`.
   */
  async create(input: LabelCreateInput): Promise<LabelRow>;

  /**
   * Updates name/color/icon for an existing label. Returns the updated row, or null
   * if the label doesn't exist. Throws DuplicateLabelError on UNIQUE violation.
   */
  async update(labelId: string, input: LabelUpdateInput): Promise<LabelRow | null>;

  /**
   * Deletes the label. card_labels rows are removed by ON DELETE CASCADE.
   * Returns true if a row was deleted, false if it didn't exist.
   */
  async delete(labelId: string): Promise<boolean>;

  /** Returns the boardId of a card, or null if the card doesn't exist. */
  async getCardBoardId(cardId: string): Promise<string | null>;

  /** Returns the currently assigned label IDs for a card (used by the controller for diff logging). */
  async getAssignedLabelIds(cardId: string): Promise<string[]>;

  /**
   * Replaces the entire label set for a card in a single transaction.
   * - Validates that every labelId belongs to the card's board (throws if not).
   * - Deletes existing card_labels rows not in the new set.
   * - Inserts new card_labels rows (ON CONFLICT DO NOTHING for idempotency).
   * - Returns the resulting full label set (joined to labels table, so callers
   *   receive name/color/icon, not just IDs).
   *
   * Returns null if the card doesn't exist.
   */
  async replaceAssignments(
    cardId: string,
    labelIds: string[],
  ): Promise<LabelRow[] | null>;
}
```

**Transactional replace-all SQL** (inside `replaceAssignments`):

```sql
BEGIN;

-- Validate all labelIds belong to the card's board.
-- If labelIds is empty this returns 0; if any labelId doesn't belong to the
-- card's board, count !== labelIds.length and we throw.
SELECT COUNT(*) FROM labels l
JOIN cards c ON c.id = $1
JOIN columns col ON col.id = c.column_id
WHERE l.id = ANY($2::uuid[]) AND l.board_id = col.board_id;

DELETE FROM card_labels
WHERE card_id = $1 AND NOT (label_id = ANY($2::uuid[]));

INSERT INTO card_labels (card_id, label_id)
SELECT $1, unnest($2::uuid[])
ON CONFLICT DO NOTHING;

SELECT l.id, l.board_id, l.name, l.color, l.icon
FROM card_labels cl
JOIN labels l ON l.id = cl.label_id
WHERE cl.card_id = $1
ORDER BY LOWER(l.name);

COMMIT;
```

---

### LabelService Interface

File: `backend/src/services/LabelService.ts`

```typescript
import type { LabelRepository, LabelRow } from '../repositories/LabelRepository.js';

export class LabelService {
  constructor(private readonly repo: LabelRepository) {}

  /** GET /api/boards/:boardId/labels */
  async listForBoard(boardId: string): Promise<LabelRow[]> {
    return this.repo.findByBoardId(boardId);
  }

  /**
   * POST /api/boards/:boardId/labels
   * Throws DuplicateLabelError (from repo) on UNIQUE violation — controller maps to 409.
   */
  async createLabel(input: {
    boardId: string;
    name: string;
    color: string;
    icon?: string | null;
  }): Promise<LabelRow> {
    const trimmed = input.name.trim();
    return this.repo.create({ ...input, name: trimmed });
  }

  /**
   * PATCH /api/boards/:boardId/labels/:labelId
   * Verifies the label belongs to the supplied boardId (prevents cross-board mutation).
   * Returns null if label not found or not on the supplied board.
   */
  async updateLabel(
    boardId: string,
    labelId: string,
    input: { name?: string; color?: string; icon?: string | null },
  ): Promise<LabelRow | null> {
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) return null;
    const trimmed = input.name?.trim();
    return this.repo.update(labelId, { ...input, name: trimmed });
  }

  /**
   * DELETE /api/boards/:boardId/labels/:labelId
   * Verifies board-scope before deletion. Returns false if not found / wrong board.
   */
  async deleteLabel(boardId: string, labelId: string): Promise<boolean> {
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) return false;
    return this.repo.delete(labelId);
  }

  /**
   * PUT /api/cards/:cardId/labels
   * Replaces a card's full label set. Returns:
   *   - { cardId, boardId, labels, added, removed } on success
   *   - null if the card doesn't exist
   * The `added` and `removed` arrays leave a clean integration seam for a future
   * activity-feed task (it will pass these into activityService.recordEvent).
   */
  async replaceCardLabels(
    cardId: string,
    labelIds: string[],
  ): Promise<{
    cardId: string;
    boardId: string;
    labels: LabelRow[];
    added: string[];
    removed: string[];
  } | null> {
    const boardId = await this.repo.getCardBoardId(cardId);
    if (!boardId) return null;

    const before = await this.repo.getAssignedLabelIds(cardId);
    const result = await this.repo.replaceAssignments(cardId, labelIds);
    if (!result) return null;

    const beforeSet = new Set(before);
    const afterSet = new Set(labelIds);
    const added = labelIds.filter((id) => !beforeSet.has(id));
    const removed = before.filter((id) => !afterSet.has(id));

    return { cardId, boardId, labels: result, added, removed };
  }
}
```

---

### LabelController + CardLabelController

File: `backend/src/controllers/LabelController.ts`

Mirrors the `BoardController` / `CardController` patterns:

- All URL params validated via `z.string().uuid()`.
- Body validated via `CreateLabelSchema` / `UpdateLabelSchema` / `ReplaceCardLabelsSchema`.
- `DuplicateLabelError` caught and mapped to `409 { error: { message, traceId } }`.
- `null` from service → `404`.
- Errors propagated via `next(err)` → centralized `errorHandler`.

```typescript
// Sketch — full implementation in build phase.
export class LabelController {
  constructor(private readonly service: LabelService) {}

  list = async (req, res, next) => { /* GET /api/boards/:boardId/labels */ };
  create = async (req, res, next) => { /* POST … with DuplicateLabelError → 409 */ };
  update = async (req, res, next) => { /* PATCH … */ };
  delete = async (req, res, next) => { /* DELETE … 204 No Content */ };
}

export class CardLabelController {
  constructor(private readonly service: LabelService) {}

  replace = async (req, res, next) => {
    // PUT /api/cards/:cardId/labels
    // 1. validate cardId UUID
    // 2. validate body via ReplaceCardLabelsSchema
    // 3. const result = await service.replaceCardLabels(cardId, labelIds)
    // 4. null → 404; otherwise → 200 { labels: result.labels }
    //
    // (Future activity-event hook plugs in here as a fire-and-forget call —
    //  result.added / result.removed already contain the diff.)
  };
}
```

---

### Zod Schemas

File: `backend/src/schemas/labelSchemas.ts`

```typescript
import { z } from 'zod';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const CreateLabelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  color: z.string().regex(HEX_COLOR, 'Color must be a 6-digit hex code'),
  icon: z.string().max(10).nullable().optional(),
});
export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    color: z.string().regex(HEX_COLOR).optional(),
    icon: z.string().max(10).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateLabelInput = z.infer<typeof UpdateLabelSchema>;

export const ReplaceCardLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).max(50),
});
export type ReplaceCardLabelsInput = z.infer<typeof ReplaceCardLabelsSchema>;
```

Validation choices:
- **`name.trim().min(1)`**: rejects whitespace-only names (matches AC-ERROR-2).
- **`name.max(50)`**: matches AC-HAPPY-1 stated range (1–50 chars).
- **`color` hex regex**: protects DB from arbitrary strings (existing labels migration is permissive `text`); preset palette enforced client-side, but server still validates shape.
- **`icon.max(10)`**: bounds storage and matches migration `varchar(10)`.
- **`labelIds.max(50)`**: bounds request payload size; no card realistically needs more.

---

### Frontend DTOs

File: `frontend/src/types/api.ts` (extend existing file):

```typescript
/** POST /api/boards/:boardId/labels — request body */
export interface CreateLabelRequest {
  name: string;
  color: string;
  icon?: string | null;
}

/** PATCH /api/boards/:boardId/labels/:labelId — request body */
export interface UpdateLabelRequest {
  name?: string;
  color?: string;
  icon?: string | null;
}

/** PUT /api/cards/:cardId/labels — request body */
export interface ReplaceCardLabelsRequest {
  labelIds: string[];
}

/** PUT /api/cards/:cardId/labels — response body */
export interface ReplaceCardLabelsResponse {
  labels: Label[];
}
```

File: `frontend/src/types/domain.ts` (extend existing `Label` interface):

```typescript
export interface Label {
  id: string;
  name: string;
  color: string;
  icon?: string | null;   // NEW (nullable, optional for backwards compat in mocks/tests)
}
```

---

### Routing Layout Decision

**Decision**: **Two separate routers**, both mounted on existing prefixes.

1. **`labelsRouter`** — board-scoped CRUD:
   - File: `backend/src/routes/labels.ts`
   - Uses `Router({ mergeParams: true })` (precedent: `activityRouter`).
   - Mounted in `app.ts`: `app.use('/api/boards', labelsRouter);`
   - Routes:
     - `GET    /:boardId/labels`
     - `POST   /:boardId/labels`
     - `PATCH  /:boardId/labels/:labelId`
     - `DELETE /:boardId/labels/:labelId`

2. **Card-label assignment** — added directly to the existing `cardsRouter`:
   - File: `backend/src/routes/cards.ts` (existing file)
   - Add one line: `cardsRouter.put('/:cardId/labels', cardLabelController.replace);`
   - The existing `cardsRouter` is already mounted at `/api/cards` in `app.ts` — no new mount needed.

**Why not nest card-label assignment under a new router?** Only one route, and it already shares the `/api/cards/:cardId/...` prefix with the existing `PATCH /api/cards/:cardId` endpoint. Adding a new router for a single endpoint would introduce unnecessary indirection.

**`app.ts` change**: a single new line:

```typescript
import { labelsRouter } from './routes/labels.js';
// …
app.use('/api/boards', labelsRouter);
```

**`routes/labels.ts` wiring** (constructor DI, matches existing route modules):

```typescript
import { Router } from 'express';
import { pool } from '../config/db.js';
import { LabelRepository } from '../repositories/LabelRepository.js';
import { LabelService } from '../services/LabelService.js';
import { LabelController, CardLabelController } from '../controllers/LabelController.js';

const labelRepo = new LabelRepository(pool);
const service = new LabelService(labelRepo);
const labelController = new LabelController(service);
export const cardLabelController = new CardLabelController(service); // re-exported for cards.ts

export const labelsRouter = Router({ mergeParams: true });
labelsRouter.get('/:boardId/labels', labelController.list);
labelsRouter.post('/:boardId/labels', labelController.create);
labelsRouter.patch('/:boardId/labels/:labelId', labelController.update);
labelsRouter.delete('/:boardId/labels/:labelId', labelController.delete);
```

And `routes/cards.ts` imports `cardLabelController` from `routes/labels.ts` (mirrors how `cards.ts` already imports `activityService` from `routes/activity.ts`):

```typescript
import { cardLabelController } from './labels.js';
// …
cardsRouter.put('/:cardId/labels', cardLabelController.replace);
```

This keeps the `LabelService` singleton single-sourced (same pattern as `activityService`), avoiding divergent service instances.

---

### Activity Event Integration Seam (deferred, out of scope this task)

The spec explicitly excludes activity events for label assignment. However, the architecture is designed to make the future integration trivial:

```typescript
// Future change inside CardLabelController.replace, after res.json():
void this.activityService.recordEvent({
  boardId: result.boardId,
  cardId: result.cardId,
  eventType: 'card_labels_updated',  // new ActivityEventType variant
  payload: {
    cardTitle, // service can be extended to return this
    added: result.added,
    removed: result.removed,
  },
}).catch((err) => req.logger.warn('card_labels_updated hook failed', { err }));
```

Required changes for that future task:
1. Extend `ActivityEventType` union in `events/ActivityEventEmitter.ts` with `'card_labels_updated'`.
2. Inject `activityService` and a card title lookup into `CardLabelController` (mirroring how `CardController` does it).
3. Update the SSE consumer's activity-feed renderer to format the new event type.

No structural change to the labels architecture is required.

---

## Implementation Guidelines

1. **Migration first**: run `npm run migrate --prefix backend` after writing `1747600006000_add-icon-to-labels.js`. Verify column added and existing seed data still loads.
2. **Update `BoardRepository.findByIdWithColumnsAndCards`** to include `'icon', l.icon` in the per-label `json_build_object`. This is required so `GET /api/boards/:id` returns icons on card-attached labels.
3. **Implement bottom-up**: `LabelRepository` → `LabelService` → controllers → routes → `app.ts` mount. Write unit tests at each layer.
4. **Build Phase 1 (Label CRUD)** before Phase 2 (card-label assignment) — Phase 2 depends on `LabelRepository.findById` and `getCardBoardId` from Phase 1.
5. **Use `Router({ mergeParams: true })`** for `labelsRouter` so `req.params.boardId` is accessible to controllers.
6. **Map PG error code `'23505'`** (unique_violation) to `DuplicateLabelError` inside the repository — keep PG-specific error handling out of the service layer.
7. **Transactional `replaceAssignments`**: use a single `PoolClient` checked out for the whole transaction; release in `finally`; `ROLLBACK` on any throw. Mirror the pattern in `BoardRepository.createWithDefaultColumns`.
8. **Frontend `labelsApi.ts`** matches `boardsApi.ts` structure: a flat module of named exported functions, no class, using the shared `apiClient`.
9. **Frontend mutation hooks**: `useCreateLabel`, `useUpdateLabel`, `useDeleteLabel`, `useReplaceCardLabels` — all follow the `useUpdateCard` snapshot/rollback/invalidate template.
10. **Do not introduce abstraction for "join-table CRUD"** — the spec has exactly one join table operation (card-labels). Premature abstraction is explicitly forbidden by Guiding Principles.

---

## Validation Checklist

- [x] Meets all system requirements
- [x] Respects technical constraints (Node 20, Express 4, pg, Zod, Clean Architecture)
- [x] Addresses non-functional requirements (p95 < 200ms easily; transactional atomicity)
- [x] Technically feasible (every pattern used here exists elsewhere in the codebase)
- [x] Risks identified and acceptable (see Risk Assessment below)
- [x] Complies with all Guiding Principles in `systemPatterns.md`
- [x] Respects established patterns (Repository Pattern, Service Layer, App Factory, Optimistic UI, fire-and-forget activity hook seam)
- [x] Observability architecture defined (reuses existing `requestContext` + `requestLogger` + `errorHandler`)
- [x] Trace context propagation across all service boundaries (no new boundaries introduced)
- [x] Logging strategy consistent with observability-requirements (pino JSON, traceId, no `console.log`)
- [x] Metrics strategy follows naming conventions (inherits future OTel HTTP request metrics; no custom metrics needed)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Concurrent label deletion races with a card-label assignment (one tab deletes label X while another tab assigns it) | Low | Low | The `replaceAssignments` validation step counts matching labels; if X was deleted, the count fails and the transaction rolls back. Client receives 400, refetches labels, and retries. |
| `UNIQUE (board_id, name)` violation surfaces as a generic 500 if not specifically caught | Low | Medium | Repository catches PG error code `'23505'` and throws typed `DuplicateLabelError`; controller maps to 409 with a user-friendly message. |
| `BoardRepository.findByIdWithColumnsAndCards` is forgotten and labels lack `icon` on board load | Medium | Medium | Add an explicit reminder in Implementation Guidelines (#2); covered by an integration test that asserts `icon` is present in the response when set. |
| Frontend caches a label list that becomes stale after another user creates/deletes labels | Medium | Low | TanStack Query `staleTime` on `useLabels(boardId)` matches `useBoard` defaults; `onSettled` invalidation in mutation hooks refreshes the cache. SSE-driven realtime label sync is post-MVP. |
| `varchar(10)` is too restrictive for some emoji ZWJ sequences (e.g., family emoji with skin tones) | Low | Low | The picker UI (per UI/UX exploration) restricts input to single emoji codepoints. If a longer sequence is genuinely needed later, a single migration relaxes the column to `varchar(32)`. |
| Future activity-feed integration requires breaking changes to the service signature | Low | Low | `replaceCardLabels` already returns `{ added, removed }` — exactly what an activity event needs. No future change to the signature is anticipated. |

---

## Next Steps

1. **Build Phase 1 (per task roadmap)**: write migration `1747600006000_add-icon-to-labels.js`, update `BoardRepository.findByIdWithColumnsAndCards` query to include `icon`, implement `LabelRepository`, `LabelService`, `LabelController`, `labelsRouter`, wire in `app.ts`, write integration tests for board-scoped label CRUD (list / create / update / delete + 409 dup-name + 404 wrong-board).
2. **Build Phase 2 (per task roadmap)**: implement `CardLabelController.replace` and `LabelRepository.replaceAssignments`/`getCardBoardId`/`getAssignedLabelIds`. Wire `cardLabelController` import in `routes/cards.ts`. Write integration tests for replace-all happy path, empty array (remove all labels), invalid labelId (400), wrong-board labelId (400), card not found (404).
3. **Build Phase 3 (frontend)**: `frontend/src/api/labelsApi.ts`, `useLabels`, `useCreateLabel`, `useUpdateLabel`, `useDeleteLabel`, `useReplaceCardLabels` hooks. Wire into the card detail modal and label management UI per the UI/UX creative doc.
4. **Build Phase 4 (frontend)**: switch `BoardView` `allLabels` source from card-derived to `useLabels(boardId)`. Accessibility pass. E2E tests covering AC-HAPPY-1 through AC-HAPPY-5 and AC-ERROR-1 through AC-ERROR-3.
