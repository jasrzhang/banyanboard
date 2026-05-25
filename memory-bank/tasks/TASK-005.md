
# TASK-005: Realtime Activity Feed

**Complexity**: Level 3
**Status**: COMPLETE
**Reflection**: memory-bank/reflection/reflection-TASK-005.md
**Archived**: memory-bank/archive/archive-TASK-005.md
**Completed**: 2026-05-25
**Merge Status**: merged
**Merge Commit**: 357bfd8
**Roadmap**: FEAT-005
**Branch**: feature/FEAT-005-realtime-activity-feed
**Worktree**: C:/git/banyanboard/.claude-worktrees/FEAT-005

## Task Description

Track and display a realtime activity feed for BanyanBoard. Capture board events (card created, moved, updated, deleted) and surface them in a live-updating feed panel. Requires decisions on realtime transport, activity event schema, and feed UI/UX.

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Lead — wants to see team activity at a glance and spot who is moving work forward. Secondary beneficiary: Team Member — wants confirmation their actions were recorded and to see what teammates are doing.
**Creative Exploration Needed**: Yes — two specific questions require design decisions before implementation planning:
1. **Feed panel placement**: right-side slide-over drawer vs. bottom-anchored panel vs. inline sidebar section — need UX decision based on available viewport real estate alongside the horizontal board layout.
2. **Realtime transport**: SSE (preferred for MVP — unidirectional, no ws upgrade, works through standard HTTP proxies, fits the "no WebSockets in MVP" constraint) vs. short-poll every N seconds (simpler to implement but higher server load). Creative phase must choose one and commit; all three-way splits (SSE/WS/poll) are explicitly out of scope for creative exploration.

### Invocation Method

- **Location**: `frontend/src/components/board/BoardHeader.tsx` — the board-level header bar that already holds the board name, search input, filters dropdown, and "New Card" button.
- **Element**: An "Activity" toggle button (icon + label, or icon-only with tooltip) added to the right side of the BoardHeader, to the left of "New Card". Toggling opens/closes the feed panel.
- **Visibility**: Always visible when a board is loaded; the toggle is always present regardless of whether the feed is open.
- **Navigation**: User opens a board (route `/boards/:id`) → board renders with BoardHeader → user clicks "Activity" button → feed panel slides in or expands alongside the board area.
- **Confidence**: MEDIUM — BoardHeader is confirmed as the correct anchor point (codebase confirms it holds all board-level controls); exact panel presentation mechanism (slide-over vs. inline) deferred to creative phase.

### Success Criteria

- **User sees**: A scrollable activity feed panel listing entries in reverse-chronological order. Each entry shows: event type (card created / moved / updated / deleted), card title, source and/or destination column (for moves), and a relative timestamp (e.g. "2 min ago"). Feed updates in near-realtime (within 3 seconds of the board event) without a page reload.
- **Verifiable at**: The activity feed panel, visible alongside the board while the toggle is active.
- **Data persisted**: New `activity_events` table in PostgreSQL — columns: `id` (UUID PK), `board_id` (UUID FK), `card_id` (UUID, nullable for board-level events), `event_type` (enum: `card_created` | `card_moved` | `card_updated` | `card_deleted`), `payload` (JSONB — card title, from/to column names, changed fields snapshot), `created_at` (timestamp).
- **Observable within**: Feed entry appears within 3 seconds of the triggering action on the same browser session; on a second browser tab viewing the same board the entry should appear within 5 seconds.

### Acceptance Criteria

#### AC-ENTRY-1: User can open the activity feed from the board header
**Priority**: MUST
**Given** a user has a board open at `/boards/:id` and the board has loaded successfully
**When** the user clicks the "Activity" toggle button in the BoardHeader
**Then** the activity feed panel opens and is visible alongside the board columns; the toggle button reflects the open state (e.g., pressed/highlighted); no board columns are obscured on desktop (≥1024px)

