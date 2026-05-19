# User Journey Design: Card Detail Modal + Search/Filter

**Created**: 2026-05-19
**Status**: DECIDED
**Decision Type**: User Journey
**Task**: TASK-004 (Level 3, FEAT-004)

## Journey Overview

**Feature**: Card Detail Modal (inspect + edit card fields) AND Board-level Search/Filter (find cards by title, label, due-date)

**Primary Persona**: Team Member — individual contributor (dev, designer, PM)

**Journey Type**: Synchronous (both sub-journeys)
- Card Detail Modal: Synchronous (open from cache, save round-trip < 200ms p95)
- Search/Filter: Synchronous, real-time (client-side, < 50ms)

**Orchestration Patterns**:
- Card Detail: **Inline Editing inside a Modal/Dialog** (single-screen, focused edit)
- Search/Filter: **Progressive Disclosure with Live Filtering** (board header always-visible search; filter chips below)

### Success Statement
> A team member clicks a card on the board, sees its full title/description/due-date/labels in a focused modal, edits any field inline and clicks Save — the card updates in place on the board without page reload — and can return to the board to filter visible cards by typing in the search bar or clicking label/date chips, narrowing dozens of cards down to the few they care about in under one second.

---

## Persona Context

### Primary User: Team Member
- **Who**: Individual contributor (developer, designer, PM) — from `productBrief.md` Key Personas table
- **Goal**:
  1. Inspect a card's full detail without leaving the board view
  2. Update a card's title/description/due-date in seconds without context switching
  3. Quickly find a specific card by title or by attribute (label, overdue) when the board has many cards
- **Context**: Desktop browser (Chrome/Firefox/Safari/Edge 120+), on a board with 5–100+ cards across columns. Uses BanyanBoard daily for standups, sprint planning, and ad-hoc work updates.
- **Proficiency**: Comfortable with Kanban-style tools (Trello, Linear). Expects keyboard shortcuts, Escape to close, focus management, and snappy interactions. Does **not** want to read documentation.

### Secondary User: Team Lead
- **Who**: Engineering or product lead — same persona table
- **Different needs**: Uses search/filter more heavily than edit. Filters by "Overdue" to spot stale work; filters by label (e.g., "Bug", "Customer-Reported") for triage. Rarely edits cards themselves but inspects detail to read descriptions.
- **Journey delta**: Spends more time in filter chips, less time editing. Same modal entry; treats it more as a read-only inspector.

### Tertiary User: Freelancer / Solo Builder
- **Who**: Solo operator on a single board
- **Different needs**: Manages all cards themselves; uses search to find cards by name when board grows past ~30 items. Lower volume of edits per session, but every edit matters (no team to catch errors).

---

## Journey Map

### Entry Points

| Entry | Context | User Intent |
|-------|---------|-------------|
| Card body button on any `CardTile` | Inside a column on `/boards/:boardId` | "Show me everything about this card; let me edit it" |
| Search input "Search cards" | `BoardHeader` on `/boards/:boardId` | "Find a specific card by name" |
| Label filter chip (e.g., "Bug") | `BoardHeader` below search | "Show me only cards with this label" |
| "Overdue" filter chip | `BoardHeader` next to label chips | "Show me cards I'm late on" |
| "Due Soon" filter chip | `BoardHeader` next to "Overdue" | "Show me cards due in the next 7 days" |

### State Diagram — Sub-Journey A: Card Detail Modal

```
[Entry: User clicks CardTile body button]
    │
    ▼
[Open: CardDetailModal renders as overlay (portal to document.body)]
    │   - Title input pre-filled with card.title
    │   - Description textarea pre-filled (or "Add a description..." placeholder if null)
    │   - Due-date input pre-filled (or "No due date" empty state if null)
    │   - Label chips rendered read-only
    │   - Focus auto-placed on title input
    │
    ├──[Escape key / Close button / Backdrop click] → [Exit: Modal unmounts, focus returns to clicked CardTile]
    │
    ▼
[Edit: User types into title/description, picks date]
    │   - Save button enabled when any field has changed
    │
    ├──[Cancel] → [Exit: Modal unmounts, no changes saved]
    │
    ▼
[Submit: User clicks Save button]
    │
    ▼
[Saving: PATCH /api/cards/:id in flight]
    │   - Save button shows spinner / label "Saving..."
    │   - Form fields disabled (read-only) during request
    │
    ├──[HTTP 4xx/5xx or network error] → [SaveError: Inline error banner appears at top of modal]
    │                                       │  - "Failed to save card. Please try again."
    │                                       │  - Form re-enabled; user's edits preserved
    │                                       │  - Save button re-enabled
    │                                       │  - User can retry → loop back to [Saving]
    │
    ▼
[Success: HTTP 200 — cache updated via TanStack Query]
    │   - Modal closes automatically
    │   - CardTile on board reflects new title/description/due-date
    │   - Toast (optional, low-emphasis): "Card updated"
    │
    ▼
[Return: User back on board view; updated card visible in column]
```

### State Diagram — Sub-Journey B: Search & Filter

```
[Entry: User lands on /boards/:boardId — board renders with all cards visible]
    │
    ▼
[Idle: BoardHeader shows empty search input + neutral filter chips]
    │
    ├──[Type in search input] ──▶ [Filtering: cards hidden in real-time on each keystroke]
    │                                  │   - Cards where title matches (case-insensitive substring) remain visible
    │                                  │   - Non-matching cards: removed from DOM (or hidden)
    │                                  │   - Per-column empty state "No matching cards" if column has zero matches
    │                                  │
    │                                  ├──[Clear search (X button or backspace)] → [Idle]
    │                                  │
    │                                  ▼
    │                              [Filtered View: subset of cards visible]
    │
    ├──[Click label chip] ────────▶ [Filtering: label filter active + chip visually highlighted]
    │                                  │   - Only cards with that label visible
    │                                  │   - Click chip again to remove filter
    │
    ├──[Click "Overdue" chip] ────▶ [Filtering: cards where dueDate < now visible]
    │
    ├──[Click "Due Soon" chip] ───▶ [Filtering: cards where dueDate within 7 days visible]
    │
    └──[Combine: search text + label chip + date chip]
                                  ──▶ [Filtering: AND semantics — all active filters must match]
    │
    ▼
[Filtered View: User scans narrowed-down columns]
    │
    ├──[Click visible CardTile] → [Open Card Detail Modal (Sub-Journey A)]
    │
    ├──[Clear all filters (clear button + chip toggle-off)] → [Idle]
    │
    └──[Navigate to different board] → [Filter state reset to defaults]
```

---

### Step-by-Step Journey — Sub-Journey A: Card Detail Modal

