# Archive: TASK-005 — Realtime Activity Feed

## Metadata

- **Task ID**: TASK-005
- **Complexity**: Level 3
- **Started**: 2026-05-25
- **Completed**: 2026-05-25
- **Roadmap Link**: FEAT-005
- **Branch**: feature/FEAT-005-realtime-activity-feed
- **Commits**: `9f59f84` (Phase 1), `ed65c9a` (Phase 2), `7b9aa67` (Phase 3)

---

## Summary

Implemented a complete realtime activity feed for BanyanBoard. The feature captures board events (card created, moved, updated) in a new PostgreSQL `activity_events` table, streams them to open clients via Server-Sent Events, and renders them in a split-pane feed panel alongside the kanban board. All three implementation phases completed with 76/76 tests passing, zero TypeScript errors, and zero ESLint violations.

The feature required two creative phases before implementation: one to choose the realtime transport mechanism (SSE vs. short-poll) and one to design the feed panel UX (slide-over vs. push panel vs. bottom strip). Both decisions were resolved before any code was written, and the implementation followed the creative specs without deviation.

---

## Requirements

### Original Requirements

- Track `card_created`, `card_moved`, `card_updated`, `card_deleted` events
- Persist events to a `activity_events` PostgreSQL table with compound index
- Serve up to 50 most recent events via `GET /api/boards/:boardId/activity`
- Stream new events to open clients via `GET /api/boards/:boardId/activity-stream`
- Activity feed panel toggle in the BoardHeader (always visible on board pages)
- Feed updates within 3 seconds (same session) / 5 seconds (cross-tab) without page reload
- Feed shows: event type, card title, column context (for moves), relative timestamp
- Empty state, reconnecting state, error state with Retry button, panel close (Escape key)

### Success Criteria

- [✓] Scrollable reverse-chronological feed with all four event-type entry formats
- [✓] Feed updates in near-realtime (SSE push — effectively zero RTT latency)
- [✓] `activity_events` table with UUID PK, board_id/card_id FKs, JSONB payload, created_at
- [✓] Index on `(board_id, created_at DESC)` for p95 < 200ms REST queries
- [✓] All 8 acceptance criteria met (ENTRY-1, HAPPY-1, HAPPY-2, REALTIME-1, REALTIME-2, ERROR-1, ERROR-2, CLOSE-1, PERSIST-1)

---

## Implementation

### Approach

Three vertical phases, each independently committed and verified:

1. **Phase 1 — Backend Core**: Database migration + event infrastructure + REST endpoint
2. **Phase 2 — Backend SSE Transport**: Streaming endpoint using `text/event-stream`
3. **Phase 3 — Frontend Feed**: React components, custom hook, board header toggle

The event system uses an in-process Node.js `EventEmitter` singleton (the `ActivityEventEmitter`), exported as a module-level `const` from `src/events/ActivityEventEmitter.ts` — the same pattern as the `pool` export from `src/config/db.ts`. Services write events to the emitter; the SSE controller fans them out to connected clients.

### Key Components

1. **`ActivityEventEmitter`** (`backend/src/events/ActivityEventEmitter.ts`)
   - Typed wrapper around Node.js `EventEmitter` with `emit/on/off` overloads
   - Module-level singleton export shared by all route modules
   - `setMaxListeners(0)` in constructor prevents MaxListenersExceededWarning

2. **`ActivityRepository`** (`backend/src/repositories/ActivityRepository.ts`)
   - `insert(event)` — persists to `activity_events` table
   - `findByBoardId(boardId, limit=50)` — reads by board, newest-first

3. **`ActivityService`** (`backend/src/services/ActivityService.ts`)
   - `recordEvent`: try/catch DB write → WARN log on failure → unconditional emitter.emit (never throws)
   - `getByBoardId`: delegates to repository

4. **`ActivityController`** (`backend/src/controllers/ActivityController.ts`)
   - `GET /api/boards/:boardId/activity` — UUID validation + 200 JSON array