#### AC-HAPPY-1: Feed displays existing activity entries on open
**Priority**: MUST
**Given** one or more board events have already occurred (cards created, moved, or updated) before the user opens the feed
**When** the user opens the activity feed panel
**Then** the feed shows a reverse-chronological list of entries; each entry displays: event type label, card title, relevant column info (for moves: "from X → to Y"), and a relative timestamp; the most recent entry appears at the top; an empty-state message ("No activity yet") is shown when no events exist

#### AC-HAPPY-2: Feed displays a newly-created card event without page reload
**Priority**: MUST
**Given** the activity feed panel is open and the board is at `/boards/:id`
**When** the user (or a teammate in a different tab) creates a card via the "Add card" affordance in any column
**Then** a new "card created" entry appears at the top of the feed within 3 seconds of the POST /api/columns/:id/cards response completing; the entry shows the card title and the destination column name; no page reload is required

#### AC-REALTIME-1: Feed updates when a card is moved between columns
**Priority**: MUST
**Given** the activity feed panel is open
**When** the user drags a card from one column to another and the PATCH /api/cards/:id request succeeds
**Then** a "card moved" entry appears at the top of the feed within 3 seconds; the entry shows the card title, source column ("from To Do"), and destination column ("to In Progress"); the board columns reflect the move simultaneously (existing optimistic UI behavior unchanged)

#### AC-REALTIME-2: Feed updates when a card is updated
**Priority**: MUST
**Given** the activity feed panel is open
**When** the user edits a card's title, description, or due date via the card detail modal and saves
**Then** a "card updated" entry appears at the top of the feed within 3 seconds; the entry shows the card title and at minimum indicates that an update occurred (exact changed fields are a SHOULD, not a MUST)

#### AC-ERROR-1: Feed shows a reconnecting state on connection loss
**Priority**: MUST
**Given** the activity feed panel is open and connected
**When** the SSE connection is interrupted (network drop, server restart)
**Then** the feed panel displays a non-blocking "Reconnecting…" status indicator; existing entries remain visible; the connection is automatically retried using browser-native SSE reconnect behavior; once reconnected the indicator disappears; no entries that arrived during the outage are guaranteed to be replayed (best-effort)

#### AC-ERROR-2: Feed shows a graceful error state when SSE is unavailable
**Priority**: MUST
**Given** the activity feed panel is open
**When** the SSE endpoint returns a non-200 status or the connection cannot be established after the initial retry
**Then** the feed panel displays an error message ("Live updates unavailable") and a "Retry" button; clicking Retry attempts to re-establish the connection; existing cached entries (if any) remain visible; the board continues to function normally — the feed panel failure does not break card CRUD or drag-and-drop

#### AC-CLOSE-1: User can close the feed panel and reopen it
**Priority**: MUST
**Given** the activity feed panel is open
**When** the user clicks the "Activity" toggle button again (or presses Escape)
**Then** the feed panel closes; the board columns return to their full visible width; the SSE connection is closed; when the user re-opens the panel the feed reconnects and loads the most recent entries

#### AC-PERSIST-1: Activity entries survive page reload
**Priority**: MUST
**Given** activity events have been recorded in the database
**When** the user reloads the page and opens the activity feed
**Then** the feed shows all previously recorded entries for the board (up to a cap of 50 most recent entries in MVP) in reverse-chronological order; no entries are lost on reload

### Scope Boundaries

**In scope**:
- Activity event capture for four event types: `card_created`, `card_moved`, `card_updated`, `card_deleted` (delete requires adding a DELETE /api/cards/:id endpoint if not already present, or is deferred — see below)
- Backend event emission: service-layer event hooks in `CardService` and `ColumnService` — after a successful repository write, the service calls an `ActivityEventEmitter` (Node.js `EventEmitter`-based, in-process for MVP). No domain event bus; this is the simplest pattern consistent with the codebase's "no premature abstractions" principle.
- `ActivityRepository` — writes events to the new `activity_events` PostgreSQL table; reads recent N events by board ID.
- SSE endpoint: `GET /api/boards/:id/activity-stream` — streams new events to connected clients. Falls back to polling only if SSE creative decision rejects it.
- REST endpoint for initial load: `GET /api/boards/:id/activity` — returns the 50 most recent events for the board (used when the panel first opens).
- Activity feed panel: toggle button in `BoardHeader`, panel component `ActivityFeedPanel`, individual `ActivityEntry` component.
- `useActivityFeed(boardId)` custom hook — manages SSE connection lifecycle, appends incoming events to the cached list, and exposes connection state.
- DB migration: `activity_events` table.

