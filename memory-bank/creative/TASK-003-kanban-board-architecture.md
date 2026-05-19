# Architecture Design: TASK-003 Kanban Board UI

**Created**: 2026-05-18
**Status**: DECIDED
**Decision Type**: Architecture
**Task**: TASK-003 (FEAT-003 Kanban Board UI)
**Complexity**: Level 4

## Decision Summary

| # | Question | Chosen Option | One-line rationale |
|---|----------|---------------|--------------------|
| ARCH-Q1 | Card position strategy | **A — Integer gap-1000** | Simplest sufficient option for hundreds-of-cards scale; no precision drift; renumber trigger is a rare path |
| ARCH-Q2 | Optimistic update ownership | **A — TanStack Query `onMutate`/`onError`** with **cancel-previous-on-new-drag** | Single source of truth (TQ cache); avoids double-state; no premature Zustand abstraction |
| ARCH-Q3 | Board fetch shape | **A — Single `GET /api/boards/:id` with nested JSON** | Meets p95 < 200ms; one cache key for TQ; aligns with TASK-003 spec |
| ARCH-Q4 | Board fetch SQL design | **A — Single SQL with `json_agg`** | One DB round-trip; PostgreSQL idiom; testable as a black box via repository |
| ARCH-Q5 | Route structure | **One file per entity under `/api/*`**; routes/controllers/services/repositories per entity; mounted in `app.ts` | Mirrors existing `health` pattern; no premature abstraction |
| ARCH-Q6 | Validation library | **Zod** (`zod` in backend only) | Type-safe, infers DTOs, sets up future OpenAPI; minimal install |
| ARCH-Q7 | Transaction scope | Wrap **board creation + default column seeding** and **position renumbering** in `pg` transactions; single-row card moves stay statement-level | Match scope to actual atomicity needs; avoid blanket transaction overhead |

---

## ARCH-Q1: Card Position Strategy

### Options Evaluated

**Option A — Integer gap-1000**
- Start at `1000`; append at `max(position) + 1000`; mid-insert uses `floor((before + after) / 2)`; if the gap collapses to `<= 1`, run a column-scoped renumbering pass that rewrites all rows back to `1000, 2000, 3000, ...`.
- **Pros**: Trivial SQL (`ORDER BY position`); INTEGER column type is exact and human-readable in `psql`; no precision drift; renumbering is column-scoped and infrequent.
- **Cons**: After ~10 consecutive mid-inserts between the same two cards the gap collapses and triggers renumbering. For BanyanBoard's scale (hundreds of cards per board, small teams) this is a rare path.

**Option B — NUMERIC fractional**
- Position is `NUMERIC` (PostgreSQL arbitrary precision). Mid-insert is `(before + after) / 2` with no rounding.
- **Pros**: Never needs renumbering.
- **Cons**: NUMERIC values grow in length and precision indefinitely; harder to read in `psql`; subtle bugs around `==` comparison vs floating display; not a meaningful upgrade over Option A at this scale.

**Option C — Lexicographic string (lexorank)**
- Position is a `TEXT` rank like `"u"`, `"u0"`, `"v"`, balanced à la Jira/Trello.
- **Pros**: Robust, industry-proven, no renumbering.
- **Cons**: Library or algorithm is non-trivial; tests need extensive coverage of degenerate insertions; over-engineered for "hundreds of cards" per productBrief. Violates **No Premature Abstractions** in `systemPatterns.md`.

### Decision

**Chosen**: **Option A — Integer gap-1000**.

**Rationale**:
- productBrief explicitly scopes data to "Hundreds of cards per board, tens of boards" and small teams (2–15 users). The pathological case for Option A — 10+ sequential mid-inserts between the same two cards — is statistically negligible in this usage pattern.
- INTEGER `position` keeps the SQL plan trivial: `WHERE column_id = $1 ORDER BY position` against the `idx_cards_column_position` btree index. The p95 < 200ms NFR is easily achievable.
- Matches the **Simplicity over Cleverness** and **No Premature Abstractions** guiding principles. Option B and C exist primarily to defend against scale that BanyanBoard explicitly does not target.
- The renumbering path is column-scoped, runs inside a transaction (see ARCH-Q7), and only fires when `Math.abs(after - before) <= 1`. Worst-case cost is `O(n)` for one column (~tens to hundreds of rows) — well within latency budget.

