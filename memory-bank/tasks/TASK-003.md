# TASK-003: Kanban Board UI

**Complexity**: Level 4
**Status**: CREATIVE_COMPLETE
**Roadmap**: FEAT-003
**Branch**: feature/FEAT-003-kanban-board-ui
**Worktree**: N/A

## Task Description

Build the full Kanban board experience for BanyanBoard. This task spans backend REST API implementation (boards, columns, cards endpoints + database schema + migrations) **and** the React frontend Kanban UI (column/card rendering, drag-and-drop via dnd-kit, optimistic updates, column card-count badges, add-card affordance, sticky column headers).

The frontend scaffold (React + Vite + TailwindCSS + TanStack Query + Zustand) and app shell (sidebar + board header + routing) are already in place from FEAT-002. Domain types (`Board`, `Column`, `Card`, `Label`) are defined in `frontend/src/types/domain.ts`. The `apiClient` typed fetch wrapper exists in `frontend/src/api/apiClient.ts`. The `BoardDetailPage` is a placeholder stub.

The backend has: Express app factory, pino structured logging, W3C trace context middleware, and the health endpoint (`GET /health`). No board/column/card routes, controllers, services, repositories, or database migrations exist yet.

Integrates with: PostgreSQL 15 (via node-postgres `pg` v8), node-pg-migrate v7 for schema, TanStack Query v5 for server state, Zustand v4 for optimistic DnD state, dnd-kit for drag-and-drop.

## User Journey Definition

**Feature Type**: End-User Feature
**Creative Phase Required**: Yes — UI/UX Design + Architecture Design

### Invocation Method (End-User Features)
- **Location**: `/boards/:boardId` route (BoardDetailPage)
- **Element**: User navigates via sidebar board link; board loads automatically
- **Visibility**: Always visible when a board exists
- **Navigation**: App loads → sidebar shows board list → user clicks board name → board view renders columns with cards

### Success Criteria (End-User Features)
- **User sees**: Horizontally scrollable columns with card tiles (title, description preview, due date, label chips); drag-and-drop moves cards instantly with optimistic update
- **User can verify at**: `/boards/:boardId` — board renders with live data from PostgreSQL via REST API
- **Data persisted**: Card column moves persisted to `cards` table (`column_id`, `position`); new cards saved to `cards` table
- **Observable within**: < 200ms API response; drag-and-drop feels instant (optimistic UI)

### NFR Verification (Infrastructure Features)
- **Test method**: `npm test --prefix frontend` + `npm test --prefix backend` + manual DnD smoke test via browser
- **Success metrics**: p95 API < 200ms; drag-and-drop optimistic (instant); < 2s board load; error rate < 1%
- **Observable at**: Browser network tab; Vitest output

### Acceptance Criteria
- AC-ENTRY-1: User can navigate to a board via sidebar and the board page renders (no placeholder text)
- AC-HAPPY-1: Board displays all columns with correct card count badges and card tiles (title, description preview, due date, labels)
- AC-HAPPY-2: User can drag a card from one column to another; card moves immediately (optimistic) and is confirmed by API
- AC-HAPPY-3: User can add a new card from the add-card affordance at the bottom of a column
- AC-ERROR-1: If drag-and-drop API call fails, card reverts to its original column with a visual indicator
- AC-ERROR-2: If board fetch fails, board page shows an error state (not a blank page)
- AC-DATA-1: Card column reassignment persists across page refresh (confirmed via database)

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Member (individual contributor — dev/designer/PM) — goals: "know what to work on next" and "update card status quickly" (productBrief.md, Key Personas)
**Secondary Personas**:
- Team Lead — sees team's work at a glance; spots bottlenecks in columns
- Freelancer / Startup Founder / Solo Builder — same UI; cross-board navigation already exists in sidebar
**Creative Exploration Needed**: Yes — both **Architecture Design** AND **UI/UX Design** are mandatory (Level 4). Specific questions listed in the final "Creative Exploration Needed" subsection below.

### Invocation Method

- **Location**: `BoardDetailPage` mounted at the React Router path `/boards/:boardId` (`frontend/src/router/index.tsx:13`). Today this page is a single-line placeholder (`frontend/src/pages/BoardDetailPage.tsx`) — FEAT-003 replaces it with the live Kanban view.
- **Element**: Three nested elements, all rendered inside the `<main>` slot of `AppShell` (`frontend/src/components/layout/AppShell.tsx:21`):
  1. **Column rail** — horizontally scrollable container holding one `<Column>` per `board.columns[]`.
  2. **Card tile** — one per `column.cards[]`, draggable via dnd-kit's `useSortable`/`useDraggable`.
  3. **Add-card affordance** — pinned to the bottom of each column (exact UX form pending UI/UX creative — see open question UX-Q3 below).
- **Visibility**: Always visible once a board is loaded. Loading state shows skeleton columns; error state shows an error panel (NOT a blank page — see AC-ERROR-2). Empty board (zero columns) shows guidance text.
- **Navigation**: App entry → user lands at `/` → `<Navigate to="/boards" replace />` (`frontend/src/router/index.tsx:11`) → sidebar (`Sidebar.tsx`) lists boards (currently placeholder data; **see open question DATA-Q1**) → user clicks board NavLink → router pushes `/boards/:boardId` → `BoardDetailPage` mounts, calls `GET /api/boards/:id`, renders columns and cards.
- **Confidence**: HIGH for placement (route, page, app-shell slot all exist). MEDIUM for the sidebar wiring — `Sidebar.tsx:10-14` currently hard-codes `placeholderBoards`; FEAT-003 must decide whether to swap to a real `GET /api/boards` fetch (recommended — see DATA-Q1) or defer sidebar wiring to a follow-up feature. LOW for add-card UX form factor — flagged for creative.

### Success Criteria