**How backend events are produced** (explicit scope decision):
- Pattern: **Service-layer event hooks** — `CardService.createCard()` (delegated from `ColumnService`), `CardService.updateCard()`, and `CardService.deleteCard()` (new method) each call `this.activityEmitter.emit('activity', event)` immediately after the repository write succeeds.
- `ActivityEventEmitter` is a typed wrapper around Node.js `EventEmitter` injected into services via constructor DI — same DI pattern already used for repositories.
- The emitter is also the SSE broadcast hub: SSE controller registers listeners on the emitter and writes events to connected `Response` streams.
- This is NOT middleware-based (no Express middleware introspection of responses), NOT domain event bus (no external queue), NOT database polling. The in-process emitter is simple, testable, and sufficient for MVP's 2–15 concurrent users.

**Out of scope**:
- WebSocket transport (explicitly excluded by techContext: "No WebSockets in MVP")
- User attribution per event (no auth/identity in MVP — events record action type and card info only)
- Push notifications or email digests
- Activity for column-level events (column added/renamed/deleted) — post-MVP
- Board-level events (board renamed, member added) — post-MVP
- Pagination of the activity feed beyond the 50-event cap
- Guaranteed event replay on reconnect (best-effort SSE reconnect only)
- Card delete event (DELETE endpoint may not exist yet — if not, `card_deleted` events are deferred to a sub-phase; creative phase to confirm)

**Dependencies**:
- Existing `CardService`, `ColumnService`, `CardRepository` — event hooks are additive, no breaking changes
- New `activity_events` PostgreSQL table (migration required)
- Node.js built-in `EventEmitter` (no new npm package needed for in-process emitter)
- Browser-native `EventSource` API for SSE (no additional frontend library needed; supported in Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ — all in-scope browsers)

**NFR implications**:
- Performance: SSE keeps a persistent HTTP connection per open feed panel. For 2–15 concurrent users this is negligible. The `activity_events` table must be indexed on `(board_id, created_at DESC)` to keep the REST initial-load query under the p95 200ms target.
- Accessibility: Feed panel must be keyboard-accessible (toggle via Enter/Space, panel focusable, entries readable by screen reader with `role="log"` and `aria-live="polite"`). Relative timestamps should include an absolute `datetime` attribute.
- Security: SSE endpoint must be board-scoped — clients can only stream events for boards they have access to. For MVP (no auth), the endpoint is unauthenticated but board-ID-scoped (same as all other board endpoints).

### Creative Exploration Needed

Yes — two decisions must be resolved before implementation planning:

1. **Feed panel UX placement and presentation**: Three candidates — (a) right-side slide-over drawer that overlaps the board (lowest impact on board layout), (b) a right-side panel that pushes board columns left (requires BoardView layout restructure), (c) bottom-anchored collapsible panel. The creative phase must evaluate each against the "calm, productivity-focused" design language and the horizontal-scroll board layout, then commit to one.

2. **Realtime transport mechanism — SSE vs. short-poll**: SSE is the preferred MVP direction (fits "no WebSockets" constraint, unidirectional fits the use case, browser-native `EventSource` needs no extra library). Short-poll every 5s is the fallback if SSE raises implementation concerns (e.g., proxy/load-balancer keep-alive issues in self-hosted Docker setups). The creative phase MUST choose one and document the decision rationale. No three-way exploration — WebSocket is explicitly excluded.

## Test Strategy