**Implementation notes**:
- Migration: `cards.position INTEGER NOT NULL` (NOT `NUMERIC` — overrides the provisional schema in TASK-003.md).
- Initial seed: cards in a fresh column get positions `1000, 2000, 3000, ...` from the seed script.
- New card append: `INSERT ... position = (SELECT COALESCE(MAX(position), 0) + 1000 FROM cards WHERE column_id = $1)`.
- Cross-column move to a specific slot: client sends an explicit `position` integer; the server trusts it (clamp logic optional but not required for MVP).
- Mid-insert (between cards with positions `a` and `b`):
  - If `Math.abs(b - a) > 1`: `position = floor((a + b) / 2)` — single statement, no transaction.
  - Else: trigger column-scoped renumber inside a transaction (see ARCH-Q7).
- Config knob: add `CARD_POSITION_GAP` to `config.cards.positionGap` via `optionalIntEnv()` (default `1000`) — `12-Factor Config` compliance.

---

## ARCH-Q2: Optimistic Update Architecture

### Options Evaluated

**Option A — TanStack Query `onMutate` / `onError` rollback**
- The mutation `onMutate` callback (a) cancels in-flight `useBoard(id)` queries via `queryClient.cancelQueries`, (b) snapshots current cache data via `queryClient.getQueryData`, (c) writes the optimistic next-state via `queryClient.setQueryData`, and (d) returns the snapshot as the mutation context. `onError` restores from context; `onSettled` triggers a refetch.
- **Pros**: One source of truth (the TanStack Query cache). No extra Zustand slice. Idiomatic TQ pattern documented by TanStack. The card-count badges in `Column` derive from `column.cards.length` so badges update automatically when the cache changes.
- **Cons**: Rollback context must be plumbed through correctly. Rapid drags need explicit handling (see below).

**Option B — Zustand "in-flight" overlay**
- A separate Zustand slice tracks `inFlightMoves: Record<cardId, { from, to, position }>`. Components merge cache state with overlay on render. On settle, the overlay entry is cleared.
- **Pros**: Conceptually clean separation; explicit pending vs confirmed state.
- **Cons**: Two sources of truth; double-rendering complexity; merge logic must be written and tested; existing `appStore.ts` only holds UI state (sidebar collapsed, active board ID), not domain data — introducing domain data there breaks the established pattern; violates **No Premature Abstractions**.

### Rapid Sequential Drag Handling

Three handling strategies were considered:

1. **Debounce drops** — accumulate moves over a 200 ms window. Rejected: a drop is a user-explicit commit; debouncing introduces UI lag and fights the optimistic-instant feel.
2. **Queue mutations serially** — wait for the previous PATCH before sending the next. Rejected: serializing introduces latency the user can feel.
3. **Cancel-previous-on-new-drag** — when a new drag starts (`onDragStart`), abort the most recent in-flight mutation via `AbortController`; the optimistic cache state is already correct because each `onMutate` runs synchronously against the latest cache, so a cancelled prior mutation simply doesn't write its server response back. Selected.

### Decision

**Chosen**: **Option A — TanStack Query `onMutate`/`onError`**, with **cancel-previous-on-new-drag** for rapid sequential drags.

**Rationale**:
- TASK-003 is FEAT-003 of an MVP. The codebase has zero domain state in Zustand today (only `activeBoardId` and `sidebarCollapsed`). Introducing a domain-state Zustand slice for one feature is premature.
- TQ's `setQueryData` mutates the cache for the exact query key (`['board', boardId]`) that `BoardView` already subscribes to via `useBoard(id)`. Re-renders cascade naturally with no extra wiring.
- The cancel-previous strategy uses an `AbortController` stored in a `useRef` inside the `useMoveCard()` hook. It does not require a shared mutation manager.

**Implementation notes**:

```ts
// frontend/src/hooks/useMoveCard.ts (sketch)
export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async (input: MoveCardInput) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      return apiClient.patch<Card>(`/api/cards/${input.cardId}`, {
        columnId: input.toColumnId,
        position: input.position,
      }, { signal: controller.signal });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['board', boardId] });
      const previous = queryClient.getQueryData<Board>(['board', boardId]);
      if (previous) {
        queryClient.setQueryData<Board>(['board', boardId], applyMoveOptimistic(previous, input));
      }
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['board', boardId], context.previous);
      }
      // Filter out AbortError — that's a user-initiated cancel, not a real failure.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        // surface via toast/inline indicator (UX-Q5)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });
}
```