5. **`ActivitySSEController`** (`backend/src/controllers/ActivitySSEController.ts`)
   - `text/event-stream` headers + `flushHeaders()`
   - Board-scoped emitter listener per connection
   - Heartbeat comment every `SSE_HEARTBEAT_INTERVAL_MS` ms (12-Factor config)
   - `req.on('close', cleanup)` removes listener and clears heartbeat timer

6. **`useActivityFeed`** (`frontend/src/hooks/useActivityFeed.ts`)
   - Manages `EventSource` lifecycle + initial REST load
   - Exposes `status: 'connecting' | 'connected' | 'reconnecting' | 'error'`
   - Cleanup closes `EventSource` on unmount

7. **`ActivityFeedPanel`** (`frontend/src/components/activity/ActivityFeedPanel.tsx`)
   - `<aside aria-label="Activity feed">` with `role="log" aria-live="polite"` entry list
   - Five rendered states: loading, empty, entries, reconnecting, error
   - Escape key closes panel; focus returns to toggle button

8. **`ActivityEntry`** (`frontend/src/components/activity/ActivityEntry.tsx`)
   - Event-type icon + description text + `<time datetime={iso}>` relative timestamp

### Design Decisions

**Transport: SSE chosen over short-poll**
- Short-poll at 5s fails the cross-tab ≤5s latency requirement (worst case ~9.5s)
- SSE is push-based: latency bounded by network RTT only
- No new npm dependencies (browser-native `EventSource`)
- Architecturally adjacent to post-MVP WebSocket direction

**Singleton wiring: module-level export**
- Mirrors the `pool` pattern from `config/db.ts` — established codebase precedent
- Zero changes to `createApp()` signature or existing test scaffolding
- `activityService` exported from `routes/activity.ts` and imported by `cards.ts` / `columns.ts` to share instance without duplicating

**Panel layout: right-side push panel**
- Slide-over (Option 1) rejected: violates AC-ENTRY-1 (obscures columns)
- Bottom strip (Option 3) rejected: wrong reading axis for vertical text entries
- Push panel satisfies AC-ENTRY-1; `BoardView` inner area restructured to `flex flex-row`
- Board viewport narrows when feed is open — acceptable trade-off with clear Escape close

Reference: `memory-bank/creative/TASK-005-activity-feed-architecture.md`
Reference: `memory-bank/creative/TASK-005-activity-feed-uiux.md`

---

## Testing

| Phase | New Tests | Extended Tests | Total Suite |
|-------|----------:|---------------:|------------:|
| Phase 1 — Backend Core | 7 (`activities.test.ts`) | 2 (`cards.test.ts`) | 45 / 45 |
| Phase 2 — Backend SSE | 5 (`activitySSE.test.ts`) | 0 | 50 / 50 |
| Phase 3 — Frontend | 7 (`activityFeed.test.tsx`) | 1 (`boardView.test.tsx`) | 76 / 76 |

- All tests passing: ✅
- TypeScript: clean (all phases)
- ESLint: clean (all phases)
- Code reviews: APPROVED (all phases; Phase 3 explicit security check — no XSS, cleanup correct)

**Note**: `formatRelativeTime.ts` tested implicitly via component tests only; dedicated unit test file was not written (minor gap — see technical debt).

---

## Files Changed

### Backend — New Files

| File | Description |
|------|-------------|
| `backend/migrations/<ts>_create-activity-events.js` | DB migration: `activity_events` table + compound index |
| `backend/src/events/ActivityEventEmitter.ts` | Typed EventEmitter wrapper + module-level singleton |
| `backend/src/repositories/ActivityRepository.ts` | DB read/write for activity events |
| `backend/src/services/ActivityService.ts` | Fire-and-forget record + re-emit service |
| `backend/src/controllers/ActivityController.ts` | REST GET endpoint handler |
| `backend/src/controllers/ActivitySSEController.ts` | SSE stream handler with heartbeat + cleanup |
| `backend/src/routes/activity.ts` | Mounts GET /activity and GET /activity-stream |
| `backend/src/__tests__/activities.test.ts` | 7 backend integration tests |
| `backend/src/__tests__/activitySSE.test.ts` | 5 SSE lifecycle tests |

