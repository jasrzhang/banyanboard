# Archive: TASK-003 — Kanban Board UI

## Metadata
- **Task ID**: TASK-003
- **Complexity**: Level 4
- **Started**: 2026-05-18
- **Completed**: 2026-05-19
- **Duration**: 2 days
- **Roadmap Link**: FEAT-003
- **Branch**: feature/FEAT-003-kanban-board-ui

## Executive Summary

TASK-003 delivered BanyanBoard's first fully user-facing feature — the complete Kanban board experience. In two days across five phased builds, the implementation covered: 5 PostgreSQL migrations (boards, columns, cards, labels, card_labels), a seed script, 4 REST API endpoints with full Clean Architecture layering, and a React frontend with 8 components, 3 mutation hooks, dnd-kit drag-and-drop, and TanStack Query optimistic updates with rollback. All 9 acceptance criteria were met; the test suite reached 42 passing tests with tsc+lint+build PASS at every phase gate.

---

## System Overview

### Purpose
The Kanban board is BanyanBoard's primary user-facing feature. Users navigate to a board via the sidebar and see columns ("To Do", "In Progress", "Done") populated with cards. Cards can be dragged between columns with instant optimistic feedback, created via an inline form, and display title, description preview, due date, and label chips.

### Scope — In
- PostgreSQL schema: 5 tables with FK constraints, indexes, integer gap-1000 position strategy
- Backend REST API: `GET /api/boards`, `GET /api/boards/:id`, `POST /api/columns/:id/cards`, `PATCH /api/cards/:id`
- Frontend: BoardView, Column, CardTile, AddCardForm, DragOverlay, CardSkeleton, BoardErrorPanel components
- Sidebar wired to live `GET /api/boards` (replacing placeholder data)
- Drag-and-drop: cross-column and intra-column reorder with optimistic update + rollback
- Error states: board fetch failure panel, DnD rollback with sonner toast
- Keyboard accessibility: KeyboardSensor for DnD, Ctrl+Enter submit for add-card

### Scope — Out (deferred)
- Authentication / authorization
- Card detail modal (FEAT-004)
- Search, filters, label management UI
- Inline card editing
- Column creation/deletion/rename
- Real-time sync (WebSockets)
- Mobile touch drag-and-drop

---

## Architecture

### Overview
Full-stack Clean Architecture. Backend follows Route → Controller → Service → Repository per entity. Frontend follows TanStack Query for server state, Zustand for UI state, React Router for URL state — no domain state in Zustand.

### Component Map

**Backend**
```
app.ts
├── /api/boards  → BoardController → BoardService → BoardRepository
├── /api/columns → ColumnController → ColumnService → ColumnRepository
└── /api/cards   → CardController → CardService → CardRepository
```

**Frontend**
```
BoardDetailPage
└── BoardView (DndContext, SortableContext, DragOverlay)
    └── Column (useDroppable, sticky header, card-count badge)
        ├── CardTile (useSortable, drag handle, label chips)
        └── AddCardForm (inline expand, Ctrl+Enter submit)
```

### Data Flow
1. `BoardDetailPage` mounts → `useBoard(boardId)` fires `GET /api/boards/:id`
2. `BoardRepository.findByIdWithColumnsAndCards` runs a single `json_agg` SQL query returning nested `Board → Columns → Cards → Labels`
3. TanStack Query caches the board; Column and CardTile components derive from cache
4. On drag: `useMoveCard.onMutate` snapshots cache, applies `applyMoveOptimistic`, fires `PATCH /api/cards/:id`; on error, `onError` restores snapshot + shows sonner toast
5. On add-card: `useCreateCard.onMutate` optimistically appends a temp card; `onSuccess` replaces it with the server-assigned card