- `applyMoveOptimistic(board, input)` is a pure function: removes card from source column, inserts into target column at the new `position`, returns a new `Board` object. Unit-testable in isolation.
- `useCreateCard()` follows the same pattern (no abort needed — adds are not undone by a subsequent add).
- AbortError is filtered in `onError` so a user-driven cancel does not trigger the UX-Q5 error indicator.

---

## ARCH-Q3: Board Fetch Strategy

### Options Evaluated

**Option A — Single `GET /api/boards/:id` returns fully nested JSON**
- Server returns `{ id, name, columns: [{ id, name, position, cards: [{ ..., labels: [...] }] }], createdAt, updatedAt }` in one response.
- **Pros**: One HTTP round-trip; one TanStack Query cache entry (`['board', id]`); optimistic-update math operates on one document; meets p95 < 200ms NFR with comfortable margin; matches the existing `domain.ts:Board` shape.
- **Cons**: Larger response payload (one board with ~hundreds of cards is still well under 100 KB at MVP scale).

**Option B — Separate `GET /boards/:id`, `GET /boards/:id/columns`, `GET /boards/:id/cards` requests**
- Frontend fetches each tier in sequence or parallel.
- **Pros**: Granular cache invalidation per resource (e.g., refetch only cards on move).
- **Cons**: Three round-trips → minimum total latency is `max(t1, t2, t3) + serial deps`; combinatorial cache invalidation logic on every mutation; complicates optimistic UI because three queries need coordinated updates; productBrief NFR is page-load < 2s — a 3-tier waterfall on cold cache eats budget.

### Decision

**Chosen**: **Option A — Single nested JSON response**.

**Rationale**:
- Aligns with the **Single Round-Trip Board Fetch** principle in TASK-003.md's Architectural Plan and the system pattern "Board Load" data-flow already documented in `systemPatterns.md`.
- TanStack Query treats the board as one cached document under `['board', boardId]`. Optimistic updates from card moves write into this single cache entry — no fan-out coordination.
- At MVP scale the entire response (3 columns × ~30 cards × ~200 bytes JSON each) is ~20 KB uncompressed. Network is not the bottleneck.
- A single SQL query (ARCH-Q4) is faster than three sequential queries even before the network cost is added.
- Future granular invalidation is still possible by mixing `setQueryData` (in-place mutation) with `invalidateQueries` (full refetch). Option A does not box us out of that.

---

## ARCH-Q4: SQL Query Design

### Options Evaluated

**Option A — Single SQL with nested `json_agg`**
- One PostgreSQL query joins `boards → columns → cards → card_labels → labels` and uses `json_agg` to roll cards under their column and labels under their card. Result is a single row with a JSON document mirroring the `Board` shape.
- **Pros**: One DB round-trip; PostgreSQL idiomatic; the join is on indexed FKs; testable as a black-box via `findByIdWithColumnsAndCards()` in the repository; no service-layer assembly code.
- **Cons**: SQL is denser; requires correlated subqueries or LATERAL joins for clean cards-per-column ordering.

**Option B — Two SQL statements assembled in service layer**
- One query for the board + columns; one query for all cards (with labels) for those column IDs. Service joins in TypeScript.
- **Pros**: Each SQL statement is small and individually readable.
- **Cons**: Two DB round-trips; TypeScript-side join is a duplication of work the DB does well; assembly logic must be tested separately; risk of N+1 if implemented naïvely.

**Option C — Three SQL statements + service assembly**
- One query each for board, columns, cards. Service builds the tree.
- **Pros**: Each statement is trivial.
- **Cons**: Three round-trips; the same assembly burden as Option B with more failure modes; explicitly rejected in TASK-003's plan.

### Decision

**Chosen**: **Option A — Single SQL with nested `json_agg`**.

**SQL sketch**:

```sql
-- BoardRepository.findByIdWithColumnsAndCards(boardId)
SELECT
  b.id,
  b.name,
  b.created_at  AS "createdAt",
  b.updated_at  AS "updatedAt",
  COALESCE(
    (
      SELECT json_agg(col_obj ORDER BY col_obj->>'position')
      FROM (
        SELECT json_build_object(
          'id',       c.id,
          'boardId',  c.board_id,
          'name',     c.name,
          'position', c.position,
          'cards', COALESCE(
            (
              SELECT json_agg(card_obj ORDER BY (card_obj->>'position')::int)
              FROM (
                SELECT json_build_object(
                  'id',          ca.id,
                  'columnId',    ca.column_id,
                  'title',       ca.title,
                  'description', ca.description,
                  'dueDate',     ca.due_date,
                  'position',    ca.position,
                  'createdAt',   ca.created_at,
                  'updatedAt',   ca.updated_at,
                  'labels', COALESCE(
                    (
                      SELECT json_agg(json_build_object(
                        'id',    l.id,
                        'name',  l.name,
                        'color', l.color
                      ))
                      FROM card_labels cl
                      JOIN labels l ON l.id = cl.label_id
                      WHERE cl.card_id = ca.id
                    ),
                    '[]'::json
                  )
                ) AS card_obj
                FROM cards ca
                WHERE ca.column_id = c.id
              ) sub_cards
            ),
            '[]'::json
          )
        ) AS col_obj
        FROM columns c
        WHERE c.board_id = b.id
      ) sub_cols
    ),
    '[]'::json
  ) AS columns
FROM boards b
WHERE b.id = $1;
```

The repository wraps this in `findByIdWithColumnsAndCards(boardId)` and returns `Board | null`. The shape returned matches `domain.ts:Board` exactly.

**Rationale**:
- Single round-trip aligns with p95 < 200ms NFR. On localhost against PostgreSQL 15 with indexed FKs, the query executes in <10 ms for MVP-scale data.
- `json_agg(... ORDER BY ...)` keeps column ordering and card ordering server-side, removing client-side sorting code.
- `COALESCE(..., '[]'::json)` ensures empty arrays (not `null`) for cards with no labels and columns with no cards — directly satisfies the `domain.ts` types which mandate `Card[]` and `Label[]`.
- Testability is preserved: `boards.test.ts` integration tests insert known fixtures, call `GET /api/boards/:id`, and assert the JSON tree matches. No mocking needed; the SQL is the contract.
- Index requirements: `idx_cards_column_position` on `cards(column_id, position)` (already planned in TASK-003.md Phase 1), `columns(board_id)` automatic via FK, `card_labels(card_id)` automatic via PK.

---

## ARCH-Q5: Route Structure

### Decision

**Route mount** (in `backend/src/app.ts`):

```ts
import { boardsRouter } from './routes/boards.js';
import { columnsRouter } from './routes/columns.js';
import { cardsRouter } from './routes/cards.js';

// ... existing middleware ...
app.use(express.json());
app.use('/health', healthRouter);
app.use('/api/boards', boardsRouter);
app.use('/api/columns', columnsRouter);
app.use('/api/cards', cardsRouter);
// 404 fallback + errorHandler unchanged
```

**File structure**:

```
backend/src/
├── routes/
│   ├── health.ts             (existing)
│   ├── boards.ts             — GET /, GET /:id
│   ├── columns.ts            — POST /:columnId/cards   (nested-resource path)
│   └── cards.ts              — PATCH /:cardId
├── controllers/
│   ├── HealthController.ts   (existing)
│   ├── BoardController.ts
│   ├── ColumnController.ts
│   └── CardController.ts
├── services/
│   ├── HealthService.ts      (existing)
│   ├── BoardService.ts       — createBoard() seeds 3 default columns
│   ├── ColumnService.ts
│   └── CardService.ts
├── repositories/
│   ├── HealthRepository.ts   (existing)
│   ├── BoardRepository.ts    — findAll(), findByIdWithColumnsAndCards(), create()
│   ├── ColumnRepository.ts   — findByBoardId(), createMany()
│   └── CardRepository.ts     — create(), move(), update(), renumberColumn()
└── schemas/                  — NEW directory for Zod schemas (ARCH-Q6)
    ├── cardSchemas.ts        — CreateCardSchema, UpdateCardSchema
    └── boardSchemas.ts       — (placeholder for future POST /api/boards)
```

**Routing details**:

| File | Mount prefix | Routes |
|------|---|---|
| `boards.ts` | `/api/boards` | `GET /` (list); `GET /:id` (full board) |
| `columns.ts` | `/api/columns` | `POST /:columnId/cards` (create card under a column) |
| `cards.ts` | `/api/cards` | `PATCH /:cardId` (update — primarily for move) |