#### Step A1: Entry — User Clicks Card
- **System**: Frontend React (`CardTile.tsx` → `BoardView.tsx`)
- **User Sees**: A card tile on the board with title, optional description preview (2 lines max), due date (if present), and colored label chips. On hover, shadow lifts subtly.
- **User Actions**: Clicks anywhere on the card body (the `<button className="flex-1 text-left...">` element in `CardTile.tsx`). The drag-handle (grip icon) does NOT open the modal — that's reserved for drag.
- **Feedback**: Modal opens within one animation frame (no network call — data already in TanStack Query cache under `['board', boardId]`). Focus trap engages; background board is dimmed by backdrop overlay.
- **Transitions**: `appStore.setSelectedCardId(card.id)` is called via `onCardClick` prop. `CardDetailModal` mounts as a React portal to `document.body` (to escape `AppShell`'s `overflow-auto` clipping).
- **Data Flow**: No API call. Modal reads the card from `useBoard(boardId)` cache by walking `board.columns[].cards[]` for `id === selectedCardId`.

**DOM contract for UAT**:
- Click target: `button[aria-label*="Drag"]`'s sibling — the unlabeled `<button>` containing the card title text. (Recommend adding `data-testid="card-tile-body-{cardId}"` during build to make selector stable.)
- Post-click DOM: `[role="dialog"][aria-modal="true"][data-testid="card-detail-modal"]` is present.

---

#### Step A2: View — Modal Displays Card Detail
- **System**: Frontend React (`CardDetailModal.tsx`)
- **User Sees**:
  - **Header**: Editable title field (text input with current title pre-filled), close button (X icon, top-right) with `aria-label="Close"`.
  - **Body**:
    - **Description section**: Multi-line textarea pre-filled with `card.description`. If `card.description === null`, the textarea is empty but shows a `placeholder="Add a description..."` attribute. (No separate "No description" text node; the empty-state is the placeholder itself — visible until user types.)
    - **Due date section**: A native `<input type="date">` pre-filled with `card.dueDate` (formatted as `YYYY-MM-DD`). If `card.dueDate === null`, the input is empty and a small caption beside it reads "No due date".
    - **Labels section**: All `card.labels` rendered as read-only color chips (same visual treatment as `CardTile`: `backgroundColor: label.color + '33'`, `color: label.color`, padded pill shape). Label chips are NOT clickable in this modal (label management out of scope per spec).
  - **Footer**: A primary "Save" button (right-aligned) and a "Cancel" link/button (left of Save).
- **User Actions**: Read the content; tab through fields; or close (Escape / X / backdrop click / Cancel).
- **Feedback**: Title input has visible focus ring on load (auto-focused). All other fields receive focus ring on tab/click.
- **Transitions**:
  - Escape key → `appStore.setSelectedCardId(null)` → modal unmounts → focus returns to the originating `CardTile`.
  - Backdrop click → same as Escape.
  - Close button click → same as Escape.
  - Type in any field → `Step A3 (Edit)`.
- **Data Flow**: All data displayed comes from the in-memory `useBoard` cache. No outbound calls.

**DOM contract for UAT**:
- Title input: `input[data-testid="card-detail-title"]` (or `input[name="title"]`) — pre-filled value equals `card.title`.
- Description: `textarea[data-testid="card-detail-description"]` — value equals `card.description ?? ''`; `placeholder="Add a description..."`.
- Due date: `input[type="date"][data-testid="card-detail-due-date"]` — value equals `card.dueDate ? card.dueDate.slice(0, 10) : ''`.
- Labels: `[data-testid="card-detail-labels"]` container with N children (one per label).
- Close button: `button[aria-label="Close"][data-testid="card-detail-close"]`.
- Save button: `button[data-testid="card-detail-save"]` — initially disabled (no changes yet) OR enabled (depends on chosen design — recommend disabled until dirty).

---

#### Step A3: Edit — User Modifies Fields
- **System**: Frontend React (controlled inputs in `CardDetailModal`)
- **User Sees**: As they type, the input reflects their keystrokes immediately. Save button transitions from disabled to enabled the moment any field differs from the original card data ("dirty" state).
- **User Actions**:
  - Type in title input (must remain non-empty — empty title triggers inline validation on Save)
  - Type/clear in description textarea
  - Pick a date from the date input, or clear it
- **Feedback**: Field values update in real-time. Optional: a subtle "Unsaved changes" hint near Save button when dirty.
- **Transitions**:
  - User clicks **Save** → `Step A4 (Saving)`.
  - User clicks **Cancel** / Escape → discard changes, modal closes. If field is dirty, a confirmation prompt MAY be shown ("Discard unsaved changes?") — this is a minor UX choice deferred to UI/UX agent.
- **Data Flow**: Local React state holds the edited form values (`title`, `description`, `dueDate`). No API calls during typing.

**Validation rules (client-side, before submit)**:
- `title` must be non-empty after trim. Empty title → inline error under title field: "Title is required". Save button stays disabled or click is no-op.
- `description` may be any string or empty (empty → save as `null` in payload).
- `dueDate` may be a valid ISO date or empty (empty → save as `null` in payload).

---

#### Step A4: Saving — Submit and Wait
- **System**: Frontend (`useUpdateCard` mutation hook) → Express backend (`PATCH /api/cards/:id`) → PostgreSQL (`cards` table UPDATE)
- **User Sees**:
  - Save button shows a loading state: spinner icon + text changes to "Saving..." (or button is disabled and shows spinner).
  - Form fields become read-only (disabled) during the in-flight request to prevent double-edits.
  - Modal stays open; no navigation.
- **User Actions**: Wait. Cannot edit fields. Cannot click Save again.
- **Feedback**: Loading spinner on Save button. Optional: progress feels "instant" because p95 < 200ms NFR target.
- **Transitions**:
  - HTTP 200 response → `Step A5 (Success)`
  - HTTP 4xx/5xx or network error → `Step A4-Error (SaveError)`
- **Data Flow**:
  - **Optimistic write**: Before the network call resolves, `useUpdateCard` writes the new field values into `['board', boardId]` cache (following `useCreateCard`/`useMoveCard` optimistic pattern from FEAT-003).
  - **Network**: `PATCH /api/cards/:id` with JSON body `{ title?, description?, dueDate? }` (only changed fields). Validated by `UpdateCardSchema` in `backend/src/schemas/cardSchemas.ts`.
  - **DB**: `UPDATE cards SET title = $1, description = $2, due_date = $3, updated_at = NOW() WHERE id = $4`.

---

#### Step A4-Error: SaveError — Inline Recovery
- **System**: Frontend (`useUpdateCard.onError` → rollback optimistic write → set error state)
- **User Sees**:
  - **Inline error banner** at the top of the modal (NOT a toast — per AC-ERROR-1, the error must be inside the modal): "Failed to save card. Please try again." (red text, optional icon).
  - Form fields **re-enabled**; user's edits are **preserved** (not reverted in the UI form, even though optimistic cache was rolled back).
  - Save button re-enabled, ready for retry.
  - Modal does NOT close.
- **User Actions**: Read error → optionally tweak fields → click Save again, OR Cancel/Escape to abandon.
- **Feedback**: Error banner has `role="alert"` so screen readers announce it. Save button is re-enabled visually.
- **Transitions**:
  - User clicks Save again → loops back to `Step A4 (Saving)`.
  - User clicks Cancel/Escape → modal closes, optimistic cache already rolled back, no data lost on server.
- **Data Flow**: Cache rolled back to pre-edit state (handled by `useUpdateCard.onError`). User form state preserved in component local state. No automatic retry.

---

#### Step A5: Success — Updates Reflected on Board
- **System**: Frontend (`useUpdateCard.onSuccess` keeps optimistic cache, `onSettled` invalidates `['board', boardId]` for fresh sync)
- **User Sees**:
  - Modal closes automatically (smooth fade-out, no abrupt jump).
  - Focus returns to the `CardTile` that was clicked to open the modal.
  - The `CardTile` now displays the updated title / description preview / due date.
  - Optional low-emphasis toast: "Card updated" (auto-dismiss 2s).
- **Value Delivered**: Card data is now persisted in PostgreSQL and reflected on the board. Confirmed by AC-DATA-1: refreshing the page shows the same updated values.
- **Next Actions**: User can click another card, drag this card to another column, edit another card, or use search/filter.

**DOM contract for UAT**:
- Modal disappears: `document.querySelector('[data-testid="card-detail-modal"]')` returns null.
- Updated `CardTile`: the previously clicked card's `p.text-sm.font-medium` text content equals the new title.
- (For AC-DATA-1 verification) After `location.reload()`, fetch `/api/boards/:id` and confirm response JSON contains the updated values.

---

### Step-by-Step Journey — Sub-Journey B: Search & Filter

#### Step B1: Entry — Board Load
- **System**: Frontend (`BoardDetailPage` → `BoardView` → `BoardHeader`)
- **User Sees**:
  - `BoardHeader` rendering board name (e.g., "My Board"), a search input with placeholder "Search cards", an "Overdue" chip, a "Due Soon" chip, and one chip per distinct label present on any card in the board.
  - All cards visible in their columns.
- **User Actions**: Glance at the header to confirm filters are available; either start typing or click a chip.
- **Feedback**: Search input shows placeholder; chips show neutral (unselected) state.
- **Transitions**: Type in search → `Step B2`. Click chip → `Step B3`.
- **Data Flow**: `BoardHeader` receives `searchQuery`, `activeLabelIds`, `activeDateFilter`, `labels` (derived in `BoardView` from `board.columns.flatMap(c => c.cards).flatMap(c => c.labels)` deduplicated by `label.id`), plus setter callbacks. State lives in `appStore` (Zustand) so it survives `BoardView` re-renders but resets on board navigation.

**DOM contract for UAT**:
- Search input: `input[data-testid="board-search"][placeholder="Search cards"]` with `aria-label="Search cards"` (since there's no visible `<label>` element in the header).
- Label chips: `button[data-testid="filter-label-{labelId}"]` — one per distinct label.
- Date chips: `button[data-testid="filter-overdue"]` and `button[data-testid="filter-due-soon"]`.
- Clear button (if search has text): `button[data-testid="board-search-clear"][aria-label="Clear search"]`.

---

#### Step B2: Search — Type to Filter
- **System**: Frontend (`BoardHeader` → `appStore.setSearchQuery` → `BoardView` re-renders with `filterCards(...)`)
- **User Sees**:
  - As they type each character, `CardTile` elements whose `title.toLowerCase()` does NOT include `searchQuery.toLowerCase()` are removed from the DOM (or hidden).
  - Matching cards stay in place in their columns.
  - Per-column empty state: when a column's filtered card count is 0, renders a centered placeholder text "No matching cards" (in `text-text-secondary` muted style).
  - A clear button (X icon) appears inside the search input when text is present.
- **User Actions**: Continue typing to refine, backspace to broaden, or click X / press Escape (while focus is in search input) to clear.
- **Feedback**: Filter is instant (< 50ms; pure client-side `filterCards` against in-memory cache). No loading indicator needed.
- **Transitions**:
  - Clear search → restore all cards visible (Step B1).
  - Click a chip → combine filters (Step B3).
  - Click a visible `CardTile` → open modal (Sub-Journey A).
- **Data Flow**: `searchQuery` state updates trigger React re-render. `BoardView` calls `filterCards(column.cards, { searchQuery, activeLabelIds, activeDateFilter })` for each column. No network calls.

**Validation / edge cases**:
- Empty search query: all cards visible (no filtering).
- Search query with only whitespace: treated as empty (all visible).
- Search is case-insensitive: "BUG" matches "Fix bug in login".
- Search matches substring: "log" matches both "Login flow" and "Backlog grooming".

---

#### Step B3: Filter by Chip — Label or Date
- **System**: Frontend (`BoardHeader` → `appStore.toggleLabel` or `setDateFilter` → `BoardView` re-renders)
- **User Sees**:
  - Clicked chip transitions to a highlighted/selected state (e.g., filled background instead of outlined).
  - Only cards matching the active chip(s) remain visible.
  - For label chip "Bug": only cards where `card.labels.some(l => l.id === 'bug-label-id')` are visible.
  - For "Overdue": only cards where `card.dueDate !== null && new Date(card.dueDate) < new Date()` are visible.
  - For "Due Soon": only cards where `card.dueDate !== null && new Date(card.dueDate) <= new Date(Date.now() + 7*24*60*60*1000) && new Date(card.dueDate) >= new Date()` are visible.
  - Multiple chips active → AND semantics (all must match).
  - Combined with search query → AND semantics (text match AND label match AND date match).
- **User Actions**: Click another chip to add filter; click an active chip again to remove it; combine with typing.
- **Feedback**: Active chip has clear visual distinction (color fill, checkmark icon, or both). Hover state shows toggle affordance.
- **Transitions**:
  - Click active chip → deactivate that filter.
  - Click another chip → add filter (AND with existing).
  - Click visible card → open modal.
  - Clear all filters (via a "Clear filters" link, recommended when ≥1 filter active) → return to Step B1.
- **Data Flow**: `activeLabelIds: string[]` and `activeDateFilter: 'none' | 'overdue' | 'due-soon'` state in `appStore`. Mutating any triggers `BoardView` re-filter.

**Edge cases**:
- Date filters "Overdue" and "Due Soon" are mutually exclusive (single date filter, not multi-select) — clicking "Due Soon" while "Overdue" is active replaces it.
- Multiple label chips: a card with EITHER label A OR label B matches (OR within label-dimension, AND across dimensions). Note: the spec says "card must match all active filters" — interpreting that as AND across dimensions but OR within labels. Surface this for UI/UX agent confirmation.

---

#### Step B4: Empty Filter Result
- **System**: Frontend (`BoardView` → per-column empty state)
- **User Sees**:
  - Each column header still visible (column titles "To Do", "In Progress", "Done" remain).
  - Inside each column with zero matching cards: a centered, muted placeholder "No matching cards" (e.g., `text-text-secondary text-sm`).
  - If ALL columns have zero matches, the board appears "empty" but the column structure remains — never a fully blank screen.
- **User Actions**: Tweak search, deactivate chips, or clear all filters.
- **Feedback**: Empty state communicates "filter is active, nothing matches" rather than "data failed to load" or "board is broken".
- **Transitions**: Adjust filters → cards reappear.
- **Data Flow**: `filteredCards.length === 0` per column triggers empty state.

**DOM contract for UAT**:
- Empty column: column container has `[data-testid="column-empty-state"]` with text "No matching cards".

---

#### Step B5: Filter Reset on Navigation
- **System**: Frontend (`appStore` board-change effect)
- **User Sees**: When navigating from `/boards/board-1` to `/boards/board-2` (via sidebar), the new board renders with empty search and no active chips.
- **User Actions**: Navigate via sidebar / direct URL.
- **Feedback**: Fresh board view, all cards visible.
- **Transitions**: Filter state cleared in `appStore` on `activeBoardId` change.
- **Data Flow**: `useEffect` in `BoardDetailPage` (or `BoardView`) calls `appStore.resetFilters()` when `boardId` changes.

**Note**: Filter state is intentionally NOT persisted across refreshes (per spec scope boundaries). A page refresh on the same board resets all filters.

---

## Async Handling

**Card Detail Modal — Save operation**:

| Phase | Duration | User Experience |
|-------|----------|-----------------|
| Initiation | Immediate | Save button shows spinner; fields disabled |
| Processing | < 200ms p95 | Spinner visible; no progress bar needed at this duration |
| Completion (success) | N/A | Modal closes; updated CardTile visible; optional toast |
| Completion (error) | N/A | Inline error banner inside modal; fields re-enabled; user retries |

### Progress Communication
- **Method**: Synchronous HTTP response — no polling, websocket, or push notification needed.
- **Frequency**: Single round-trip per Save click.
- **Persistence**: No persistent record of save operations (no audit log in MVP). Last-write-wins; `updated_at` column reflects most recent edit.

### Race condition / concurrent edit
- **Scenario**: User A and User B both open the same card and edit it. User A saves first. User B saves second with stale data.
- **MVP behavior**: Last write wins (User B's values overwrite User A's). No conflict detection in MVP.
- **Mitigation (post-MVP)**: WebSocket sync (in "Future Enhancements" in productBrief). Acceptable for small-team MVP.

---

## Distributed System Flow

### System Boundaries — Sub-Journey A (Card Detail Modal)

```
┌────────────────────────┐     PATCH /api/cards/:id    ┌─────────────────────────┐
│   React Frontend       │ ───────────────────────────▶ │   Express Backend       │
│   - CardDetailModal    │                              │   - cardsController     │
│   - useUpdateCard      │ ◀─────────────────────────── │   - cardsService        │
│   - TanStack cache     │     200 OK { updated Card }  │   - cardsRepository     │
└────────────────────────┘                              └──────────┬──────────────┘
                                                                   │ UPDATE cards SET ...
                                                                   ▼
                                                        ┌─────────────────────────┐
                                                        │   PostgreSQL 15         │
                                                        │   cards table           │
                                                        └─────────────────────────┘
```

### System Boundaries — Sub-Journey B (Search/Filter)

```
┌────────────────────────┐
│   React Frontend       │   (no backend calls during search/filter)
│   - BoardHeader        │
│   - filterCards util   │   pure function applied to cached board
│   - useBoard (cached)  │
│   - appStore filters   │
└────────────────────────┘
```

### Responsibility Matrix

| Step | Owner | State Storage | Failure Handling |
|------|-------|---------------|------------------|
| Click card tile | Frontend | `appStore.selectedCardId` (Zustand) | N/A (UI state, no failure mode) |
| Read card detail | Frontend | TanStack Query cache `['board', boardId]` | Fallback: if cache empty, show loading spinner; if `useBoard` errors, the BoardView error panel already covers this |
| Type in title/description/date inputs | Frontend | React component local state | Inline validation (empty title) |
| Click Save | Frontend → API → DB | Optimistic write to cache, then DB write | On error: rollback cache, inline error banner, preserve form state |
| Search query input | Frontend | `appStore.searchQuery` | N/A (pure function, no failure) |
| Toggle label/date chip | Frontend | `appStore.activeLabelIds`, `appStore.activeDateFilter` | N/A |
| Filter computation | Frontend | Derived (no storage) — `filterCards(cards, filters)` per render | N/A (pure function) |

---

## Error Handling

### Error States

| Error Type | When | User Sees | Recovery |
|------------|------|-----------|----------|
| **Validation: empty title** | User clears title and tries to Save | Inline field error: "Title is required"; Save button disabled OR click no-op | Type a title and retry Save |
| **Network: PATCH fails** | Save click → fetch error / 5xx | Inline error banner in modal: "Failed to save card. Please try again." Form fields preserved and re-enabled | Click Save again (retry) or Cancel to abandon |
| **API: 404 (card deleted)** | Save click → server returns 404 (rare; would need concurrent delete which isn't an MVP feature, but graceful handling required) | Inline error banner: "This card no longer exists." | Close modal; cache invalidation refreshes board |
| **API: 400 (invalid payload)** | Save click → Zod validation rejects (e.g., title > 500 chars) | Inline error banner with server-supplied message OR generic "Invalid input" | Trim input and retry |
| **Cache miss** | `selectedCardId` set but `useBoard` returned no card with that id (e.g., card was filtered out by stale cache) | Modal shows skeleton/spinner briefly; if still missing after `useBoard` settles, close modal silently | Auto-recover: close modal, log warning |
| **Filter: no matches** | Search/filter combination yields zero results in a column | Column empty state: "No matching cards" | User adjusts/clears filters |
| **Filter: all columns empty** | All cards filtered out across the board | All columns show empty state; recommend a board-level hint "No cards match your filters" near the search bar with a "Clear filters" button | Clear filters |

### Partial Failure
- **Scenario**: Save updates description successfully but the optimistic write to the cache fails (rare; logic bug). Modal reports success but the CardTile shows stale data.
- **Mitigation**: `onSettled` always invalidates `['board', boardId]`, forcing a fresh fetch. Within ~200ms the CardTile reflects the true server state.

- **Scenario**: User's `useBoard` query is stale (data fetched 5+ minutes ago); they edit a card whose `position` has changed on the server.
- **MVP behavior**: PATCH does not touch `position` (only title/description/dueDate), so position drift does not corrupt the save. `onSettled` invalidate ensures position re-syncs.

---

## Options Explored

### Option 1: Route-Based Modal (URL changes on open)

- **Orchestration**: Modal/Dialog rendered at `/boards/:boardId/cards/:cardId` route (replacing `CardDetailPlaceholderPage`). URL updates when modal opens; deep-linkable.
- **Flow Summary**: Click card → `navigate('/boards/${boardId}/cards/${card.id}')` (already in `CardTile.tsx` line 83) → React Router renders `CardDetailPage` which renders both `<BoardView>` (in background) and `<CardDetailModal>` (overlay). Closing modal calls `navigate('/boards/${boardId}')`. Browser back-button closes modal.
- **Wireframe**:
  ```
  URL: /boards/board-1/cards/card-abc

  ┌──────────────────────────────────────────────────────┐
  │  [☰] My Board    [Search... ] [Bug] [Overdue]  [New] │
  ├──────────────────────────────────────────────────────┤
  │     ┌───────────────────────────────────┐            │
  │     │  ✕ Close                          │            │
  │     │  ┌─────────────────────────────┐  │            │
  │     │  │  Fix login flow             │  │            │
  │     │  └─────────────────────────────┘  │            │
  │  T  │                                   │     I      │
  │  o  │  Description                      │     n      │
  │     │  ┌─────────────────────────────┐  │            │
  │  D  │  │ Add a description...        │  │     P      │
  │  o  │  └─────────────────────────────┘  │     r      │
  │     │                                   │     o      │
  │     │  Due date                         │     g      │
  │     │  [2026-06-01]                     │            │
  │     │                                   │            │
  │     │  Labels: [Bug] [Backend]          │            │
  │     │                                   │            │
  │     │           [Cancel]  [Save]        │            │
  │     └───────────────────────────────────┘            │
  │     (board dimmed in background)                     │
  └──────────────────────────────────────────────────────┘
  ```
- **Pros**:
  - Deep-linkable (share a card URL with a teammate)
  - Browser back-button closes modal naturally
  - Existing route `/boards/:boardId/cards/:cardId` already wired up — minimal router changes
  - Refresh on a card-detail URL re-opens the modal
- **Cons**:
  - URL changes feel less "modal" and more "page" (slight cognitive dissonance — Linear and Trello both use URL-modal pattern, so this is industry-standard)
  - Requires `CardDetailPage` to render both `BoardView` and modal (or use React Router's nested layout with `<Outlet>`)
  - History pollution if user opens/closes many cards (one URL per open)
  - Slightly more complex routing logic

### Option 2: React Overlay (no URL change)

- **Orchestration**: Modal/Dialog rendered as a React portal triggered by Zustand state (`appStore.selectedCardId`). URL does NOT change.
- **Flow Summary**: Click card → `setSelectedCardId(card.id)` → `<CardDetailModal>` portal mounts to `document.body`. Closing modal → `setSelectedCardId(null)`. Browser back-button does NOT close modal (it navigates to the previous page entirely).
- **Wireframe**:
  ```
  URL: /boards/board-1   (unchanged when modal opens)

  Same visual as Option 1, but URL stays put.
  ```
- **Pros**:
  - Simplest implementation (no routing logic)
  - No history pollution
  - Modal feels like a transient overlay (matches the word "modal")
  - Faster to ship — fewer moving parts
- **Cons**:
  - NOT deep-linkable — can't share a card URL
  - Browser back-button navigates AWAY from the board entirely (jarring; user expected back to close modal)
  - Refresh on modal-open URL just shows the board, losing context
  - Existing route `/boards/:boardId/cards/:cardId` becomes unused legacy

### Option 3: Hybrid — URL-Driven Modal with State Mirror

- **Orchestration**: URL is the source of truth (`/boards/:boardId/cards/:cardId`), but Zustand mirrors `selectedCardId` for components that don't want to read URL params. `BoardDetailPage` reads the URL via `useParams` and renders the modal accordingly.
- **Flow Summary**: Click card → `navigate('/boards/${boardId}/cards/${card.id}')` → `BoardDetailPage` sees `cardId` param and renders modal alongside board. Closing modal → `navigate(-1)` or `navigate('/boards/${boardId}')`. Zustand `selectedCardId` syncs with URL via `useEffect`.
- **Wireframe**: Same as Option 1.
- **Pros**:
  - Deep-linkable AND simple component API (state-based reads)
  - Browser back-button closes modal
  - Smooth migration path: if Option 2 is needed later (e.g., for a future flow without URL), the state layer is already there
- **Cons**:
  - Two sources of truth (URL + Zustand) — risk of drift; need careful sync logic
  - More code to write and test
  - Possible flash on refresh as Zustand initializes from URL

---

## Evaluation Matrix

| Criterion | Option 1: Route-Based | Option 2: React Overlay | Option 3: Hybrid |
|-----------|----------------------|------------------------|-------------------|
| Discoverability | H (same as Option 2) | H | H |
| Learnability | H (industry standard: Trello, Linear use URL modals) | H (simple "click → modal") | H |
| Efficiency | H | H | H |
| Error Prevention | H | H | M (sync drift risk) |
| Error Recovery | H (back-button closes) | M (back-button leaves board) | H |
| Consistency | H (matches existing route `/cards/:cardId`) | M (orphans the existing route) | H |
| Accessibility | H | H | H |
| **Implementation Complexity** | M (router refactor needed) | L (state-only) | H (state + URL sync) |
| **Future-proofing** | H (deep links, refresh-friendly) | L (no deep links) | H |

---

## Decision

**Chosen**: **Option 1 — Route-Based Modal**

### Rationale

1. **Existing infrastructure favors it**: The route `/boards/:boardId/cards/:cardId` is already wired (used by `CardDetailPlaceholderPage`) and `CardTile.tsx` line 83 already calls `navigate()` to it. Switching to Option 2 would require ripping out the placeholder route and changing the click handler.

2. **Industry standard matches user mental model**: Linear, Trello, and GitHub Projects all use URL-based modals. Team Members (primary persona) coming from these tools will expect:
   - Right-click → "Copy link" on a card produces a shareable URL
   - Browser back-button closes the card (returns to board)
   - Refreshing on a card-detail URL re-opens that card

3. **Deep-linking is a real workflow**: Team Lead persona use case — "Hey, check out this card: <paste URL in Slack>". This is impossible with Option 2.

4. **Browser back-button is a delight feature**: For keyboard-and-mouse desktop users (the only MVP target), `Alt+Left` or `⌘+[` to close the modal is a power-user shortcut they'll discover and love.

5. **Refresh persistence**: AC-DATA-1 verifies that card edits persist across page refresh. With Option 1, the user can refresh while the modal is open and still see their edited card — Option 2 would dismiss the modal on refresh, requiring them to re-click.

### Trade-offs Accepted

- **Trade-off 1: Slightly more routing complexity**
  - **Why acceptable**: `BoardDetailPage` will render `BoardView` + conditional `CardDetailModal` based on `useParams().cardId`. About 20 extra lines of code; well-tested pattern.
- **Trade-off 2: History pollution if user opens/closes many cards**
  - **Why acceptable**: Use `navigate(..., { replace: true })` on close to avoid back-button stack growth from rapid open/close cycles. Linear and GitHub Projects accept the same trade-off.
- **Trade-off 3: `CardDetailPlaceholderPage` is replaced (not extended)**
  - **Why acceptable**: That page was always a placeholder; replacement is the planned flow.

### Sub-Journey B (Search/Filter) — Pattern Decision

**Chosen pattern**: **Progressive disclosure with live filtering**
- Search input always visible (primary affordance)
- Filter chips below (secondary, contextual based on what labels exist)
- Filter state in Zustand `appStore` (matches existing pattern; survives `BoardView` re-renders; resets on board change)
- No URL persistence (filters do not affect URL — per scope boundaries "Persisting filter state across page navigation or refresh" is out of scope)

This is uncontroversial — no alternatives explored because the spec is prescriptive.

---

## Implementation Guidelines

### Frontend Requirements

1. **Component: `frontend/src/components/card/CardDetailModal.tsx`** — new file
   - Props: `{ boardId: string; cardId: string; onClose: () => void }`
   - Reads card from `useBoard(boardId)` cache; redirects (closes modal) if card not found
   - Local state for `title`, `description`, `dueDate`, `isDirty`, `saveError`
   - Calls `useUpdateCard(boardId, cardId)` mutation on Save
   - Renders into portal at `document.body` (per spec implementation note)
   - Focus trap, `Escape` to close, `aria-modal="true"`, `role="dialog"`

2. **Component: `frontend/src/pages/BoardDetailPage.tsx`** — modify
   - Read `cardId` from `useParams()`
   - Render `<BoardView boardId={boardId} />` always
   - Render `<CardDetailModal boardId={boardId} cardId={cardId} onClose={...} />` when `cardId` present
   - `onClose` calls `navigate('/boards/${boardId}', { replace: true })`

3. **Component: `frontend/src/components/card/CardTile.tsx`** — keep `navigate('/boards/${boardId}/cards/${card.id}')` as-is (Option 1 means no change to entry point)

4. **Component: `frontend/src/components/layout/BoardHeader.tsx`** — modify
   - Add props: `boardName`, `searchQuery`, `onSearchChange`, `labels`, `activeLabelIds`, `onLabelToggle`, `activeDateFilter`, `onDateFilterChange`
   - Render search input, label chips, "Overdue"/"Due Soon" chips
   - Search input has `aria-label="Search cards"`

5. **State: `frontend/src/store/appStore.ts`** — extend
   - No `selectedCardId` needed (URL is source of truth for Option 1)
   - Add: `searchQuery: string`, `activeLabelIds: string[]`, `activeDateFilter: 'none' | 'overdue' | 'due-soon'`
   - Add setters and a `resetFilters()` action

6. **Hook: `frontend/src/hooks/useUpdateCard.ts`** — new file
   - Mutation hook with optimistic write to `['board', boardId]`, rollback on error
   - Exposes `error` for inline display (DO NOT toast — per AC-ERROR-1, error stays in modal)

7. **Utility: `frontend/src/utils/filterCards.ts`** — new file
   - Pure function `filterCards(cards: Card[], filters: FilterState): Card[]`
   - Implements case-insensitive title substring match, label ID set match, date-based filters
   - Tested in isolation

8. **API client: `frontend/src/api/boardsApi.ts`** — extend
   - Add `updateCard(cardId, data: UpdateCardRequest)` calling `PATCH /api/cards/:id`

### Backend Requirements

**No new backend work required** — `PATCH /api/cards/:id` and `UpdateCardSchema` from FEAT-003 already support title/description/dueDate updates.

### Integration Points

| System | Interface | Data Exchanged |
|--------|-----------|----------------|
| React Router | URL params | `boardId`, `cardId` (presence determines modal open/closed) |
| TanStack Query | Cache key `['board', boardId]` | Read for modal display; write optimistically on save; invalidate `onSettled` |
| Express PATCH /api/cards/:id | HTTP/JSON | Body: `{ title?, description?, dueDate? }`; Response: updated `Card` |
| Zustand appStore | Read/write | `searchQuery`, `activeLabelIds`, `activeDateFilter` |
| sonner | Toast notification | (Optional) low-emphasis "Card updated" toast on success; NOT used for errors |

---

## Acceptance Criteria (MANDATORY)

These criteria are the source of truth for E2E test creation and UAT browser walks. They match the locked AC list in `tasks/TASK-004.md` plus user-journey-derived extensions (AC-NAV-1, AC-INTEGRATION-1).

### AC-ENTRY-1: User can open card detail by clicking a card
**Priority**: MUST

**Given** the user is on `/boards/:boardId` (board has at least one card rendered as a `CardTile`)
**When** the user clicks the card body button on any `CardTile` (the `<button className="flex-1 text-left...">` element — not the drag-handle grip icon)
**Then**:
  - User sees: A modal/dialog overlay appears with `role="dialog"` and `aria-modal="true"`
  - URL is: Updated to `/boards/:boardId/cards/:cardId`
  - The placeholder text "Card detail — coming soon" from `CardDetailPlaceholderPage` is NOT shown
  - The clicked card's title is rendered inside the modal as an editable input

**Verification**:
- [ ] E2E: Click a CardTile and verify `[role="dialog"]` appears in DOM
- [ ] E2E: Verify URL contains `/cards/${cardId}`
- [ ] E2E: Verify placeholder text "Card detail — coming soon" is absent
- [ ] E2E: Verify title input value matches the clicked card's title

---

### AC-HAPPY-1: Modal displays all card fields
**Priority**: MUST

**Given** the user has clicked a card with `title: "Fix login bug"`, `description: "Users report 500 on submit"`, `dueDate: "2026-06-01"`, and `labels: [{id, name: "Bug", color: "#ef4444"}]`
**When** the modal renders
**Then**:
  - Title input value equals "Fix login bug"
  - Description textarea value equals "Users report 500 on submit"
  - Due date input value equals "2026-06-01"
  - Label "Bug" appears as a colored chip with `backgroundColor: "#ef4444" + "33"` and text color "#ef4444"

**Verification**:
- [ ] E2E: Seed card with known data, open modal, assert each field's DOM value
- [ ] Integration: Component test with mock card asserts each field renders

---

### AC-HAPPY-2: User edits and saves; changes persist
**Priority**: MUST

**Given** the user has the `CardDetailModal` open for a card with `title: "Original"`, `description: null`, `dueDate: null`
**When** user performs these EXACT steps:
  1. Clears title input and types "Updated title"
  2. Types "Added description" into description textarea
  3. Picks "2026-06-15" in due date input
  4. Clicks the "Save" button (`button[data-testid="card-detail-save"]`)
**Then**:
  - User sees: Modal closes within 1 second
  - User sees: The `CardTile` on the board shows title "Updated title"
  - Data is: PATCH /api/cards/:id was called with `{ title: "Updated title", description: "Added description", dueDate: "2026-06-15..." }`
  - Data is: PostgreSQL `cards` table row updated; subsequent `GET /api/boards/:id` returns updated values

**Verification**:
- [ ] E2E: Full edit-and-save flow with assertion on CardTile DOM after modal closes
- [ ] Integration: Mock PATCH endpoint, assert correct request body
- [ ] Integration: After save, GET /api/boards/:id returns updated card

---

### AC-HAPPY-3: Search bar filters by title in real-time
**Priority**: MUST

**Given** the user is on `/boards/:boardId` with 3 cards: "Fix login bug", "Add signup form", "Update homepage"
**When** the user types "log" into the search input (`input[data-testid="board-search"]`) character-by-character
**Then**:
  - After typing "l": all 3 cards still visible ("login" and "signup" both contain "l"? No — wait: "Fix login bug" and "homepage" → "log" partial match)
  - After typing "lo": "Fix login bug" visible; "Update homepage" not visible (no "lo"); "Add signup form" not visible
  - After typing "log": only "Fix login bug" visible
  - Clearing the input (backspace or X button): all 3 cards visible again
  - No network requests fired during typing

**Verification**:
- [ ] E2E: Type into search and assert DOM `CardTile` count per step
- [ ] E2E: Network panel shows zero requests during search typing
- [ ] Component: filterCards pure function unit tests

---

### AC-HAPPY-4: Label and date filter chips narrow visible cards
**Priority**: MUST

**Given** the user is on `/boards/:boardId` with cards having mixed labels (e.g., 2 cards with "Bug" label, 3 without) and mixed due dates (1 overdue, 2 in next 7 days, 2 with no date)
**When** the user clicks the "Bug" label chip (`button[data-testid="filter-label-${bugLabelId}"]`)
**Then**:
  - User sees: Only the 2 cards with "Bug" label are visible; 3 are hidden
  - Chip is visually highlighted (selected state)
**When** the user then clicks the "Overdue" chip
**Then**:
  - User sees: Only cards that have "Bug" label AND are overdue (AND across dimensions)
**When** the user clicks "Bug" chip again
**Then**:
  - Label filter removed; only "Overdue" remains
**When** the user combines text search "fix" + "Bug" label
**Then**:
  - Both filters apply (AND); only cards with title containing "fix" AND label "Bug" visible

**Verification**:
- [ ] E2E: Click chips and assert visible card counts at each combination
- [ ] E2E: Assert chip visual state (highlighted vs neutral)
- [ ] Component: filterCards pure function tests for each filter dimension

---

### AC-ERROR-1: Save failure keeps modal open with inline error
**Priority**: MUST

**Given** the `CardDetailModal` is open with edited fields; the backend `PATCH /api/cards/:id` will respond with HTTP 500 (mocked or simulated)
**When** the user clicks "Save"
**Then**:
  - User sees: Modal remains open (does not close)
  - User sees: An inline error message inside the modal: "Failed to save card. Please try again." with `role="alert"` for screen-reader announcement
  - User sees: Form field values are preserved (their edits are not reverted in the UI)
  - User can: Click Save again to retry (button is re-enabled)
  - User can: Press Escape or click Cancel to dismiss without saving
  - The error is NOT shown as a sonner toast (per spec AC-ERROR-1)

**Verification**:
- [ ] E2E: Mock 500 response, click Save, assert modal still open and error text visible
- [ ] E2E: Retry Save with mock 200 — should succeed
- [ ] Component: Mock useUpdateCard error state, assert inline error renders

---

### AC-ERROR-2: Cards with null description/dueDate show empty states
**Priority**: MUST

**Given** a card exists with `description: null` and `dueDate: null` (valid per the `Card` type)
**When** the user opens the `CardDetailModal` for that card
**Then**:
  - User sees: The description textarea is empty but shows the placeholder "Add a description..." (visible until they type)
  - User sees: The due date input is empty; a caption "No due date" is visible adjacent to it (or the input itself communicates emptiness clearly)
  - No JavaScript errors thrown (verifiable via `console.error` not called)
  - No "null" or "undefined" strings rendered in the DOM
  - User can: Type into description and pick a date — fields are fully functional

**Verification**:
- [ ] E2E: Seed card with null fields, open modal, assert placeholder text and absence of literal "null"
- [ ] E2E: Listen to console errors during modal open — assert none thrown
- [ ] Component: Render modal with null-valued card mock and assert empty state behavior

---

### AC-DATA-1: Edits persist across page refresh
**Priority**: MUST

**Given** the user successfully edited and saved a card (title, description, and due date) via the modal
**When** the user refreshes the browser page (`Ctrl/Cmd+R`) on `/boards/:boardId`
**Then**:
  - User sees: The `CardTile` displays the updated title and (if shown) description preview
  - User sees: If they re-open the modal for that card, all updated values are pre-filled
  - Data is: A fresh `GET /api/boards/:id` request returns the updated values

**Verification**:
- [ ] E2E: Save edit, reload page, assert CardTile shows updated title
- [ ] E2E: Re-open modal, assert all fields show updated values
- [ ] Integration: After save, direct API call to GET /api/boards/:id confirms persistence

---

### AC-NAV-1: User can navigate away and return; modal behavior is consistent
**Priority**: SHOULD

**Given** the user has the modal open at `/boards/:boardId/cards/:cardId` with unsaved edits
**When** the user clicks the browser back button
**Then**:
  - Modal closes (URL reverts to `/boards/:boardId`)
  - Board view remains visible
  - Unsaved edits are discarded (no persistence of in-progress form state across navigation)

**Given** the user has filters active (search text + label chip) on `/boards/:boardId`
**When** the user navigates to a different board via sidebar (`/boards/:otherBoardId`)
**Then**:
  - Filters reset on the new board (empty search, no active chips)
**When** the user navigates back to the original board
**Then**:
  - Filters are still reset (filter state intentionally not persisted — per spec scope)

**Verification**:
- [ ] E2E: Open modal, browser back, assert URL and modal closed
- [ ] E2E: Apply filters, navigate to another board, assert filters reset
- [ ] E2E: Navigate back, confirm filters still reset

---

### AC-INTEGRATION-1: Backend persists actual edited values
**Priority**: MUST

**Given** input data: a card with `id: "card-test-001"`, `title: "Original Title"`, edited to `title: "Specific Updated Title 2026-05-19"`, `description: "Test description with unique marker 7F3A"`, `dueDate: "2026-12-31"`
**When** the user clicks Save and PATCH /api/cards/:id is processed by backend → service → repository → PostgreSQL
**Then**:
  - PostgreSQL `cards` table for `id = 'card-test-001'`:
    - `title = 'Specific Updated Title 2026-05-19'` (NOT the original)
    - `description = 'Test description with unique marker 7F3A'`
    - `due_date = '2026-12-31T00:00:00.000Z'` (or appropriate ISO timestamp)
    - `updated_at > created_at`
  - Subsequent `GET /api/boards/:id` response contains a card with these exact values
  - The values are NOT placeholder/stub text; they're derived from user input

**Anti-stub verification**:
- [ ] Submit different inputs in two separate save operations; verify outputs differ
- [ ] Verify response body field-by-field matches input
- [ ] Verify no hardcoded "TODO", "sample", or "test placeholder" strings in response

---

### AC-A11Y-1: Modal is keyboard-accessible and screen-reader friendly
**Priority**: MUST (per WCAG 2.1 AA best-effort NFR)

**Given** the user is keyboard-only (no mouse)
**When** they navigate to a card via Tab and press Enter on the card body button
**Then**:
  - Modal opens; focus moves into the modal (specifically to the title input)
  - Tab cycles through: Title → Description → Due Date → Cancel → Save → (back to Close button or wraps to Title)
  - Focus is trapped inside the modal (Tab does not escape to the underlying board)
  - Escape key closes the modal
  - Focus returns to the originating `CardTile` after close
  - Modal has `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the title field or a heading

**Verification**:
- [ ] E2E: Keyboard navigation through modal — assert focus order
- [ ] E2E: Press Escape, assert modal closes and focus returns to triggering CardTile
- [ ] E2E: axe-core scan inside open modal — zero `impact: critical` violations

---

## Test Scenarios (Derived from Acceptance Criteria)

### Happy Path Tests
1. **AC-ENTRY-1**: Click CardTile → modal opens at correct URL → placeholder absent
2. **AC-HAPPY-1**: Modal renders all four card field types correctly (title, description, due date, labels)
3. **AC-HAPPY-2**: Edit + Save → modal closes → CardTile reflects new title → DB persisted
4. **AC-HAPPY-3**: Type in search → cards filter in real-time → clear restores
5. **AC-HAPPY-4**: Label + date chips filter cards; AND combination semantics
6. **AC-DATA-1**: Reload page → updated values persist

### Error Scenario Tests
1. **AC-ERROR-1**: Mock 500 on save → modal stays open with inline error → retry works
2. **AC-ERROR-2**: Card with null description/dueDate → empty states render → no literal "null" → no console errors
3. **Validation: empty title** → Save disabled or click no-op with inline "Title is required"

### Edge Case / Navigation Tests
1. **AC-NAV-1**: Browser back closes modal; navigate-away resets filters
2. **AC-A11Y-1**: Keyboard nav + focus trap + Escape + axe scan

### Integration Tests
1. **AC-INTEGRATION-1**: Specific edited values appear in PostgreSQL and subsequent GET response

---

## Accessibility Checklist

- [x] Keyboard navigation through entire modal (Tab order: Close → Title → Description → DueDate → Cancel → Save)
- [x] Escape key closes modal and returns focus to triggering element
- [x] Focus trap inside modal (Tab does not escape to background board)
- [x] Modal has `role="dialog"` and `aria-modal="true"`
- [x] Search input has `aria-label="Search cards"` (no visible label)
- [x] Filter chips are `<button>` elements (not `<div>`) with clear active/inactive `aria-pressed` state
- [x] Error message has `role="alert"` for screen-reader announcement
- [x] Empty-state placeholders are visible text content (not `aria-label`-only)
- [x] Label color chips meet contrast ratio for text-on-background (label.color text on label.color+33 background — verify with axe-core)
- [x] No time limits / auto-dismiss without user control (modal stays open until user dismisses)
- [x] Focus indicators visible on all interactive elements

---

## Analytics & Observability

### Key Metrics (post-MVP; not blocking)

| Metric | Purpose | Target |
|--------|---------|--------|
| Modal-open count per session | Engagement | > 5 (Team Member persona) |
| Edit-save success rate | Quality | > 99% (network errors only) |
| Time from modal-open to Save click | Efficiency | < 30s p50 |
| Search-query length distribution | Filter usage pattern | Inform future fuzzy-search improvements |
| Filter chip click rate | Discoverability of secondary filters | > 30% of sessions use at least one chip |

### Instrumentation Points (post-MVP)
- `modal_opened`: `{ cardId, boardId, sourceTrigger: "click" | "deep-link" }`
- `card_saved`: `{ cardId, changedFields: string[], success: boolean, latencyMs }`
- `search_filtered`: `{ boardId, queryLength, resultsCount }` (debounced, fire every 500ms)
- `filter_applied`: `{ boardId, filterType: "label" | "overdue" | "due-soon", labelId? }`

**Backend observability** (existing from FEAT-002 Phase 5): All `PATCH /api/cards/:id` requests automatically logged with `traceId`, `method`, `path`, `statusCode`, `durationMs` via `requestLogger` middleware. No new logging required.

---

## Validation Checklist

- [x] Journey delivers stated value (inspect+edit cards; find cards quickly)
- [x] All personas can complete journey (Team Member primary; Team Lead read-heavy variant; Freelancer/Solo same as primary at smaller scale)
- [x] Errors are recoverable (inline error → retry; clear filters)
- [x] Async states are clear (Save spinner; instant filter feedback)
- [x] Consistent with existing patterns (TanStack optimistic write follows useCreateCard/useMoveCard; URL-modal pattern matches industry leaders)
- [x] Accessible per WCAG 2.1 AA best-effort (keyboard nav, focus trap, ARIA, contrast)
- [x] Testable with defined scenarios (8–10 modal tests + 10–12 filter tests per spec)

---

## Next Steps

1. **UI/UX Design agent** picks up where this journey leaves off — resolves the open visual questions:
   - Modal layout (single column vs split columns)
   - Filter chip visual treatment (pills, checkmarks, color)
   - "Save" button placement and disabled-vs-always-enabled behavior
   - Empty-state copy and styling
   - BoardHeader layout when chips overflow horizontally

2. **Phase 1 build (Card Detail Modal)** — per `tasks/TASK-004.md` Implementation Roadmap items 1.1–1.7:
   - Add `updateCard` API function
   - Create `useUpdateCard` hook
   - Build `CardDetailModal` component (portal, focus trap, inline editing, inline error)
   - Update `BoardDetailPage` to render modal at `/boards/:boardId/cards/:cardId` route
   - Update `CardDetailPlaceholderPage` → either delete or repurpose as 404-style not-found
   - Write tests in `cardDetail.test.tsx`

3. **Phase 2 build (Search/Filter)** — per Implementation Roadmap items 2.1–2.6:
   - Extend `appStore` with filter state
   - Create `filterCards` pure utility
   - Update `BoardHeader` to accept and render search + chips
   - Update `BoardView` to derive labels and apply filter
   - Add per-column empty state
   - Write tests in `boardSearch.test.tsx` + extend `boardView.test.tsx`

4. **`/banyan-uat` run** after Phase 2 build completes — uses this journey doc as the script for browser-based testing of all AC items above. Test account: any existing seeded user (no auth blocker in MVP).

---

## Test Persona for UAT Browser Walk

- **Persona**: Team Member ("Alex, Backend Developer")
- **Authentication**: MVP has no auth implemented yet (per productBrief Open Questions); UAT runs against the dev server with no login wall
- **Test board**: Use the seeded board from `npm run seed --prefix backend` (typically contains 3 columns with 5–10 cards across them, with at least one card per label color and at least one card with a past due date)
- **Browser**: Chrome 120+ via Claude-in-Chrome MCP
- **Viewport**: Desktop 1440×900 (per Responsive Breakpoints in productBrief)
- **Network conditions**: Local (Docker Compose); no throttling

---

## Done Criteria

This user journey design is complete when:
- [x] All entry points are documented with exact DOM selectors
- [x] All states transition deterministically with clear triggers
- [x] All error paths have an inline recovery action specified
- [x] All AC items have a "Verification" sub-list referencing testable E2E/Integration/Component checks
- [x] DOM `data-testid` contracts are spelled out so UAT and E2E tests can write stable selectors
- [x] Decision (Option 1: Route-Based Modal) is justified against alternatives
- [x] Open UI/UX questions are handed off to the UI/UX Design agent with clear scope