### Approach
- **Emphasis**: integration-first for backend (supertest + real PostgreSQL); RTL component tests for frontend
- **Target test count**: 19–23 total across all phases

### File Organization
- **New test files**:
  - `backend/src/__tests__/activities.test.ts` — ActivityRepository + ActivityService + GET /activity endpoint + event hooks
  - `backend/src/__tests__/activitySSE.test.ts` — SSE endpoint lifecycle (Phase 2)
  - `frontend/src/__tests__/activityFeed.test.tsx` — ActivityFeedPanel rendering, toggle, empty/error states
- **Extend existing**:
  - `backend/src/__tests__/cards.test.ts` — 2 tests: event emitted on update; event failure doesn't break update
  - `frontend/src/__tests__/boardView.test.tsx` — 1 test: "Activity" toggle button renders in BoardHeader

### What NOT to Test
- Node.js `EventEmitter` internals — framework guarantee
- Browser `EventSource` API itself — tested at hook integration level only
- `node-pg-migrate` migration runner — covered by existing DB test suite
- Docker/SSE keep-alive timing — non-deterministic

### Per-Phase Test Guidance
- **Phase 1 (Backend Core)**: 8–10 tests
  - `ActivityRepository`: insert stores row; findByBoardId returns newest-first; caps at 50
  - `ActivityService.recordEvent`: happy path writes to repo; DB error caught + logged WARN, does not rethrow
  - `GET /api/boards/:boardId/activity`: 200 + array; 200 + empty array; 400 on invalid UUID
  - Event hooks: card create → activity row written; card update → activity row written
- **Phase 2 (SSE Transport)**: 4–5 tests
  - SSE client connects → receives `text/event-stream` headers
  - Activity event emitted → SSE client receives data frame
  - Client disconnects → listener removed from emitter (no leak)
  - Emitter with zero listeners → no-op
- **Phase 3 (Frontend Feed)**: 7–8 tests
  - `BoardHeader` renders "Activity" toggle with `aria-label="Toggle activity feed"`
  - `ActivityFeedPanel` renders events in reverse-chronological order
  - Empty state: "No activity yet" when events array is empty
  - Reconnecting state: "Reconnecting…" indicator visible
  - Error state: "Live updates unavailable" + Retry button
  - Toggle closes panel; SSE connection unmounts
  - `boardView.test.tsx` extension: toggle button present

## Implementation Roadmap

- [x] Phase 1: Backend Core — DB migration, ActivityEventEmitter, ActivityRepository, ActivityService, GET /activity endpoint, event hooks in ColumnController/CardController
- [x] Phase 2: Backend SSE Transport — SSE endpoint, ActivitySSEController, EventEmitter fan-out (transport decided in Architecture Design creative phase)
- [x] Phase 3: Frontend Activity Feed — activitiesApi, useActivityFeed hook, ActivityFeedPanel, ActivityEntry, BoardHeader toggle (panel layout decided in UI/UX Design creative phase)

---

### Phase 1 Detail: Backend Core

**Goal**: `activity_events` table, `ActivityEventEmitter`, full Repository/Service/Controller stack, REST GET endpoint, event hooks in existing card paths. No streaming yet.

**New files:**
- `backend/migrations/<timestamp>_create-activity-events.js` — `pgm.createTable('activity_events', ...)` with `idx_activity_events_board_created` on `(board_id, created_at DESC)`. Columns: `id` uuid PK, `board_id` uuid FK→boards CASCADE, `card_id` uuid nullable FK→cards SET NULL, `event_type` text NOT NULL, `payload` jsonb NOT NULL DEFAULT `'{}'`, `created_at` timestamptz DEFAULT now()
- `backend/src/events/ActivityEventEmitter.ts` — typed `EventEmitter` subclass; `emit('activity', data: ActivityEvent)` / `on('activity', listener)`
- `backend/src/repositories/ActivityRepository.ts` — `insert(event)` + `findByBoardId(boardId, limit=50)` ORDER BY created_at DESC
- `backend/src/services/ActivityService.ts` — constructor `(repo, emitter)`; `recordEvent` (catches + WARN logs on failure, never throws, then `emitter.emit`); `getByBoardId`
- `backend/src/controllers/ActivityController.ts` — `getActivity`: validate boardId UUID, return 200 JSON array
- `backend/src/routes/activity.ts` — `GET /api/boards/:boardId/activity`
- `backend/src/__tests__/activities.test.ts`