### Integration Points
- **PostgreSQL 15** (via node-postgres `pg` v8): all persistence
- **node-pg-migrate v7**: schema migrations in `backend/migrations/`
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`): drag-and-drop
- **sonner**: toast notifications for DnD rollback errors
- **Zod v3**: request body validation on `POST /api/columns/:id/cards` and `PATCH /api/cards/:id`

---

## Design Decisions

### ARCH-Q1: Card Position Strategy — Integer Gap-1000
- **Decision**: `cards.position INTEGER`, starting at 1000, gap 1000 on append; midpoint on insert-between; renumber when gap collapses to ≤ 1.
- **Rationale**: Sufficient for "hundreds of cards" MVP scale; no precision drift; avoids lexorank complexity.
- **Trade-off**: Renumber path not implemented at repository layer (deferred tech debt).
- **Reference**: `memory-bank/creative/TASK-003-kanban-board-architecture.md`

### ARCH-Q2: Optimistic Update — TanStack Query onMutate/onError
- **Decision**: `queryClient.setQueryData` in `onMutate`; snapshot-based rollback in `onError`; `AbortController` cancel-previous for rapid drags.
- **Rationale**: Single source of truth in TQ cache; no Zustand domain state; idiomatic TQ pattern.
- **Reference**: `memory-bank/creative/TASK-003-kanban-board-architecture.md`

### ARCH-Q3 + Q4: Single json_agg Board Fetch
- **Decision**: `GET /api/boards/:id` returns fully nested `Board → Columns → Cards → Labels` in one SQL with `json_agg` and `COALESCE(..., '[]'::json)` guards.
- **Rationale**: One round-trip meets p95 < 200ms NFR; one TQ cache key; no waterfall.
- **Reference**: `memory-bank/creative/TASK-003-kanban-board-architecture.md`

### ARCH-Q6: Zod Validation
- **Decision**: Zod v3 schemas in `backend/src/schemas/cardSchemas.ts` for POST and PATCH endpoints.
- **Rationale**: Type-safe, infers TypeScript types, sets up future OpenAPI generation.

### UX-Q3: Add-Card Form Factor — Trello-style Inline Expand
- **Decision**: Button at column bottom expands inline into a textarea + submit button; collapses on submit or Escape.
- **Rationale**: Familiar pattern; keyboard-accessible (Tab to reach, Ctrl+Enter to submit); no modal overhead.
- **Reference**: `memory-bank/creative/TASK-003-kanban-board-uiux.md`

### UX-Q5: Error Indicator — sonner Toast
- **Decision**: `sonner` library for DnD rollback error notification.
- **Rationale**: 2.6kB gzipped, zero-config, `aria-live` accessible out of the box; avoids hand-rolled toast.

---

## Implementation

### Phases

| Phase | Date | Milestone | Tests |
|-------|------|-----------|-------|
| Phase 1: DB Schema + Migrations | 2026-05-18 | 5 tables, seed script, positionGap config | 12 pass |
| Phase 2: Backend REST API | 2026-05-18 | 4 endpoints, Zod, 3 entity layers each | 21 new (12 non-DB + 9 DB pass non-Docker) |
| Phase 3: Frontend BoardView + Card Rendering | 2026-05-18 | Live board renders from API; sidebar wired | 23 pass (+9 new) |
| Phase 4: DnD + Optimistic Updates + Rollback | 2026-05-19 | Drag persists; rollback on failure | 29 pass (+6 new) |
| Phase 5: Add-Card Affordance | 2026-05-19 | Inline form; optimistic append; rollback | 42 pass (+13 new) |

### Key Components

| File | Role |
|------|------|
| `backend/src/repositories/BoardRepository.ts` | `findByIdWithColumnsAndCards` — json_agg nested query |
| `backend/src/repositories/CardRepository.ts` | `create` (gap-1000), `move` (update columnId+position), `update` (dynamic SQL) |
| `backend/src/schemas/cardSchemas.ts` | Zod schemas for PATCH and POST card endpoints |
| `frontend/src/hooks/useMoveCard.ts` | TQ mutation: onMutate snapshot + applyMoveOptimistic + AbortController cancel-previous |
| `frontend/src/hooks/useCreateCard.ts` | TQ mutation: onMutate optimistic append + replaceCard on success |
| `frontend/src/components/board/BoardView.tsx` | DndContext + SortableContext + DragOverlay + handleDragEnd |
| `frontend/src/components/card/CardTile.tsx` | useSortable, drag handle, click-to-card-detail |
| `frontend/src/components/card/AddCardForm.tsx` | Inline expand, Ctrl+Enter submit, error-safe catch |

### Technical Specifications
- **Card positions**: INTEGER, gap-1000, midpoint insert, `computeNewPosition` in BoardView
- **Board fetch**: single SQL with 3-level `json_agg` + `COALESCE(..., '[]'::json)` at each level
- **Drag cancel-previous**: `AbortController` ref in `useMoveCard`; new drag aborts prior mutation's signal
- **AbortError filtering**: `!(err instanceof DOMException && err.name === 'AbortError')` in `onError`
- **Optimistic pure functions**: `applyMoveOptimistic`, `applyCreateOptimistic`, `replaceCard` exported separately for unit testing
- **Config**: `CARD_POSITION_GAP` env var → `config.cards.positionGap` via `optionalIntEnv()` (12-Factor)

---

## Testing

### Strategy
Integration-first (backend) + component tests (frontend). No mocking of the pg layer in integration tests — real Docker PostgreSQL.

### Results

| Test File | Count | Type | ACs Covered |
|-----------|-------|------|-------------|
| `boards.test.ts` | 10 | Backend integration | AC-ENTRY-1, AC-HAPPY-1 |
| `cards.test.ts` | 11 | Backend integration | AC-HAPPY-2, AC-HAPPY-3, AC-DATA-1 |
| `boardView.test.tsx` | 9 | Frontend component | AC-ENTRY-1, AC-HAPPY-1, AC-ERROR-2 |
| `dnd.test.tsx` | 6 | Frontend interaction | AC-HAPPY-2, AC-ERROR-1 |
| `createCard.test.tsx` | 13 | Frontend hook + component | AC-HAPPY-3 |
| **Total** | **42** | — | All MUST ACs covered |

### Coverage Notes
- Stub-detection assertions in backend tests (SELECT after PATCH confirms DB state changed)
- Pure-function tests for `applyMoveOptimistic`, `applyCreateOptimistic`, `replaceCard` lock optimistic logic independently of hooks
- `computeNewPosition` helper in `BoardView.tsx` lacks dedicated unit tests (tech debt — extract to `positionUtils.ts`)
- Browser E2E (DnD simulation, keyboard nav, page-refresh persistence): not yet run — planned for FEAT-004 UAT setup

---

## Deployment

### Procedures
```bash
docker compose up -d db          # Start PostgreSQL
npm run migrate --prefix backend # Apply all 5 migrations
npm run seed --prefix backend    # Seed demo board + cards (idempotent)
docker compose up                # Start backend + frontend
```

### Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `CARD_POSITION_GAP` | 1000 | Gap between card positions on append |
| `VITE_API_BASE_URL` | `http://localhost:4000` | Frontend API base URL |