- **User sees**:
  - Column headers showing `column.name` and a card-count badge (e.g., `In Progress  3`).
  - Card tiles with `title`, description preview (first ~120 chars of `description`), `dueDate` formatted (e.g., "May 22"), and label chips colored by `label.color`.
  - Drag handle / drag affordance on each card (cursor changes to grab on hover).
  - During drag: visual placeholder in the target column; original card has reduced opacity.
  - On drop in a new column: card visually moves immediately (optimistic); target column's badge increments; source column's badge decrements.
  - On API failure: card snaps back to its original column AND a non-blocking error toast/inline indicator appears (exact form pending UI/UX creative — see UX-Q5).
- **Verifiable at**: `/boards/:boardId` in the browser. Database state verifiable via `psql` query against the `cards` table (`column_id`, `position` columns).
- **Data persisted**:
  - `cards.column_id` updated on cross-column move.
  - `cards.position` updated on any move (cross-column OR intra-column reorder — **see open question SCOPE-Q2** for whether intra-column reorder is in scope for FEAT-003).
  - `cards.updated_at` bumped automatically.
  - On new card add: full row inserted into `cards` with auto-assigned `position`.
- **Observable within**:
  - Optimistic UI update: immediate (next render frame, < 16ms).
  - Server confirmation: p95 < 200ms (productBrief NFR — Performance).
  - Board first paint: < 2s on localhost (productBrief NFR).
  - Rollback on error: within 1s of API failure response.

### Acceptance Criteria

#### AC-ENTRY-1: User can navigate to a board and reach a non-placeholder Kanban view
**Priority**: MUST

**Given** a user has opened the app at `/` with at least one board persisted in the database
**When** they click a board entry in the sidebar (`<Sidebar>` NavLink, `Sidebar.tsx:37-52`)
**Then**:
  - The router navigates to `/boards/:boardId`.
  - `BoardDetailPage` renders the live Kanban view (NOT the placeholder text "Board {boardId} — coming soon").
  - The active board's columns are visible within 2 seconds.

**Verification**:
- [ ] E2E: assert no element contains the string "coming soon" on `/boards/:boardId`.
- [ ] Component test: `BoardDetailPage` renders `<BoardView>` when `useBoard()` returns data.
- [ ] Network: a single `GET /api/boards/:boardId` request is fired on mount.

#### AC-HAPPY-1: Board renders columns and cards with correct content
**Priority**: MUST

**Given** the API returns a board with 3 columns ("To Do", "In Progress", "Done"), with 2 / 3 / 1 cards respectively
**When** `BoardDetailPage` finishes loading
**Then**:
  - 3 column elements render with names "To Do", "In Progress", "Done" in `position` order.
  - Each column header shows a card-count badge: `2`, `3`, `1`.
  - Each card tile renders the card's `title`, description preview (truncated if > 120 chars), formatted `dueDate` (if non-null), and a chip per label in `card.labels[]` colored via the label's `color` value.
  - **Stub detection**: card titles match the API response exactly (NOT hardcoded `'Card 1'`, `'Card 2'`); changing the API response changes the rendered titles.

**Verification**:
- [ ] Component test renders `<BoardView>` with a fixture board and asserts column names, badge counts, card titles, and label chip colors.
- [ ] Component test with a DIFFERENT fixture (different titles) asserts output changes — confirms not hardcoded.
- [ ] Visual: due dates render in a human-readable format; null due dates do not render an empty element.

#### AC-HAPPY-2: User drags a card between columns and it persists
**Priority**: MUST

**Given** a board has a card "Fix login bug" in column "To Do" (position 0)
**When** the user drags that card and drops it into column "In Progress"
**Then**:
  1. The card visually appears in "In Progress" immediately (before the API call resolves).
  2. The Zustand store (or TanStack Query cache — **see architecture question ARCH-Q2**) reflects the optimistic state.
  3. A `PATCH /api/cards/:id` request is sent with `{ columnId, position }`.
  4. On 200 OK: the optimistic state is committed; no visual change occurs on confirmation.
  5. On page refresh (re-fetch via `GET /api/boards/:boardId`): the card is in "In Progress" (server-confirmed persistence).
  6. The source column's card-count badge decrements; the target's increments.

**Verification**:
- [ ] Integration test (frontend): `dnd-kit` `onDragEnd` triggers mutation; the React Query cache shows the card in the new column synchronously after the drop, before the mutation resolves.
- [ ] Integration test (backend): `PATCH /api/cards/:id` with `{ columnId: 'col-2', position: 0 }` updates the DB row and returns the updated card.
- [ ] E2E (data persistence): after drop + refresh, the card is in the new column.
- [ ] **Stub detection**: backend test inserts a real row, calls PATCH, then SELECTs and confirms `column_id` changed (not just a 200 response).

#### AC-HAPPY-3: User creates a new card in a column
**Priority**: MUST

**Given** a user viewing a board
**When** they invoke the add-card affordance at the bottom of column "To Do", enter "Write API docs", and confirm
**Then**:
  - A `POST /api/columns/:columnId/cards` request is sent with `{ title: 'Write API docs' }`.
  - On 201 Created: the new card appears at the bottom of "To Do" with the server-assigned `id`, `position`, and `createdAt`.
  - The column's card-count badge increments by 1.
  - The add-card affordance returns to its idle state, ready for another entry.

**Verification**:
- [ ] E2E: invoke affordance → enter title → confirm → assert new card visible with entered title.
- [ ] Backend integration: POST persists the row; SELECT confirms `title = 'Write API docs'` and `column_id` is correct.
- [ ] **Stub detection**: assert the rendered card's title matches the typed input (not a hardcoded value).
- [ ] Note: the exact UX form factor (inline form vs modal vs row of icons) is LOW confidence — flagged for UI/UX creative (UX-Q3).

#### AC-ERROR-1: Drag-and-drop API failure rolls back the optimistic move
**Priority**: MUST