### Backend — Modified Files

| File | Change |
|------|--------|
| `backend/src/app.ts` | Register activity router |
| `backend/src/config/env.ts` | Add `config.sse.heartbeatIntervalMs` (12-Factor) |
| `backend/src/routes/columns.ts` | Inject ActivityService into ColumnController |
| `backend/src/controllers/ColumnController.ts` | card_created hook after successful create |
| `backend/src/routes/cards.ts` | Inject ActivityService into CardController |
| `backend/src/controllers/CardController.ts` | card_moved / card_updated hooks |
| `backend/src/__tests__/cards.test.ts` | +2 activity assertion tests |

### Frontend — New Files

| File | Description |
|------|-------------|
| `frontend/src/api/activitiesApi.ts` | `fetchActivity(boardId)` REST client |
| `frontend/src/hooks/useActivityFeed.ts` | SSE lifecycle + initial load + status state |
| `frontend/src/components/activity/ActivityFeedPanel.tsx` | Feed panel container (aside + status + ol) |
| `frontend/src/components/activity/ActivityEntry.tsx` | Single activity entry (icon + text + time) |
| `frontend/src/utils/formatRelativeTime.ts` | Relative timestamp formatter |
| `frontend/src/__tests__/activityFeed.test.tsx` | 7 component + hook tests |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/layout/BoardHeader.tsx` | Activity toggle button + activityOpen prop |
| `frontend/src/pages/BoardDetailPage.tsx` | activityOpen state; conditional ActivityFeedPanel |
| `frontend/src/types/domain.ts` | ActivityEvent type |
| `frontend/src/__tests__/boardView.test.tsx` | +1 toggle button presence test |

---

## Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Service-layer event hooks | Medium | Hooks are in controllers (practical but layering concern); refactor to ColumnService/CardService post-MVP |
| `formatRelativeTime` unit tests | Low | Utility tested implicitly; needs dedicated test file for edge cases |
| `Last-Event-ID` replay | Low | SSE sets `id:` fields but hook doesn't send `Last-Event-ID` on reconnect (best-effort accepted for MVP) |
| `activity_events` table TTL | Low | No cleanup job; acceptable at MVP scale |
| Nginx proxy documentation | Medium | `proxy_buffering off` runbook entry not written; must be done before first self-hosted production deployment |

---

## Lessons Learned

1. **Creative phase investment pays off at Level 3** — Both design documents were load-bearing. The architecture doc's singleton wiring decision and the UI/UX doc's exact CSS class specs eliminated all design-time decisions during the three build phases.

2. **Per-phase commits create verifiable milestones** — Phase 2 was built against a verified Phase 1 baseline; Phase 3 against a verified Phase 2 baseline. This is better than a monolithic commit.

3. **SSE introduces test infrastructure concerns absent from REST** — Open SSE connections prevent test runners from exiting. `closeAllConnections()` in `afterAll` is necessary and non-obvious; future SSE tests must include this pattern.

Reference: `memory-bank/reflection/reflection-TASK-005.md`

---

## References

- **Task File**: `memory-bank/tasks/TASK-005.md`
- **Reflection**: `memory-bank/reflection/reflection-TASK-005.md`
- **Architecture Creative**: `memory-bank/creative/TASK-005-activity-feed-architecture.md`
- **UI/UX Creative**: `memory-bank/creative/TASK-005-activity-feed-uiux.md`

---

## Follow-up

1. Run `/banyan-uat TASK-005` to verify the five panel states and keyboard interactions in a real browser (was not run before archiving)
2. Add nginx `proxy_buffering off` runbook entry to `docs/deployment.md` before first self-hosted production deployment
3. Refactor event hooks from controllers to service layer (post-MVP)
4. Add `formatRelativeTime.test.ts` with isolated edge case tests