Each router instantiates its layers using the existing health pattern (manual constructor wiring):

```ts
// backend/src/routes/boards.ts
import { Router } from 'express';
import { pool } from '../config/db.js';
import { BoardRepository } from '../repositories/BoardRepository.js';
import { ColumnRepository } from '../repositories/ColumnRepository.js';
import { BoardService } from '../services/BoardService.js';
import { BoardController } from '../controllers/BoardController.js';

const boardRepo = new BoardRepository(pool);
const columnRepo = new ColumnRepository(pool);
const service = new BoardService(boardRepo, columnRepo);
const controller = new BoardController(service);

export const boardsRouter = Router();
boardsRouter.get('/', controller.list);
boardsRouter.get('/:id', controller.getById);
```

**Rationale**:
- **Mirrors existing `health.ts` pattern** exactly — same constructor wiring, same router export. No new infrastructure or DI container introduced (No Premature Abstractions).
- One file per entity scales to ~3 entities cleanly without grouping; if FEAT-004 adds another (e.g., `labels.ts`) the pattern remains stable.
- The `POST /api/columns/:columnId/cards` nested-resource path lives in `columns.ts` (not `cards.ts`) because the URL is rooted at `/api/columns`. This is consistent REST design and keeps each router's URL space contiguous.
- Pool injection (`new BoardRepository(pool)`) replaces the no-arg `HealthRepository()` because the existing health repo is a stub. The pattern of injecting `pool` keeps repositories testable (a test can pass a mocked pool).
- The `schemas/` directory is new but follows established naming (`config/`, `middleware/`, etc.).
- Layering test (`layering.test.ts`) automatically covers the new controllers because it scans `src/controllers/*.ts`.

---

## ARCH-Q6: Validation Library

### Decision

**Chosen**: **Zod** (`zod` v3 — backend only).

**Installation**:
```bash
npm install zod --prefix backend
```
No frontend install. Frontend continues to consume TypeScript types from `domain.ts` and `api.ts` directly; runtime validation at the API boundary is the server's responsibility, not the client's.

**Rationale**:
- **TypeScript alignment**: Zod's `z.infer<typeof Schema>` produces a static type matching the runtime schema. Define once, use everywhere — eliminates the drift between hand-rolled type guards and the inferred types.
- **Future OpenAPI**: Zod-to-OpenAPI tooling (`@asteasolutions/zod-to-openapi`) is mature and can generate OpenAPI 3.x specs from the same schemas. The "post-MVP OpenAPI" task noted in TASK-003.md becomes a near-trivial migration.
- **Maintenance**: A single ~80 KB dependency replaces hand-rolled guards across 2 endpoints today and N endpoints later. Hand-rolled validators would balloon as FEAT-004/005 add card-detail, label, and filter endpoints.
- **Rejected alternatives**:
  - **Hand-rolled validators**: zero new deps, but every endpoint needs its own validator with no type inference. Error messages are inconsistent. Violates DRY as endpoint count grows.
  - **Express-validator**: middleware-style, but loosely typed (returns `string | undefined` for fields); poor TS DX; less aligned with the codebase's TS-first ethos.
- Two-entity scope today, but the **3+ rule** in `systemPatterns.md` for premature abstractions applies to *abstractions we author*, not to mainstream libraries that already exist. Zod is a tool, not an abstraction.

**Usage pattern**:

```ts
// backend/src/schemas/cardSchemas.ts
import { z } from 'zod';

export const CreateCardSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});
export type CreateCardInput = z.infer<typeof CreateCardSchema>;

export const UpdateCardSchema = z
  .object({
    title:       z.string().min(1).max(500).optional(),
    description: z.string().max(10_000).nullable().optional(),
    dueDate:     z.string().datetime({ offset: true }).nullable().optional(),
    columnId:    z.string().uuid().optional(),
    position:    z.number().int().nonnegative().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
```

```ts
// backend/src/controllers/CardController.ts (sketch)
patch = async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateCardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { message: 'Invalid request', issues: parsed.error.issues, traceId: req.traceContext.traceId },
    });
    return;
  }
  const updated = await this.service.updateCard(req.params.cardId, parsed.data);
  if (!updated) {
    res.status(404).json({ error: { message: 'Card not found', traceId: req.traceContext.traceId } });
    return;
  }
  res.status(200).json(updated);
};
```

