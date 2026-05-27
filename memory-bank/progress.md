# Progress

## Implementation History

See task archives below for completed tasks.

## Planning Log

| Date | Task | Phase | Note |
| 2026-05-28 | TASK-006 Card Labels | REFLECTION_COMPLETE | Task Quality: Excellent (all 9 ACs met, 129/129 tests). Workflow: Highly Effective (Level 3 creative docs load-bearing). 4 learnings extracted: ui-patterns.md, testing-patterns.md, architecture.md, optimistic-updates.md (all amended). |
| 2026-05-28 | TASK-006 Card Labels | BUILD Phase 4/4 COMPLETE | Filter source fix + accessibility pass + E2E tests: BoardView.tsx allLabels now comes from useLabels(boardId) API (not card-derived useMemo) so unassigned labels appear in filter dropdown (AC-ENTRY-2). 8 new tests: boardView +1 (unassigned-label filter), labelPickerSection +7 (aria-expanded, aria-controls, panel id/label, aria-checked, aria-invalid, aria-live). 129/129 tests PASS. Build+Lint PASS. Commit 9f5efc5. |
| 2026-05-25 | TASK-005 Realtime Activity Feed | REFLECTION_COMPLETE | Reflection document created. Task Quality: Good (all 8 ACs met, 76/76 tests). Workflow: Highly Effective (Level 3 creative phase load-bearing). 4 learnings extracted: sse.md (created), architecture.md (amended). |
| 2026-05-25 | TASK-005 Realtime Activity Feed | BUILD Phase 2/3 COMPLETE | Backend SSE Transport: ActivitySSEController (SSE headers + flushHeaders + heartbeat via SSE_HEARTBEAT_INTERVAL_MS env var + boardId-scoped emitter listener + req.on('close') cleanup). GET /api/boards/:boardId/activity-stream route added. config/env.ts extended with config.sse.heartbeatIntervalMs (12-Factor). 5 SSE integration tests in activitySSE.test.ts (header check, data frame delivery, listener cleanup on disconnect, board-scope filtering, zero-listener safety). closeAllConnections() in afterAll prevents SSE connection hang. 50/50 tests PASS. tsc+lint+build PASS. |
| 2026-05-19 | TASK-004 Card Detail + Search/Filter | BUILD Phase 2/2 COMPLETE | Board Search + Filter: filterCards pure utility (search/label/date-filter, AND semantics). SearchInput (sr-only label, search icon, controlled input). FilterChip (aria-pressed, active/inactive/color styles). FiltersDropdown (Filters/Filters(N) button, absolute panel, label chips + Overdue + Due Soon + Clear all, outside-click close, Escape close). GenericTopBar (replaces BoardHeader in AppShell — hamburger + BanyanBoard wordmark). board/BoardHeader (boardName, search, filters dropdown, New Card button). AppShell updated to use GenericTopBar. BoardView: filter state (useState), allLabels (useMemo deduplicate), filteredColumns (useMemo with filterCards), BoardHeader rendered inside BoardView. Column: isFiltering prop → "No matching cards" vs "No cards yet" empty state. AppShell.test updated (removed "New Card" test, added wordmark test). boardView.test extended (6 new search/filter tests). boardSearch.test new (9 pure-function tests). 68/68 tests PASS. tsc+lint+build PASS. |
| 2026-05-19 | TASK-004 Card Detail + Search/Filter | BUILD Phase 1/2 COMPLETE | Card Detail Modal: boardsApi.updateCard. useUpdateCard hook (optimistic cache write + rollback + toast). CardDetailModal (route-rendered via Outlet at /boards/:boardId/cards/:cardId; portal to document.body; inline edit title/description/dueDate; label display; dirty check; save/cancel; Escape; focus trap; inline error). Router nested route replaces CardDetailPlaceholderPage. BoardView Outlet added. 9 tests in cardDetail.test.tsx. 52/52 tests PASS. tsc+lint+build PASS. |
| 2026-05-19 | TASK-003 Kanban Board UI | BUILD_COMPLETE (all 5 phases) | Phase 5 Add-Card Affordance: useCreateCard hook (applyCreateOptimistic + replaceCard pure functions; TanStack Query useMutation onMutate/onSuccess/onError/onSettled pattern; optimistic append with crypto.randomUUID() tempId; rollback to previous cache on error; sonner toast.error on failure). BoardView updated to use useCreateCard (replaced inline handleAddCard). AddCardForm.handleSubmit catch block prevents unhandled rejection on API failure. 13 new tests in createCard.test.tsx (pure fn tests, hook tests: optimistic/success/error/cache-miss, component: closed state, open on click, submit+close, stays-open-on-error). 42/42 tests PASS. tsc+lint+build PASS. |
| 2026-05-19 | TASK-003 Kanban Board UI | BUILD Phase 4/5 COMPLETE | DnD + Optimistic Updates + Rollback: boardsApi.moveCard updated to accept AbortSignal. useMoveCard hook (applyMoveOptimistic pure function + TanStack Query useMutation onMutate/onError/onSettled pattern with AbortController cancel-previous). BoardView wired with DndContext, SortableContext per column, DragOverlay, PointerSensor(distance:4) + KeyboardSensor. Column uses useDroppable for empty-column drop targets. CardTile wired with useSortable (listeners on drag handle, isDragging for visual feedback). computeNewPosition helper calculates midpoint integer positions. 6 new dnd.test.tsx tests (applyMoveOptimistic cross-column, badge counts, no-op on missing card; useMoveCard optimistic update, rollback, toast on error). 29/29 tests PASS. tsc+lint+build PASS. |
| 2026-05-18 | TASK-003 Kanban Board UI | BUILD Phase 3/5 COMPLETE | Frontend BoardView + Card Rendering: dnd-kit + sonner installed. boardsApi.ts (fetchBoards/fetchBoard/createCard/moveCard). useBoards/useBoard hooks. BoardView (DndContext placeholder, loading skeleton, error panel, empty-column state), Column (sticky header, card-count badge, AddCardForm slot), CardTile (title, desc preview, due date, label chips, drag-handle, click-to-card-detail), AddCardForm (Trello-style inline expand). Sidebar replaced placeholderBoards with useBoards(). CardDetailPlaceholderPage + /boards/:boardId/cards/:cardId route. Toaster (sonner) added to main.tsx. Label color palette added to tailwind.config.ts. 23/23 frontend tests pass (9 new boardView tests, updated routes+AppShell tests). tsc+lint+build all PASS. |
| 2026-05-18 | TASK-003 Kanban Board UI | BUILD Phase 2/5 COMPLETE | Backend REST API: Zod v3 installed; `BoardRepository` (findAll, findByIdWithColumnsAndCards json_agg, createWithDefaultColumns txn), `ColumnRepository` (exists), `CardRepository` (create with gap-1000, update dynamic SQL, exists); `BoardService`, `ColumnService`, `CardService`; `BoardController`, `ColumnController`, `CardController` (all with async try/catch + next(err)); routes/boards.ts, routes/columns.ts, routes/cards.ts; app.ts mounts /api/boards, /api/columns, /api/cards; schemas/cardSchemas.ts (Zod); frontend/src/types/api.ts DTOs; boards.test.ts (10 tests), cards.test.ts (11 tests). tsc PASS, lint PASS (layering enforced — no pg in services/controllers), 12/12 non-DB tests pass. DB integration tests (21) need Docker. package.json cleaned (removed broken self-ref deps, added zod). |
| 2026-05-18 | TASK-003 Kanban Board UI | BUILD Phase 1/5 COMPLETE | DB schema + migrations: 5 node-pg-migrate v7 ESM migration files (boards, columns, cards, labels, card_labels tables with FK constraints, `idx_cards_column_position` index, integer positions with gap-1000 strategy). Seed script `backend/src/scripts/seed.ts` inserts demo board "My First Board" with 3 default columns, 5 sample cards, 4 labels (idempotent). `npm run seed` wired. `config.cards.positionGap` added via `optionalIntEnv('CARD_POSITION_GAP', 1000)`. Layering+health+logger tests (12) pass; db.test.ts fails as expected (no Docker in CI). tsc+lint PASS. |
| 2026-05-18 | TASK-002 Frontend Foundation | BUILD_COMPLETE (Phase 3/3) | State + Query Wiring: QueryClientProvider (staleTime 30s, retry 1) wrapping RouterProvider in main.tsx, ReactQueryDevtools conditional on import.meta.env.DEV. Zustand store (appStore.ts) — activeBoardId+sidebarCollapsed, devtools gated to DEV. Domain types (domain.ts: Board/Column/Card/Label inline per CE-6). api.ts stub. 14/14 tests pass (3+1 new). tsc+lint+build all pass. Code review: APPROVED. ACs covered: AC-HAPPY-4, AC-HAPPY-5. Docker Compose frontend service previously finalised in Phase 1 (AC-DOCKER-1). |
| 2026-05-18 | TASK-002 Frontend Foundation | BUILD Phase 2/3 COMPLETE | App shell layout: AppShell.tsx (flex h-screen, backdrop overlay), Sidebar.tsx (fixed overlay tablet / static desktop, NavLink active states, 3 placeholder boards), BoardHeader.tsx (burger btn, board title, New Card btn), useSidebar.ts hook (isOpen/open/close/toggle), BoardListPage + BoardDetailPage placeholders, router/index.tsx (createBrowserRouter with Navigate redirect / → /boards, nested Outlet). 10/10 tests pass (3 Phase 1 + 4 AppShell + 3 routes). tsc+lint+build all pass. Code review: APPROVED. ACs covered: AC-HAPPY-1, AC-HAPPY-2, AC-NAV-1, AC-NAV-2. |
| 2026-05-18 | TASK-002 Frontend Foundation | BUILD Phase 1/3 COMPLETE | Frontend scaffold: Vite 5 + React 18 + TypeScript 5 strict, TailwindCSS v3 with design tokens (slate/indigo, Inter font), ESLint v9 flat config (`no-console: error`), src/utils/logger.ts env-aware wrapper, src/api/apiClient.ts typed fetch wrapper (VITE_API_BASE_URL with fallback+warn), Vitest v2 + RTL v16, docker-compose.yml frontend service + override. 3/3 tests pass. tsc+lint+build all pass. Code review: APPROVED. ACs covered: AC-ENTRY-1, AC-HAPPY-3, AC-ERROR-1. |
|------|------|-------|------|
| 2026-05-16 | TASK-001 Project Foundation | PLANNING_COMPLETE | 7-phase plan, 8 ACs, 9 creative decisions → /banyan-creative required |
| 2026-05-16 | TASK-001 Project Foundation | CREATIVE_COMPLETE | Architecture Design complete — all 9 blocking decisions resolved. Raw pg + node-pg-migrate + Vitest + pino (Logger interface) + ESLint no-restricted-imports + type-folder layout + /health/live+/health/ready + multi-stage Dockerfile + logger-interface-plus-correlation observability |
| 2026-05-16 | TASK-001 Phase 1 | BUILD Phase 1/7 COMPLETE | TypeScript backend scaffold: package.json (ESM, Vitest, pino, pg, eslint v9), strict tsconfig, ESLint flat config, env.ts (12-Factor fail-fast), createApp() factory, graceful shutdown. tsc+lint+build all pass. Code review: APPROVED WITH NOTES. 2 security upgrades deferred (node-pg-migrate HIGH before Phase 4; vitest MODERATE after Phase 6). |
| 2026-05-16 | TASK-001 Phase 2 | BUILD Phase 2/7 COMPLETE | Health check vertical slice: GET /health/live + GET /health/ready via HealthController → HealthService → HealthRepository (stub). vitest.config.ts with setupFiles. tsconfig.eslint.json added so test files are type-checked by ESLint. 5/5 tests pass. tsc+lint+build all pass. Code review: APPROVED WITH NOTES (REC-1 config module, REC-2 async/await, REC-3 safe error response, REC-4 setup.ts all applied). |
| 2026-05-16 | TASK-001 Phase 3 | BUILD Phase 3/7 COMPLETE | Docker Compose + PostgreSQL service: multi-stage Dockerfile (deps→build→runtime, USER node, wget /health/live healthcheck), .dockerignore, docker-compose.yml (db+backend, pg_isready $$-style, service_healthy depends_on, pgdata volume, optional env_file), docker-compose.override.yml (deps stage, tsx watch hot-reload), root .env.example. 0 new tests (infrastructure phase); 5/5 existing tests pass. Code review: APPROVED WITH NOTES (REC-2 working_dir, REC-3 dockerignore, REC-4 $$-healthcheck applied; REC-1 4th stage skipped — premature for MVP). |
| 2026-05-16 | TASK-001 Phase 4 | BUILD Phase 4/7 COMPLETE | PostgreSQL client + connectivity: db.ts (pg Pool with poolMax/idleTimeout/connectionTimeout from env), checkDatabaseConnection(), closePool(). index.ts: startup DB check with fail-fast exit; double-shutdown guard; pool teardown on SIGTERM/SIGINT. PG_CONNECTION_TIMEOUT_MS env var added (default 10s). migrations/.gitkeep stub. 4 new integration tests (SELECT 1, checkDatabaseConnection, wrong-creds, pool lifecycle); 9/9 total pass. Code review: APPROVED WITH NOTES (REC-2 connectionTimeout, REC-3 double-shutdown guard applied; REC-1 console→pino deferred to Phase 5). |
| 2026-05-16 | TASK-001 Phase 5 | BUILD Phase 5/7 COMPLETE | Observability foundation: Logger interface (types/logger.ts) + pino v9 implementation (config/logger.ts with createLogger factory and rootLogger singleton) + W3C traceparent middleware (middleware/requestContext.ts) + access logger (middleware/requestLogger.ts) + centralized error handler (middleware/errorHandler.ts). app.ts wired: requestContext → requestLogger → json → routes → 404 → errorHandler. index.ts: console.log/error replaced with rootLogger. express.d.ts augments Request with logger+traceContext. ESLint updated with argsIgnorePattern '^_'. 4 new logger tests (JSON fields, level suppression, withTraceContext, redaction) + 5 health tests all pass (13 total; 3 db tests require Docker). Code review: APPROVED. |
| 2026-05-16 | TASK-001 Phase 6 | BUILD Phase 6/7 COMPLETE | Layering enforcement: eslint.config.js extended with no-restricted-imports rules (controllers/ blocks pg, @prisma/client, kysely, repositories/, config/db*; services/ blocks pg, config/db*) using ESLint 9 flat config format. layering.test.ts structural tests (2 tests: no pg imports in controllers, no raw SQL keywords in controllers — regex safety net). 15 non-DB tests pass; 3 DB tests require Docker. tsc+lint+build all pass. Code review: APPROVED. |
| 2026-05-16 | TASK-001 Phase 7 | BUILD_COMPLETE (all 7 phases) | Documentation: README.md (prerequisites, 3-command quickstart, ASCII architecture diagram, test commands, layering rules, roadmap link). memory-bank/techContext.md (feature branch) updated with final library choices (Vitest v2, pg v8, node-pg-migrate v7, tsx, ESLint 9, Prettier 3; Observability section; Recent Tech Changes). memory-bank/systemPatterns.md (feature branch) updated with missing patterns (App Factory, 12-Factor Config, Graceful Shutdown, Observability) and Testing Patterns filled in (no more [To be defined]). 0 new tests (doc phase). 12/15 tests pass (3 DB tests require Docker — unchanged). tsc+lint PASS. Status: BUILD_COMPLETE. |

---

## Task Archive: TASK-001

**Task**: Project Foundation
**Status**: ✅ ARCHIVED
**Date**: 2026-05-16
**Archive**: `memory-bank/archive/archive-TASK-001.md`

---

*Updated by `/banyan-archive` after each task completion.*

---

## Task Archive: TASK-002

**Task**: Frontend Foundation
**Status**: ✅ ARCHIVED
**Date**: 2026-05-18
**Archive**: `memory-bank/archive/archive-TASK-002.md`

---

## Task Archive: TASK-003

**Task**: Kanban Board UI
**Status**: ✅ ARCHIVED
**Date**: 2026-05-19
**Archive**: `memory-bank/archive/archive-TASK-003.md`

---

## Task Archive: TASK-004

**Task**: Card Detail Modal + Search/Filter
**Status**: ✅ ARCHIVED
**Date**: 2026-05-19
**Archive**: `memory-bank/archive/archive-TASK-004.md`

---

## Task Archive: TASK-005

**Task**: Realtime Activity Feed
**Status**: ✅ ARCHIVED
**Date**: 2026-05-25
**Archive**: `memory-bank/archive/archive-TASK-005.md`

---