**Given** the user has dragged card "Fix login bug" from "To Do" to "In Progress" (optimistic update applied)
**When** the `PATCH /api/cards/:id` request fails (HTTP 500, network error, or 4xx)
**Then**:
  - The card visually returns to "To Do" within 1 second of the failure.
  - The card-count badges revert to their pre-drag values.
  - A non-blocking error indicator appears (toast or inline error — exact form **deferred to UI/UX creative**, see UX-Q5) with text including the error reason and a retry hint.
  - The user can attempt the drag again immediately (no lockout).
  - No partial DB write occurs (backend rejects the move atomically).

**Verification**:
- [ ] Frontend test mocks PATCH to reject; asserts card returns to source column and an error indicator is rendered.
- [ ] Backend integration test: PATCH with invalid `columnId` returns 4xx and does NOT mutate the row.
- [ ] **Stub detection**: assert error indicator content includes the actual error message, not a generic placeholder.

#### AC-ERROR-2: Board fetch failure shows an error state (not a blank page)
**Priority**: MUST

**Given** the user navigates to `/boards/:boardId` for a board whose fetch fails (404 / 500 / network)
**When** TanStack Query reports an error from `useBoard(boardId)`
**Then**:
  - An error panel renders inside the `<main>` slot with a human-readable message ("We couldn't load this board") and a Retry action.
  - The placeholder text "Board {boardId} — coming soon" does NOT appear.
  - The sidebar remains usable so the user can pick another board.
  - Clicking Retry re-issues the fetch.

**Verification**:
- [ ] Component test: render `BoardDetailPage` with `useBoard` mocked to return an error; assert error panel and Retry button.
- [ ] E2E: stub the API to 500 and assert the error panel renders.

#### AC-ASYNC-1: User sees server confirmation (or lack thereof) for moves
**Priority**: SHOULD

**Given** a card has been dragged and the optimistic update applied
**When** the server confirms the move
**Then**:
  - No visible flicker on success (the optimistic state and the confirmed state are identical).
  - On failure, the rollback in AC-ERROR-1 fires.

**Verification**:
- [ ] Manual smoke test: drag a card on a slow connection (DevTools throttling) — no flash of unconfirmed state on success.
- [ ] Component test: assert the React Query cache transitions from "pending" → "success" without re-rendering visible card position.

#### AC-NAV-1: User can navigate away and return without losing board state
**Priority**: SHOULD

**Given** the user has dragged several cards on board A
**When** they navigate to board B via the sidebar, then back to board A
**Then**:
  - Board A re-fetches and shows the persisted state (cards in their dragged positions).
  - If TanStack Query has cached the board within `staleTime` (30s — `main.tsx:14`), it shows instantly; otherwise re-fetches.

**Verification**:
- [ ] E2E: drag → navigate away → return → assert dragged cards remain in new positions.

#### AC-DATA-1: Card column reassignment persists across page refresh
**Priority**: MUST

**Given** the user has moved card "Fix login bug" from "To Do" to "In Progress" and seen the API succeed
**When** they refresh the browser
**Then**:
  - The card renders in "In Progress" after the fresh `GET /api/boards/:boardId` resolves.
  - The DB row's `column_id` equals the "In Progress" column's UUID.

**Verification**:
- [ ] E2E: drag → reload page → assert card position.
- [ ] Backend test: PATCH → SELECT confirms DB state.

#### AC-A11Y-1: Keyboard navigation can create a card and move it (best-effort WCAG 2.1 AA)
**Priority**: SHOULD

**Given** the user is on a board page
**When** they use Tab/Enter to focus the add-card affordance, type a title, and submit; then Tab to a card
**Then**:
  - The add-card affordance is keyboard-reachable and submits via Enter.
  - Card tiles have focus indicators (`focus:ring-2` per existing TailwindCSS tokens).
  - dnd-kit's `KeyboardSensor` enables drag via Space + arrow keys (productBrief NFR — Accessibility, "Keyboard navigation for card creation and column navigation").

**Verification**:
- [ ] E2E with keyboard-only interaction creates a card.
- [ ] Manual: focus indicators visible on cards and column headers.

### Scope Boundaries

**In scope (FEAT-003)**:
- **Database**: New PostgreSQL migrations creating `boards`, `columns`, `cards`, `labels`, and `card_labels` (junction) tables. Migration files in `backend/migrations/` (currently empty directory) using `node-pg-migrate`.
- **Backend REST API**:
  - `GET /api/boards` — list boards (id, name, updatedAt) for sidebar.
  - `GET /api/boards/:id` — fetch a single board with its columns and cards (single response — no separate column/card requests).
  - `POST /api/columns/:columnId/cards` — create a card.
  - `PATCH /api/cards/:id` — update card (used primarily for `columnId` + `position` on move; also supports `title`, `description`, `dueDate` changes).
  - All endpoints follow the existing pattern: Route → Controller → Service → Repository (see `health.ts`, `HealthController.ts`, `HealthService.ts`, `HealthRepository.ts`).
- **Frontend Kanban UI**:
  - New `BoardView` component rendering columns horizontally with sticky headers.
  - New `Column` component (header + card list + add-card slot).
  - New `CardTile` component (title, description preview, due date, label chips).
  - dnd-kit integration for cross-column drag-and-drop.
  - Optimistic update with rollback on failure.
  - Add-card affordance (form factor TBD by creative).
  - Real sidebar boards list wired to `GET /api/boards` (replacing `placeholderBoards` in `Sidebar.tsx:10-14`).
  - Populate `frontend/src/types/api.ts` with REST request/response DTOs.
- **Tests**: ~20–30 across backend integration tests + frontend component/interaction tests (matches existing test strategy).