UUID path params (`:cardId`, `:columnId`, `:id`) are validated inline with `z.string().uuid().safeParse(req.params.cardId)` at the top of each handler — keeps validation co-located.

---

## ARCH-Q7: Transaction Scope

### Decision

**Needs transaction** (`pg` `client.query` with explicit `BEGIN`/`COMMIT`/`ROLLBACK`):

1. **Board creation + default column seeding** (`BoardService.createBoard()`)
   - 1 `INSERT INTO boards` + 3 `INSERT INTO columns`.
   - Atomicity required: a board with zero columns is an invalid state (the UI cannot render "no columns" as anything other than a bug). If column seeding fails, the board insert must be rolled back.

2. **Column-scoped position renumber** (`CardRepository.renumberColumn()`, triggered when a mid-insert gap collapses — see ARCH-Q1)
   - Single `UPDATE` statement using a window function (`ROW_NUMBER() OVER (ORDER BY position) * 1000`).
   - Wrapped in a transaction because the renumber is part of a move operation that *also* updates the moved card's `column_id` — both must succeed together, or neither.

**Single statement (no transaction needed)**:

- **Card move (no renumber)** — `UPDATE cards SET column_id = $1, position = $2, updated_at = now() WHERE id = $3 RETURNING *`. One row, one statement, PostgreSQL's per-statement implicit transaction is sufficient.
- **Card create** — `INSERT INTO cards (...) VALUES (...) RETURNING *`. One row, one statement.
- **Card field updates** (title/description/dueDate) — single `UPDATE`.
- **Board list / board read** — read-only single SELECT.

**Implementation pattern** (`pg` client transaction):