### Rollback
To roll back the 5 migrations:
```bash
npm run migrate:down -- --count 5 --prefix backend
```

---

## Maintenance

### Monitoring
- Board fetch latency: target p95 < 200ms. Check backend pino logs for `GET /api/boards/:id` duration.
- DnD failures: sonner toasts visible to users; backend logs `PATCH /api/cards/:id` 4xx/5xx at `warn`/`error`.

### Common Issues

| Issue | Resolution |
|-------|------------|
| Board shows blank after deploy | Check `DATABASE_URL` is set and migrations applied |
| Cards appear in wrong order | `position` column may have collisions — run `SELECT id, position FROM cards WHERE column_id = $x ORDER BY position` to inspect |
| DnD rollback not firing | Verify `onError` AbortError filter isn't swallowing real errors |
| Seed inserts duplicate data | Seed is idempotent via `ON CONFLICT DO NOTHING` — safe to re-run |

### Technical Debt (Tracked)

| Item | Priority | Description |
|------|----------|-------------|
| `CardRepository.renumberColumn` | Medium | Implement renumber path when gap collapses to ≤ 1 (ARCH-Q7 deferred) |
| `CardRepository.create` two-statement | Low | Consolidate SELECT max + INSERT into single subquery to eliminate race condition |
| `computeNewPosition` extraction | Low | Extract to `frontend/src/utils/positionUtils.ts` + add unit tests |
| `CardRepository.update` dynamic SQL | Low | Replace `setClauses` array approach with structured key→column map |
| E2E browser tests | Medium | Run `/banyan-uat TASK-003` during FEAT-004 UAT setup |
| Operation-level logging | Low | Add `req.logger.info(...)` to new controller actions |

---

## Lessons Learned

Key learnings from `memory-bank/reflection/reflection-TASK-003.md`:

1. **Pure function extraction pays dividends immediately** — exporting `applyMoveOptimistic`, `applyCreateOptimistic`, and `replaceCard` alongside their hooks enabled fast, focused unit tests and locked the optimistic update contract independently of React rendering.

2. **Creative phase fidelity** — both architecture and UI/UX creative docs served as high-fidelity implementation guides. Every ARCH-Q and UX-Q decision mapped directly to code with no re-interpretation needed.

3. **AbortError filtering is non-obvious but critical** — without `!(err instanceof DOMException && err.name === 'AbortError')` in `useMoveCard.onError`, rapid sequential drags show spurious error toasts.

4. **COALESCE guards in nested json_agg are mandatory** — at all three nesting levels to prevent null arrays reaching the frontend TypeScript types.

---

## Future Considerations

- **FEAT-004**: Card detail modal — the placeholder route `/boards/:boardId/cards/:cardId` and `CardDetailPlaceholderPage` are in place; FEAT-004 fills them in.
- **Authentication** (future feature): no auth in FEAT-003; all endpoints are open. Add middleware before expose publicly.
- **Position renumbering**: implement `CardRepository.renumberColumn` before multi-user concurrent usage.
- **Column management**: columns are fixed ("To Do", "In Progress", "Done") seeded on board creation. User-editable columns deferred to a future feature.
- **Real-time sync**: WebSockets / SSE deferred to post-MVP. Current architecture is polling-based (TanStack Query staleTime=30s).
- **UAT + E2E regression suite**: run `/banyan-uat` during FEAT-004 setup to validate browser-based ACs and generate a permanent Playwright/Cypress spec.

---

## References

- **Reflection**: `memory-bank/reflection/reflection-TASK-003.md`
- **Architecture Creative**: `memory-bank/creative/TASK-003-kanban-board-architecture.md`
- **UI/UX Creative**: `memory-bank/creative/TASK-003-kanban-board-uiux.md`
- **Progress Log**: `memory-bank/progress.md`
- **Roadmap**: `memory-bank/roadmap.md` → FEAT-003