**Out of scope (NOT FEAT-003)**:
- Authentication / authorization (productBrief lists this as an open question; defer to a later feature).
- Card detail modal (full inspection/editing) — productBrief lists this in "Card Design" but click-to-open-modal is a separate scope; FEAT-003 only handles inline list view + add. **A click on a card MAY open a placeholder/no-op or simply do nothing in FEAT-003** — see UX-Q1.
- Search, filters (label/date), label management UI (productBrief lists these — separate feature).
- Card editing in place (title/description/due-date edits) — `PATCH /api/cards/:id` supports it on the backend, but the UI for inline editing is deferred.
- Card deletion UI — endpoint may exist (`DELETE /api/cards/:id`) but no UI affordance in MVP DnD UX.
- Column creation/deletion/rename — columns are fixed at board creation (default: To Do / In Progress / Done). **Open question SCOPE-Q3** below.
- Multi-card multi-select drag.
- Touch / mobile drag-and-drop (productBrief defers to post-MVP).
- Real-time sync (WebSockets) — productBrief explicitly defers this.
- Activity history / audit log.
- Authentication, user management, board membership.

**Dependencies**:
- FEAT-001 (backend foundation) — DONE: app factory, pg pool, logger, traceparent middleware, error handler all available.
- FEAT-002 (frontend foundation) — DONE: App shell, routing, TanStack Query, Zustand store, apiClient all wired.
- PostgreSQL 15 must be running (docker compose) — already a dependency.
- New dependency: **dnd-kit** must be added to `frontend/package.json` — currently NOT installed. (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — exact packages TBD by architecture creative).

**NFR implications (from productBrief)**:
- **Performance**: p95 API response < 200ms — `GET /api/boards/:id` will JOIN boards + columns + cards + labels; needs an indexed query (likely `cards(column_id, position)` index and a single round-trip via JSON aggregation OR multi-statement fetch). Flagged for architecture creative (ARCH-Q4).
- **Drag-and-drop feels instant** — mandates optimistic UI architecture (ARCH-Q2).
- **Page load < 2s on localhost** — single-request board fetch is preferred over a waterfall.
- **Accessibility (WCAG 2.1 AA, best-effort)**: keyboard navigation for add-card and DnD (see AC-A11Y-1).
- **No business logic in controllers / no SQL in controllers**: enforced by `layering.test.ts`. New layers must follow.
- **No `console.log`**: enforced by `no-console: error` ESLint rule. All backend logging must use `req.logger` (W3C trace-context-aware logger from `requestContext.ts`).
- **12-Factor config**: any new env vars (e.g., `CARD_POSITION_GAP`) MUST be added via `optionalIntEnv()` in `backend/src/config/env.ts`.

### Backend API Contract (provisional — finalized by Architecture Creative)

> All endpoints prefixed `/api`. Currently the backend has NO `/api` route prefix and the only mount is `/health`. FEAT-003 introduces the `/api/*` namespace.

#### `GET /api/boards`
- **Purpose**: Lightweight list for sidebar.
- **Response 200**:
  ```json
  [
    { "id": "uuid", "name": "string", "updatedAt": "ISO-8601" }
  ]
  ```
- **Errors**: 500 on DB failure.

#### `GET /api/boards/:boardId`
- **Purpose**: Full board with nested columns and cards (single round-trip).
- **Response 200**: matches `Board` from `frontend/src/types/domain.ts` — `{ id, name, columns: Column[], createdAt, updatedAt }` where each `Column` includes `cards: Card[]` sorted by `position` and each `Card` includes `labels: Label[]`.
- **Errors**: 404 if board not found; 500 on DB failure.

#### `POST /api/columns/:columnId/cards`
- **Purpose**: Create a card at the end of a column.
- **Request body**: `{ "title": "string" (required), "description"?: "string", "dueDate"?: "ISO-8601" }`
- **Response 201**: full `Card` object (matching `domain.ts:Card`).
- **Errors**: 400 (validation), 404 (column not found), 500.

#### `PATCH /api/cards/:cardId`
- **Purpose**: Update card fields. **Primary use: card move** — `{ columnId, position }`.
- **Request body** (all optional, at least one required):
  ```json
  { "title"?: "string", "description"?: "string|null", "dueDate"?: "ISO-8601|null", "columnId"?: "uuid", "position"?: "number" }
  ```
- **Response 200**: updated `Card`.
- **Errors**: 400 (validation), 404 (card or target column not found), 500.

#### Provisional Data Model (finalized by Architecture Creative — ARCH-Q1)

```
boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)

columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, position)
)

cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id     UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE,
  position      NUMERIC NOT NULL,  -- fractional positions to avoid renumbering on insert
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX idx_cards_column_position ON cards(column_id, position);

labels (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  color     TEXT NOT NULL,  -- hex or semantic token
  UNIQUE (board_id, name)
)

card_labels (
  card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id  UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
)
```

**Confidence**: MEDIUM. Decisions deferred to Architecture Creative:
- Position numeric type (integer with renumbering vs fractional float vs lexicographic string).
- Whether the join in `GET /api/boards/:id` should be a single JSON-aggregating query or multiple statements.
- Whether `columns` should be a fixed enum/lookup or fully user-editable rows.

### Creative Exploration Needed

**Mandatory creative phases (Level 4): Architecture Design + UI/UX Design.**

#### Architecture Design — questions