```ts
// backend/src/repositories/_transaction.ts (small helper — note this is a single use site today; promoted to a helper only if a 3rd transactional operation appears, per No Premature Abstractions)
import type { Pool } from 'pg';

export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

```ts
// backend/src/services/BoardService.ts (sketch)
async createBoard(input: CreateBoardInput): Promise<Board> {
  return withTransaction(this.pool, async (client) => {
    const board = await this.boardRepo.createWithClient(client, input);
    await this.columnRepo.createManyWithClient(client, board.id, DEFAULT_COLUMNS);
    return this.boardRepo.findByIdWithColumnsAndCardsClient(client, board.id);
  });
}
```

**FEAT-003 transaction call sites**:

| Operation | Transaction? | Why |
|---|---|---|
| `POST /api/boards` (future, but scaffolded by Phase 1 seeded board) | Yes | INSERT board + 3 INSERT columns |
| `GET /api/boards`, `GET /api/boards/:id` | No | Read-only single SELECT |
| `POST /api/columns/:columnId/cards` | No | Single INSERT |
| `PATCH /api/cards/:id` (move, no renumber) | No | Single UPDATE |
| `PATCH /api/cards/:id` (move, renumber required) | **Yes** | Renumber UPDATE + move UPDATE must be atomic |
| `PATCH /api/cards/:id` (field edits) | No | Single UPDATE |

**Rationale**: This scopes transactions to the *minimum* set needed for correctness. We do not wrap every write in a transaction (which would add lock contention and serialization overhead for no benefit) and we do not omit transactions where multi-row atomicity is required (which would risk inconsistent state).

The renumber path is the only FEAT-003 PATCH that needs a transaction, and it is only entered when `Math.abs(after - before) <= 1`. The service layer decides whether to take the renumber branch based on the current gap; the controller is unaware of this distinction.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Position renumber path is buggy (rare, hard to trigger in dev) | Medium | High | Add a backend test that seeds two cards with positions 1 and 2, attempts a mid-insert, and asserts the column was renumbered and the inserted card has a non-conflicting position. Document the trigger condition in the SQL comment. |
| `json_agg` query is hard to debug if a column is wrong | Low | Medium | Integration test asserts the full JSON tree against a fixture board. The test is the executable spec. |
| Optimistic update math (`applyMoveOptimistic`) drifts from server behavior | Medium | Medium | Pure-function unit test covers cross-column move, same-column reorder, append at end, insert at start. Each case maps to an integration test on the server. |
| Cancel-previous-on-new-drag drops a server-confirmed state inappropriately | Low | Medium | `onSettled` always invalidates the query, so the next refetch reconciles. Worst case: a brief flicker on rapid re-drags, which is acceptable. |
| Zod schema and TypeScript domain types drift apart | Low | Low | DTO types are inferred from schemas (`z.infer`); drift requires deliberate effort. Add one test per endpoint that round-trips a fixture payload through `safeParse` to lock the contract. |
| Backend transaction helper grows into a clever abstraction | Low | Low | Inline the BEGIN/ROLLBACK pattern in `BoardService.createBoard()` the first time; extract `withTransaction` only when the second call site arrives. The helper sketched above is a template, not a mandate. |
| Single nested `json_agg` query exceeds 200 ms p95 under unexpected load | Low | Medium | Index on `cards(column_id, position)` already planned. EXPLAIN ANALYZE during Phase 2 should confirm. If it ever fails, fall back to Option B (two-query assembly) without changing the API contract. |

---

## Impact on Implementation Phases

| Phase (from TASK-003.md) | Decisions applied |
|---|---|
| **Phase 1 — DB Schema + Migrations** | ARCH-Q1: `cards.position` is `INTEGER` (not `NUMERIC`). Index `idx_cards_column_position` confirmed. ARCH-Q5: no schema changes. ARCH-Q7: seed script and board-create endpoint use the `withTransaction` pattern. |
| **Phase 2 — Backend REST API** | ARCH-Q3: single `GET /api/boards/:id` endpoint shape. ARCH-Q4: `BoardRepository.findByIdWithColumnsAndCards()` uses the `json_agg` query above. ARCH-Q5: routes/controllers/services/repositories per entity; mounted at `/api/boards`, `/api/columns`, `/api/cards`. ARCH-Q6: install Zod; schemas in `backend/src/schemas/`. ARCH-Q7: transaction only on `BoardService.createBoard()` and the renumber branch of `CardService.moveCard()`. |
| **Phase 3 — Frontend BoardView + Card Rendering** | ARCH-Q3 enables a single `useBoard(id)` query (`['board', boardId]` cache key). No multi-query coordination. Components subscribe to one query. |
| **Phase 4 — DnD + Optimistic Updates + Rollback** | ARCH-Q2: `useMoveCard()` follows the sketch above (TQ-only state, `AbortController` ref for cancel-previous). Pure `applyMoveOptimistic()` helper is unit-tested. AbortError filtered from the UX-Q5 error indicator. |
| **Phase 5 — Add-Card Affordance** | ARCH-Q2: `useCreateCard()` reuses the TQ optimistic pattern without abort. ARCH-Q6: `CreateCardSchema` validates the POST body. |

**No phase reordering required.** The 5-phase plan in TASK-003.md remains valid; this document specifies the *content* of each phase rather than re-sequencing them.

---

## Validation Checklist

- [x] Meets all system requirements stated in TASK-003 specification.
- [x] Respects technical constraints (Express/pg/TS/PostgreSQL 15; node-pg-migrate v7).
- [x] Addresses NFRs: p95 < 200ms (single-query board fetch + indexed move); page load < 2s (single round-trip); drag feels instant (TQ optimistic update).
- [x] Technically feasible — every decision uses already-available primitives (`pg.Pool`, `pg.PoolClient`, TanStack Query v5 `useMutation`, Zod v3).
- [x] Risks identified and accepted (see Risk Assessment).
- [x] Complies with Guiding Principles in `systemPatterns.md`:
  - Clean Architecture — controllers/services/repositories per entity; layering test continues to enforce.
  - Simplicity over Cleverness — integer positions, single mutation hook, no DI container.
  - No Premature Abstractions — Zustand domain slice rejected; `withTransaction` helper only created if reused.
  - 12-Factor Config — `CARD_POSITION_GAP` via `optionalIntEnv()`.
  - Optimistic UI — chosen pattern (Option A) explicitly implements this principle.
- [x] Respects established patterns: app factory, repository, service-layer, structured logging, request context middleware.
- [x] Observability inherited: every new controller receives `req.logger` with traceId/spanId; no new env vars required for FEAT-003.

---

## Completion Signal

ARCHITECTURE CREATIVE COMPLETE
Document: `memory-bank/creative/TASK-003-kanban-board-architecture.md`
Decision: Integer gap-1000 positions + TanStack Query optimistic updates with cancel-previous + single nested `json_agg` board fetch + per-entity Clean Architecture under `/api/*` + Zod validation + scoped transactions only for board-creation and position-renumber paths.