**Modified files:**
- `backend/src/app.ts` — register activity router; create shared `ActivityEventEmitter` singleton passed to both `ActivityService` and (Phase 2) `ActivitySSEController`
- `backend/src/routes/columns.ts` — inject `ActivityService` into `ColumnController`
- `backend/src/controllers/ColumnController.ts` — after `service.createCard()` succeeds, fire `void activityService.recordEvent({ eventType: 'card_created', boardId, cardId, payload: { cardTitle, columnName } })`
- `backend/src/routes/cards.ts` — inject `ActivityService` into `CardController`
- `backend/src/controllers/CardController.ts` — after `service.updateCard()` returns, infer event type (move if columnId changed, else update), fire `void activityService.recordEvent(...)`
- `backend/src/__tests__/cards.test.ts` — extend with 2 activity assertions

### Phase 2 Detail: Backend SSE Transport

**Goal**: Stream `ActivityEvent` payloads via `text/event-stream`. Contingent on **Architecture Design creative phase** choosing SSE over short-poll.

**New files (SSE path):**
- `backend/src/controllers/ActivitySSEController.ts` — `stream` handler: set SSE headers; register `activityEmitter` listener; write `data: <json>\n\n` on each event; send `: heartbeat\n\n` every 25s; remove listener on `req.close`
- Extend `backend/src/routes/activity.ts` — add `GET /api/boards/:boardId/activity-stream`
- `backend/src/__tests__/activitySSE.test.ts`

**Modified files:**
- `backend/src/app.ts` — pass shared emitter singleton to `ActivitySSEController`

### Phase 3 Detail: Frontend Activity Feed

**Goal**: Render feed panel with toggle, historical load, live updates, empty/error states. Layout from **UI/UX Design creative phase**.

**New files:**
- `frontend/src/api/activitiesApi.ts` — `fetchActivity(boardId): Promise<ActivityEvent[]>`
- `frontend/src/hooks/useActivityFeed.ts` — `EventSource` lifecycle, event list state, `status: 'connecting'|'connected'|'reconnecting'|'error'`, initial `fetchActivity` on mount
- `frontend/src/components/activity/ActivityFeedPanel.tsx` — panel with all states; `role="log" aria-live="polite"`; layout per creative decision
- `frontend/src/components/activity/ActivityEntry.tsx` — icon + description + `<time datetime={iso}>` relative timestamp
- `frontend/src/__tests__/activityFeed.test.tsx`

**Modified files:**
- `frontend/src/components/layout/BoardHeader.tsx` — add "Activity" toggle button, `aria-label="Toggle activity feed"`
- `frontend/src/pages/BoardDetailPage.tsx` — `activityOpen` boolean state; pass to `BoardHeader` + conditionally render `ActivityFeedPanel`
- `frontend/src/types/domain.ts` — add `ActivityEvent` type
- `frontend/src/__tests__/boardView.test.tsx` — extend

## Creative Phases

- [x] Architecture Design → **SSE chosen** over short-poll; `ActivityEventEmitter` singleton exported at module level from `events/ActivityEventEmitter.ts` (matches `pool` pattern); nginx `proxy_buffering off` documented for self-hosters → `memory-bank/creative/TASK-005-activity-feed-architecture.md`
- [x] UI/UX Design → **Right-side push panel chosen** (`flex-shrink-0 w-80` sibling, pushes columns left); clock icon + "Activity" label toggle; 4-event entry format with icons; full empty/reconnecting/error copy defined → `memory-bank/creative/TASK-005-activity-feed-uiux.md`

---

## Execution State