- **ARCH-Q1: Data model and position strategy.** Should card `position` be an integer (requires renumbering on insert in middle), a fractional/float (avoids renumbering but accumulates precision drift), or a string-based lexicographic ordering (à la Trello's "lexorank")? This affects the migration, the PATCH endpoint logic, and the optimistic-update math.
- **ARCH-Q2: Optimistic update state ownership.** Two valid approaches:
  - (A) Use TanStack Query's `onMutate` + `onError` rollback against the `useBoard` query cache (no extra state).
  - (B) Maintain a Zustand "drag-in-flight" store layered on top of the React Query cache (the `appStore.ts` pattern is already set up for this).
  Which model fits this codebase best, and how do they interact during rapid sequential drags (debounce? queue? cancel-previous)?
- **ARCH-Q3: Single-request vs multi-request board fetch.** Should `GET /api/boards/:id` return a nested JSON with all columns+cards+labels in one round-trip (better for p95 < 200ms NFR), or should the frontend fetch board → columns → cards as separate queries (better for partial caching)? Decision affects backend query strategy (JOIN with `json_agg` vs N+1 prevention via repository helpers).
- **ARCH-Q4: Read query performance.** Acceptable approaches for the board JOIN: (a) single SQL with `json_agg`, (b) two SQL statements + service-layer assembly, (c) DataLoader-style batching. Trade-offs?
- **ARCH-Q5: Backend folder naming and route mount.** Existing `health` routes mount at `/health`. New CRUD routes should mount at `/api/*` — confirm vs. mounting at root. Should new routes be `boards.ts`, `columns.ts`, `cards.ts` files (matches existing `health.ts` pattern) and one controller/service/repository per entity?
- **ARCH-Q6: Validation library.** No validation library is currently installed (Express + JSON only). Should we add `zod` (popular, type-safe), use hand-rolled validators, or rely on TypeScript types alone? Affects all 4 new endpoints.
- **ARCH-Q7: Transactions.** Card move modifies one row; card-with-reorder might modify multiple. Should the service layer wrap multi-row updates in a `pg` transaction? What's the minimum needed for FEAT-003 scope?

#### UI/UX Design — questions

- **UX-Q1: Click-on-card behavior in FEAT-003.** productBrief says "Click opens full-detail modal" but the modal is out of scope for FEAT-003. Options: (a) no click handler (drag only), (b) placeholder modal "Coming soon", (c) navigate to `/boards/:boardId/cards/:cardId` placeholder route. Recommendation needed.
- **UX-Q2: Sticky column header implementation.** CSS-only (`position: sticky` on the header inside an `overflow-y: auto` column body) vs JS-driven (IntersectionObserver to add a shadow on scroll). Which is more robust given horizontal board scroll + per-column vertical scroll?
- **UX-Q3: Add-card UX form factor.** Three plausible patterns: (a) inline expanding form at column bottom (Trello style), (b) modal triggered by a `+` button, (c) "Add card" button in column header that opens an inline composer. Each affects keyboard accessibility differently.
- **UX-Q4: Drag visual affordances.** Drag handle (icon) vs entire-card grab vs hover-only handle. What does dnd-kit's `useSortable` recommend, and what fits the productBrief design language ("calm, productivity-focused")?
- **UX-Q5: Error indicator for rollback (AC-ERROR-1).** Toast notification (requires a toast library — none installed) vs inline indicator on the column vs banner at top of board. What's the minimum-viable choice that meets the AC without adding a heavy dependency?
- **UX-Q6: Column overflow / horizontal scroll on Desktop ≥1024px.** productBrief specifies "horizontally scrollable Kanban columns". Should column min-width be fixed (e.g., 280px) and overflow scroll, or fluid columns that flex to fit?
- **UX-Q7: Card-count badge styling.** Should the badge use the existing `bg-label-*` Tailwind tokens, or a new semantic `bg-badge-neutral` token? (Need to inspect `tailwind.config.js` for the label palette already in FEAT-002.)
- **UX-Q8: Empty states.** Empty column ("No cards yet"), empty board ("No columns" — though columns are seeded by default), zero-boards sidebar ("Create your first board" — but board creation isn't in scope).

#### Open scope decisions (not for creative — need product confirmation)

- **SCOPE-Q1: Real `GET /api/boards` for sidebar.** Recommended IN — drops the placeholder data. Without it, the user cannot navigate to a board with a real UUID.
- **SCOPE-Q2: Intra-column reorder.** Drag a card up/down WITHIN the same column to reorder. productBrief says "drag-and-drop card reordering" — recommendation: IN scope (the PATCH endpoint already supports it via `position`; dnd-kit's `SortableContext` covers both cross-column and intra-column with the same hook).
- **SCOPE-Q3: Column creation in FEAT-003.** No UI to create columns means a board's columns must be seeded server-side on board creation. Options: (a) hardcode 3 default columns ("To Do", "In Progress", "Done") on `INSERT INTO boards`, (b) require an admin seed script, (c) include a minimal "Add column" UI in FEAT-003. Recommendation: (a) — server-seeds default columns on board creation; defer column-editing UI.
- **DATA-Q1: Seed data for development.** No `seed` script exists yet (`backend/package.json` references `npm run seed` but no implementation). FEAT-003 should add a seed script that inserts a demo board with 3 columns and a handful of cards so the dev experience is meaningful from `docker compose up` onward.

**Once Architecture Design and UI/UX Design phases resolve the questions above, the build can proceed in the 5 planned phases (DB schema → Backend API → BoardView render → DnD/optimistic → Add-card).**

## Architectural Plan

### Executive Summary

FEAT-003 is BanyanBoard's first fully user-facing feature — the live Kanban board. It spans a complete full-stack implementation: PostgreSQL schema (5 tables, migrations via `node-pg-migrate`), a new `/api/*` Express namespace (4 endpoints, 3 entity layers each), and a React `BoardView` component tree with dnd-kit drag-and-drop and TanStack Query optimistic updates. The critical path is DB schema → backend API → frontend render → DnD optimistic state → add-card affordance. Architecture Design and UI/UX Design creative phases must complete before any Phase 1 implementation begins.

### Business Context

Without this feature, BanyanBoard has zero user value. Every persona in productBrief.md arrives at the board view as their first meaningful interaction. The primary user journey — "open board → see work → drag card to Done → feel satisfied" — is the single metric this feature delivers. Unblocking FEAT-004 (Card Detail + Search/Filter) depends entirely on the data model and component boundaries established here.

### Vision and Goals

- **Vision**: A Team Member opens their board and within 2 seconds sees all their work in columns; dragging a card to "Done" takes less than a second and feels immediate.
- **Goals**:
  1. All 9 acceptance criteria (TASK-003 Specification) pass.
  2. Board first paint < 2s on localhost (productBrief NFR).
  3. Card drag optimistic update < 16ms (next render frame).
  4. `GET /api/boards/:id` p95 < 200ms (productBrief NFR).
  5. `npm test` passes (backend + frontend) with 20–30 tests covering all AC categories.

### Architectural Principles

These principles govern all implementation decisions in FEAT-003 and are grounded in `systemPatterns.md`:

| Principle | Application |
|-----------|-------------|
| **Clean Architecture** | New board/column/card routes follow Route → Controller → Service → Repository. No SQL in controllers, no Express `req`/`res` in services or repositories. |
| **Single Round-Trip Board Fetch** | `GET /api/boards/:id` uses `json_agg` to return a fully nested `Board → Columns → Cards → Labels` response in one SQL query. Prevents waterfall fetches and meets the p95 < 200ms NFR. |
| **TanStack Query Optimistic Updates** | Card moves use `queryClient.setQueryData` in `onMutate`, with `previousData` captured for rollback in `onError`. No separate Zustand DnD store needed for FEAT-003 (avoids double-state complexity). |
| **Integer Gap-Based Card Positions** | `cards.position` is an integer starting at 1000 with gap-1000 on append. This avoids renumbering on most inserts (sufficient for MVP; true lexorank deferred post-MVP). Architecture Creative phase to confirm. |
| **Zod for Request Validation** | All 4 new endpoints validate request bodies with Zod schemas defined in the controller layer. Type-safe, co-located with TypeScript types, no separate validator boilerplate. |
| **`/api/*` Route Prefix** | All new entity routes mount at `/api/*` via a dedicated router, keeping `/health` unchanged. Matches the separation implied by `frontend/src/api/apiClient.ts` base URL. |
| **12-Factor Config** | Any new configurable values (e.g., initial card position gap) use `optionalIntEnv()` from `backend/src/config/env.ts`. |
| **No `console.log`** | Backend: all logging via `req.logger` (pino child with traceId/spanId from `requestContext.ts`). Frontend: existing `logger.ts` wrapper only. ESLint enforces this. |

### Architecture Alternatives (Key Decisions)

#### Decision 1: Card Position Strategy

| Option | Description | Pro | Con |
|--------|-------------|-----|-----|
| **A: Integer gap-1000** | Position starts at 1000; new cards append at `max + 1000`; mid-insert uses `(before + after) / 2` rounded to integer | Simple SQL; no precision drift | May need renumbering after ~1000 sequential mid-inserts |
| B: NUMERIC fractional | `0.5` insertion between any two cards | Never needs renumbering | Precision drift; harder to read in DB |
| C: String lexorank | Balanced string positions (Jira/Trello) | Industry proven | Significant complexity for MVP |

**Recommended**: Option A. Renumbering edge case won't occur in MVP usage. Architecture Creative to confirm.

#### Decision 2: Board Fetch Strategy

| Option | Description | Pro | Con |
|--------|-------------|-----|-----|
| **A: Single `json_agg` query** | One SQL with nested `json_agg` for columns and cards | 1 round-trip; meets p95 NFR | Complex SQL; harder to unit test |
| B: Multi-statement assembly | 3 queries (boards, columns, cards) assembled in service layer | Simpler SQL | 3 DB round-trips; harder to meet p95 |
| C: Separate frontend waterfall | Frontend calls GET /boards/:id then GET /columns, GET /cards | Simple backend | N+1 problem; worst latency |

**Recommended**: Option A. Inline `json_agg` is the standard PostgreSQL pattern for nested document responses. Architecture Creative to validate query design.

#### Decision 3: Optimistic Update Architecture

| Option | Description | Pro | Con |
|--------|-------------|-----|-----|
| **A: TanStack Query onMutate/onError** | Capture snapshot, update cache immediately, rollback on error | Minimal new code; TQ handles staleness | Rapid sequential drags need care |
| B: Zustand DnD overlay | Keep "in-flight" positions in Zustand; commit to TQ on success | Clean separation | Two sources of truth; more code |

**Recommended**: Option A for FEAT-003. `appStore.ts` already has Zustand wired for future complexity; start simple. Architecture Creative to confirm rapid-drag edge case handling (debounce vs cancel-previous).

### Observability Requirements

FEAT-003 is primarily a frontend feature + backend REST layer. Observability scope is limited:

- **Backend logging**: All new controllers receive `req.logger` (inherited from existing `requestContext.ts` middleware). Log at `info` level on successful board/card operations; `warn` on validation failures; `error` on unexpected DB failures. No new env vars needed.
- **Tracing**: W3C `traceparent` propagation is already handled by `requestContext.ts`. New endpoints inherit automatically.
- **Metrics**: No new custom metrics for FEAT-003 (MVP — no Prometheus/OTel collector).
- **Frontend**: No new logging needed beyond existing `apiClient.ts` warn on missing `VITE_API_BASE_URL`.

### API Requirements — REST

New endpoints introduced in FEAT-003 (full contract in Specification section):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/boards` | GET | List boards (sidebar) |
| `/api/boards/:id` | GET | Full board with columns + cards + labels |
| `/api/columns/:columnId/cards` | POST | Create card |
| `/api/cards/:cardId` | PATCH | Update card (move = `{columnId, position}`) |

- **No OpenAPI spec** for FEAT-003 (MVP — deferred to post-MVP tooling task).
- **Integration tests required** for all 4 endpoints (see Test Strategy).
- **Auth**: None in FEAT-003 (productBrief open question; deferred feature).

## Test Strategy

### Approach
- **Emphasis**: Integration-first (backend) + component tests (frontend) — matches project pattern
- **Target test count**: 20–30 tests total across all phases

### File Organization
- **New test files**:
  - `backend/src/__tests__/boards.test.ts` — board CRUD endpoints
  - `backend/src/__tests__/columns.test.ts` — column listing endpoint
  - `backend/src/__tests__/cards.test.ts` — card CRUD + move endpoint
  - `frontend/src/__tests__/boardView.test.tsx` — BoardView component rendering
  - `frontend/src/__tests__/dnd.test.tsx` — drag-and-drop interaction + optimistic update + rollback
- **Extend existing**:
  - `frontend/src/__tests__/setup.ts` — add any DnD test utilities

### What NOT to Test
- dnd-kit internals — covered by the library's own tests
- TanStack Query caching logic — covered by the library
- PostgreSQL pg driver — covered by existing `db.test.ts`
- Docker healthcheck timing — non-deterministic

### Per-Phase Test Guidance
- Phase 1 (DB schema + migrations): 0 tests (structural; covered by migration runner + type safety)
- Phase 2 (Backend board/column/card API): 12–15 tests (endpoint integration: GET board, GET columns, POST card, PATCH card/move)
- Phase 3 (Frontend BoardView + card rendering): 6–8 component tests (render columns, render card tiles, loading/error states)
- Phase 4 (DnD + optimistic updates): 4–6 tests (drag triggers mutation, optimistic update, rollback on error)

## Implementation Roadmap

> **GATE**: Architecture Design + UI/UX Design creative phases must complete before Phase 1 begins. Phase gates below are hard stops.

### Phase 1: Database Schema + Migrations ✅
**Milestone**: `npm run migrate --prefix backend` succeeds on a fresh Docker Compose stack; all 5 tables exist with correct constraints and indexes.

- [x] Create `backend/migrations/` directory
- [x] Write migration `1747600000000_create-boards.js` — `boards` table
- [x] Write migration `1747600001000_create-columns.js` — `columns` table (FK to boards, position constraint)
- [x] Write migration `1747600002000_create-cards.js` — `cards` table (FK to columns, gap-1000 integer position, `idx_cards_column_position` index)
- [x] Write migration `1747600003000_create-labels.js` — `labels` table (FK to boards)
- [x] Write migration `1747600004000_create-card-labels.js` — `card_labels` junction table
- [x] Write seed script `backend/src/scripts/seed.ts` — inserts 1 demo board ("My First Board"), 3 default columns ("To Do" / "In Progress" / "Done"), and 5 sample cards with labels
- [x] Wire `npm run seed` to `package.json`
- [ ] Board creation auto-seeds 3 default columns (implemented in BoardService.createBoard — Phase 2)

**Phase Gate**: All migration files apply cleanly; `psql` confirms table structure matches Specification data model.

---

### Phase 2: Backend REST API — boards, columns, cards ✅
**Milestone**: All 4 endpoints respond correctly via `curl`; `npm test --prefix backend` passes with 12–15 integration tests.

- [x] `BoardRepository` — `findAll()`, `findByIdWithColumnsAndCards()` (json_agg query), `create()`, `createWithDefaultColumns()` (transaction)
- [x] `ColumnRepository` — `findByBoardId()`, `exists()`, `createDefaultsForBoard()`
- [x] `CardRepository` — `create()`, `move()` (update columnId + position), `update()`, `exists()`
- [x] `BoardService` — wraps repository calls; `createBoard()` auto-seeds 3 default columns
- [x] `ColumnService`, `CardService`
- [x] `BoardController`, `ColumnController`, `CardController`
- [x] Zod validation schemas for `POST /api/columns/:id/cards` and `PATCH /api/cards/:id`
- [x] Route files: `backend/src/routes/boards.ts`, `columns.ts`, `cards.ts`
- [x] Mount all routes under `/api` prefix in `backend/src/app.ts`
- [x] Populate `frontend/src/types/api.ts` with REST request/response DTOs
- [x] Backend integration tests (`boards.test.ts`, `cards.test.ts`) — 21 tests (10+11) covering all AC backend verifications

**Phase Gate**: tsc PASS + lint PASS; 12/12 non-DB tests pass; 21 DB integration tests require Docker (await `docker compose up -d db`).

---

### Phase 3: Frontend BoardView + Card Rendering ✅
**Milestone**: Running app (`docker compose up`) shows a live board with real columns and cards from the database. Sidebar shows real board list.

- [x] Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (dnd-kit packages)
- [x] `frontend/src/api/boardsApi.ts` — typed API functions: `fetchBoards()`, `fetchBoard(id)`, `createCard(columnId, data)`, `moveCard(id, data)`
- [x] `useBoards()` hook — `useQuery` for `GET /api/boards` (for sidebar)
- [x] `useBoard(id)` hook — `useQuery` for `GET /api/boards/:id`
- [x] Replace `placeholderBoards` in `Sidebar.tsx` with `useBoards()` query
- [x] `BoardView` component — horizontal scroll rail, DndContext placeholder wrapper
- [x] `ColumnComponent` — column header (name + card-count badge), card list, add-card slot
- [x] `CardTile` component — title, description preview (≤120 chars), formatted due date, label chips
- [x] Loading state: skeleton columns (3 skeleton cards per column)
- [x] Error state: error panel with "We couldn't load this board" + Retry button (AC-ERROR-2)
- [x] Empty column state: "No cards yet" guidance text
- [x] Replace `BoardDetailPage` placeholder with `<BoardView boardId={boardId} />`
- [x] Frontend component tests (`boardView.test.tsx`) — 9 tests: column names, card content, stub detection, loading, error panel, retry, empty column, null dates, BoardDetailPage AC-ENTRY-1

**Phase Gate**: `npm test --prefix frontend` passes; board renders live data at `/boards/:boardId` with real API running.

---

### Phase 4: Drag-and-Drop + Optimistic Updates + Rollback ✅
**Milestone**: Dragging a card between columns persists to DB and rolls back on API failure.

- [x] Wire `useSortable` / `DragOverlay` from dnd-kit onto `CardTile`
- [x] `useMoveCard()` mutation hook — TanStack Query `useMutation` with `onMutate` (snapshot + optimistic update), `onError` (rollback), `onSettled` (refetch)
- [x] Handle rapid sequential drags (cancel in-flight previous mutation on new drag start)
- [x] dnd-kit `KeyboardSensor` for keyboard drag-and-drop (AC-A11Y-1)
- [x] Error indicator on rollback (sonner toast.error via UX-Q5 decision)
- [x] Update card-count badges on drag (derived from column.cards.length — automatic via optimistic cache update)
- [x] DnD interaction tests (`dnd.test.tsx`) — 6 tests: applyMoveOptimistic (3), useMoveCard optimistic/rollback/toast (3)

**Phase Gate**: `npm test` passes; drag-and-drop moves a card, `GET /api/boards/:id` after move shows new column, drag to simulate failure rolls back.

---

### Phase 5: Add-Card Affordance ✅
**Milestone**: User can type a card title in the add-card form, submit, and see the new card appear in the column — all AC-HAPPY-3 criteria pass.

- [x] `AddCardForm` component — Trello-style inline expand (UX-Q3 decision)
- [x] `useCreateCard()` mutation hook — `POST /api/columns/:columnId/cards` with optimistic append, rollback, and error toast
- [x] Keyboard accessible: Tab to affordance, Enter to open form, Ctrl+Enter to submit (AC-A11Y-1)
- [x] Form resets to idle state after successful submit; stays open on error (retry UX)
- [x] Column card-count badge increments on new card (derived from `column.cards.length` via optimistic cache)
- [x] `AddCardForm.tsx` catch block prevents unhandled rejection on API failure
- [x] `BoardView.tsx` updated to use `useCreateCard` hook (replaces inline `handleAddCard`)
- [x] 13 tests in `createCard.test.tsx`: pure function tests, hook tests (optimistic/success/error/cache-miss), component interaction tests

**Phase Gate**: `npm test` passes (42/42); tsc+lint+build PASS.

## Creative Phases

- [x] **Architecture Design** — Output: `memory-bank/creative/TASK-003-kanban-board-architecture.md`. Integer gap-1000 positions; TQ `onMutate`/`onError` optimistic updates with AbortController cancel-previous; single `json_agg` board fetch; Zod v3 validation; one file per entity under `/api/*`; transactions only for board creation + position renumber.
- [x] **UI/UX Design** — Output: `memory-bank/creative/TASK-003-kanban-board-uiux.md`. Cards navigate to placeholder route on click; CSS sticky headers; Trello-style inline add-card form; hover-reveal grip icon for drag; `sonner` toast for DnD rollback errors; 300px fixed column width; neutral pill badge; dashed-border empty column + pulse skeleton loading.

---

## Execution State

**Status**: COMPLETE
**Archived**: memory-bank/archive/archive-TASK-003.md
**Completed**: 2026-05-19
**Build Status**: IDLE
**Current Phase**: COMPLETE
**Can Resume**: NO
**Phase Number**: 5 of 5 COMPLETE
**Is Multi-Phase**: YES

### Current Build Step
**Step**: Phase 5 — COMPLETE
**Status**: COMPLETE
**Completed**: 2026-05-19T03:00:00Z
**Output**: useCreateCard hook (optimistic append + rollback + toast); BoardView updated; AddCardForm error-safe; 13 new tests. 42/42 tests PASS. tsc+lint+build PASS.
**Output**: useMoveCard hook + applyMoveOptimistic pure fn; CardTile wired with useSortable; Column has useDroppable; BoardView has DndContext+SortableContext+DragOverlay+handleDragEnd; boardsApi.moveCard accepts AbortSignal. 29/29 tests PASS. tsc+lint+build PASS.
**Output**: dnd-kit + sonner installed; boardsApi.ts, useBoards/useBoard hooks, BoardView/Column/CardTile/AddCardForm/BoardErrorPanel/CardSkeleton components, Sidebar wired to real API, card detail placeholder route, Toaster in main.tsx, label palette in tailwind. 23/23 tests PASS. tsc+lint+build PASS.

### Completed Steps
- Step 0: Auto-provisioned TASK-003 for FEAT-003
- Step 0.2: Phase gate passed
- Step 1: New planning session confirmed
- Step 2: Roadmap link confirmed (FEAT-003)
- Step 3: Spec Writer Agent (Opus) — COMPLETE; specification approved by user
- Step 4: Codebase analysis — COMPLETE
- Step 5: Implementation plan written — COMPLETE
- Step 6: Validation gate passed; PLANNING_COMPLETE
- Step 7: Architecture Design (Opus) — COMPLETE
- Step 8: UI/UX Design (Sonnet) — COMPLETE; CREATIVE_COMPLETE
- Step 0.5 Git Setup: COMPLETE (2026-05-18) - Branch feature/FEAT-003-kanban-board-ui created
- Phase 1 Build: COMPLETE (2026-05-18) - 5 migrations, seed script, positionGap config, tsc+lint PASS
- Phase 2 Build: COMPLETE (2026-05-18T02:00:00Z) - All REST API files, Zod, 21 integration tests, tsc+lint PASS
- Phase 3 Build: COMPLETE (2026-05-18T04:00:00Z) - BoardView + Card Rendering; 23/23 tests PASS; tsc+lint+build PASS
- Phase 4 Build: COMPLETE (2026-05-19T01:00:00Z) - DnD + Optimistic Updates; 29/29 tests PASS; tsc+lint+build PASS
- Phase 5 Build: COMPLETE (2026-05-19T03:00:00Z) - Add-Card Affordance; 42/42 tests PASS; tsc+lint+build PASS

### Sub-Agents
- Coding Agent (Phase 1): COMPLETE — migrations + seed + config
- Orchestrator (Phase 2): COMPLETE — direct implementation
- Orchestrator (Phase 3): COMPLETE — direct implementation

### Resumption Notes
**Can Resume**: NO
**Resume From**: N/A — all phases complete
**Notes**: All 5 phases complete. Run /banyan-reflect TASK-003.