**Build Status**: IDLE
**Current Phase**: COMPLETE
**Can Resume**: NO
**Worktree Cleaned**: YES
**Branch Deleted**: YES
**Current Build**: ALL PHASES COMPLETE
**Build Completed**: 2026-05-25
**Phase Number**: 3 of 3 COMPLETE
**Is Multi-Phase**: YES

### Current Build Step
**Step**: Step 11 - Git Completion (Phase 3)
**Status**: COMPLETE
**Completed**: 2026-05-25

### Completed Steps
- Step 0: Task created for FEAT-005
- Step 0.1: TASK-005 auto-provisioned
- Step 0.2: Phase gate passed
- Step 3: Spec Writer Agent COMPLETE — approved by human
- Step 4: Codebase analysis COMPLETE
- Step 5: Implementation plan COMPLETE
- Step 6: Validation gate passed — PLANNING_COMPLETE
- Step 7: Architecture Design COMPLETE (2026-05-25) → memory-bank/creative/TASK-005-activity-feed-architecture.md
- Step 8: UI/UX Design COMPLETE (2026-05-25) → memory-bank/creative/TASK-005-activity-feed-uiux.md
- Step 0.5 Git Setup: COMPLETE (2026-05-25) — Worktree at .claude-worktrees/FEAT-005
- Phase 1 Step 1: Read Task Context COMPLETE (2026-05-25)
- Phase 1 Step 2: Load Context COMPLETE (Level 3)
- Phase 1 Step 3: Tests Written COMPLETE — activities.test.ts (7), cards.test.ts extended (+2)
- Phase 1 Step 4: Implementation COMPLETE — 11 files new/modified
- Phase 1 Step 7: Integration Verification COMPLETE — 45/45 tests, TSC clean, ESLint clean
- Phase 1 Step 8: Code Review COMPLETE — APPROVED, 4 recommended fixes applied
- Phase 1 Step 9: Documentation COMPLETE — techContext.md + systemPatterns.md updated
- Phase 1 Step 10: Memory Bank Update COMPLETE (2026-05-25)
- Phase 1 Step 11: Git Commit COMPLETE (2026-05-25)
- Phase 2 Step 1: Read Task Context COMPLETE (2026-05-25) — Phase 2 identified
- Phase 2 Step 2: Load Context COMPLETE (Level 3)
- Phase 2 Step 3: Tests Written COMPLETE (2026-05-25) — activitySSE.test.ts (5 tests)
- Phase 2 Step 4: Implementation COMPLETE (2026-05-25) — ActivitySSEController.ts, routes/activity.ts updated, config/env.ts updated
- Phase 2 Step 7: Integration Verification COMPLETE (2026-05-25) — 50/50 tests, TSC clean, ESLint clean
- Phase 2 Step 8: Code Review COMPLETE (2026-05-25) — APPROVED
- Phase 2 Step 10: Memory Bank Update COMPLETE (2026-05-25)
- Phase 2 Step 11: Git Commit COMPLETE (2026-05-25)
- Phase 3 Step 3: Tests Written COMPLETE (2026-05-25) — activityFeed.test.tsx (7 tests), boardView.test.tsx (+1 test)
- Phase 3 Step 4: Implementation COMPLETE (2026-05-25) — 7 new files + 3 modified
- Phase 3 Step 7: Integration Verification COMPLETE (2026-05-25) — 76/76 tests, TSC clean, ESLint clean
- Phase 3 Step 8: Code Review COMPLETE (2026-05-25) — APPROVED (security: no XSS, cleanup correct)
- Phase 3 Step 10: Memory Bank Update COMPLETE (2026-05-25)
- Phase 3 Step 11: Git Commit COMPLETE (2026-05-25)

### Sub-Agents
(none — orchestrator implementing directly)

### Resumption Notes
**Can Resume**: NO
**Resume From**: N/A
**Notes**: All 3 phases complete and committed. Run /banyan-reflect TASK-005 then /banyan-archive TASK-005.
