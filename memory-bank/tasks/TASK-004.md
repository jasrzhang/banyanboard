# TASK-004: Card Detail Modal + Search/Filter

**Complexity**: Level 3
**Status**: REFLECTION_COMPLETE
**Roadmap**: FEAT-004
**Branch**: feature/FEAT-004-card-detail-search-filter
**Worktree**: N/A
**Reflection**: memory-bank/reflection/reflection-TASK-004.md

## Task Description

Build the Card Detail Modal and board-level search/filter functionality for BanyanBoard. 

The card detail modal opens when a user clicks any card tile on the Kanban board (the placeholder route `/boards/:boardId/cards/:cardId` and `CardDetailPlaceholderPage` are already in place from FEAT-003). The modal displays the full card — title, description, due date, labels — and allows inline editing and saving.

The board-level search/filter adds a search bar to the board header that filters card tiles by title text in real-time. Label filter chips and due-date filter chips allow further narrowing. All filtering is applied client-side against the TanStack Query cache (no additional API calls needed).

**Current state from FEAT-003:**
- `CardDetailPlaceholderPage` renders "Card detail — coming soon" at `/boards/:boardId/cards/:cardId`
- `CardTile` component clicks navigate to that placeholder route
- `GET /api/boards/:id` already returns full card data (title, description, dueDate, labels)
- `PATCH /api/cards/:id` already supports updating title, description, dueDate (backend in place)
- Board header (`BoardHeader.tsx`) has a "New Card" button placeholder — search bar goes here

**Integrates with:**
- TanStack Query v5 (`useBoard` hook — cached board data is the source of truth for filters)
- Zustand v4 (`appStore.ts` — may store filter state as UI state)
- React Router v6 (card detail route already exists)
- Existing `PATCH /api/cards/:id` endpoint for card saves

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Member — individual contributor (dev, designer, PM) who needs to inspect full card detail, edit title/description/due date, and quickly find cards by name or label without leaving the board view.
**Creative Exploration Needed**: Yes — see Creative Exploration Needed section below.

### Invocation Method

#### Card Detail Modal
- **Location**: `/boards/:boardId` — rendered inside `BoardView` (`frontend/src/components/board/BoardView.tsx`), within any `Column` (`frontend/src/components/board/Column.tsx`), on any `CardTile` (`frontend/src/components/card/CardTile.tsx`)
- **Element**: The card body `<button>` inside `CardTile` (the clickable area that currently calls `navigate('/boards/${boardId}/cards/${card.id}')`) — this click handler must be changed to open the modal instead of navigating to the placeholder route
- **Visibility**: Always visible — every rendered `CardTile` on the board is clickable
- **Navigation**: User is on `/boards/:boardId` → clicks card body button on any `CardTile` → `CardDetailModal` opens as an overlay on the same page (URL may update to `/boards/:boardId/cards/:cardId` for deep-linking — see Creative Exploration Needed)
- **Confidence**: HIGH for entry point (found exact `navigate()` call in `frontend/src/components/card/CardTile.tsx` line 83); MEDIUM for modal-vs-route approach (two valid patterns — see Creative Exploration Needed)

#### Search Bar
- **Location**: `BoardHeader` component (`frontend/src/components/layout/BoardHeader.tsx`) — currently renders board title + "New Card" button; search input goes between the title and "New Card" button
- **Element**: Text input field labeled "Search cards" (or similar); always rendered when a board is active
- **Visibility**: Always visible on the board page (`/boards/:boardId`)
- **Navigation**: User is on `/boards/:boardId` → types in search input → `CardTile` elements in `BoardView` filter in real-time (no navigation)
- **Confidence**: HIGH — `BoardHeader.tsx` has explicit placeholder space (`flex-1` between title and button); task description says "search bar goes here"

#### Label + Due-Date Filter Chips
- **Location**: `BoardHeader` component, below or adjacent to the search bar
- **Element**: Clickable chip elements — one chip per label present on any board card; two standard chips: "Overdue" and "Due Soon"
- **Visibility**: Visible when a board is active; label chips rendered from board data
- **Confidence**: MEDIUM — placement in `BoardHeader` is specified but exact chip layout needs creative exploration

### Success Criteria

#### Card Detail Modal
- **User sees**: A modal/dialog overlay on top of the board showing: card title (editable), description (editable, with empty state "No description" if null), due date (editable date input, with empty state "No due date" if null), and all label chips rendered the same way as `CardTile` (color chip with name, using `label.color` + `label.color + '33'` background pattern from `CardTile.tsx` lines 107–112)
- **User sees on save**: Save button triggers `PATCH /api/cards/:id`; on success the board cache (`['board', boardId]` TanStack Query key) reflects the updated card values; modal closes or stays open per UX decision
- **User sees on error**: Error message rendered inside the modal (not a toast); modal remains open; user can retry the save
- **Verifiable at**: Modal DOM rendered at `/boards/:boardId` when any card is clicked; updated card title/description/dueDate visible on the `CardTile` after modal close
- **Data persisted**: `cards` table, fields `title` (VARCHAR 500), `description` (TEXT nullable), `due_date` (TIMESTAMPTZ nullable) — confirmed by `UpdateCardSchema` in `backend/src/schemas/cardSchemas.ts`
- **Observable within**: Modal opens immediately (card data already in TanStack Query cache under `['board', boardId]`); save call confirmed within < 200ms p95 (productBrief NFR)

#### Search + Filter
- **User sees**: As text is typed in the search input, `CardTile` elements whose `card.title` does not match the search string (case-insensitive) are hidden; cards matching the query remain visible in their columns
- **User sees with filter chips**: Clicking a label chip hides cards not carrying that label; clicking "Overdue" hides cards where `dueDate` is null or `new Date(dueDate) >= new Date()`; clicking "Due Soon" hides cards where `dueDate` is null or `new Date(dueDate) > new Date() + 7 days`
- **User sees with no results**: An empty state message per column (e.g., "No matching cards") — not a blank column
- **Verifiable at**: `BoardView` DOM at `/boards/:boardId` with search active; card count in column header may or may not update (see Creative Exploration Needed)
- **Data persisted**: Filter state is client-side only — no API calls; persists until user clears filters or navigates away
- **Observable within**: Filter updates < 50ms (client-side computation against TanStack Query cache)

### Acceptance Criteria

#### AC-ENTRY-1: Clicking a card tile opens the modal, not the placeholder route
**Priority**: MUST
**Given** a user is on `/boards/:boardId` and the board has at least one card rendered in a `CardTile`
**When** the user clicks the card body button (the `<button className="flex-1 text-left...">` in `CardTile.tsx`)
**Then** a `CardDetailModal` dialog/overlay is visible in the DOM (not a navigation to `/boards/:boardId/cards/:cardId` rendering `CardDetailPlaceholderPage`), and the modal contains the clicked card's title as a heading or editable field

#### AC-HAPPY-1: Modal displays all card fields
**Priority**: MUST
**Given** a user has clicked a card tile and the `CardDetailModal` is open
**When** the modal renders
**Then**:
  1. Card title is displayed (editable input or heading)
  2. Card description is displayed — if `card.description` is non-null, shows the description text; if null, shows a non-empty placeholder (e.g., "No description" or "Add a description...")
  3. Due date is displayed — if `card.dueDate` is non-null, shows the formatted date; if null, shows a non-empty placeholder (e.g., "No due date")
  4. All labels from `card.labels` are rendered as color chips matching the style in `CardTile` (colored background at `label.color + '33'`, text in `label.color`, label name visible)

#### AC-HAPPY-2: User can edit card fields and save
**Priority**: MUST
**Given** the `CardDetailModal` is open for a card
**When** the user:
  1. Changes the title to a non-empty string
  2. Changes (or clears) the description
  3. Changes (or clears) the due date
  4. Clicks the Save button (or equivalent confirm action)
**Then**:
  - `PATCH /api/cards/:id` is called with the updated `{ title?, description?, dueDate? }` matching `UpdateCardSchema` from `backend/src/schemas/cardSchemas.ts`
  - On HTTP 200 response, the TanStack Query cache for `['board', boardId]` reflects the updated card (title/description/dueDate visible on the `CardTile` without a page reload)
  - The updated fields are visible in the PostgreSQL `cards` table (verifiable via `GET /api/boards/:id` after save)

#### AC-HAPPY-3: Search bar filters cards by title in real-time
**Priority**: MUST
**Given** a user is on `/boards/:boardId` and the board has multiple cards across columns
**When** the user types text into the search input in `BoardHeader`
**Then**:
  - Cards whose `card.title.toLowerCase()` does not include the search string `.toLowerCase()` are hidden (not rendered or `display: none`)
  - Cards whose title matches remain visible in their column
  - Filtering happens without any API calls (computed from the TanStack Query cache `['board', boardId]`)
  - Clearing the search input restores all cards to visible

#### AC-HAPPY-4: Label and due-date filter chips narrow the visible cards
**Priority**: MUST
**Given** a user is on `/boards/:boardId` and filter chips are rendered in `BoardHeader`
**When** the user clicks a label chip (e.g., "Bug")
**Then** only cards that have at least one label matching the selected label name/id are visible; cards without that label are hidden
**When** the user clicks the "Overdue" chip
**Then** only cards where `card.dueDate` is non-null AND `new Date(card.dueDate) < new Date()` are visible
**When** the user clicks "Due Soon"
**Then** only cards where `card.dueDate` is non-null AND `new Date(card.dueDate)` is within 7 days from now are visible
**When** multiple filters are active (text search + label chip)
**Then** both conditions apply (AND semantics — card must match all active filters)

#### AC-ERROR-1: Save failure keeps modal open with inline error
**Priority**: MUST
**Given** the `CardDetailModal` is open and the user has made edits
**When** `PATCH /api/cards/:id` returns a non-2xx HTTP status (e.g., 500, 404, network failure)
**Then**:
  - The modal remains open (does not close)
  - An error message is displayed inside the modal (not only as a `sonner` toast) — e.g., "Failed to save card. Please try again."
  - The user's edits are preserved in the form fields (not reverted)
  - A retry path is available (Save button is re-enabled)
  - Note: existing pattern in `AddCardForm` (`frontend/src/components/card/AddCardForm.tsx` line 43) stays open on error — follow this same pattern

#### AC-ERROR-2: Cards with null fields show empty states, not broken UI
**Priority**: MUST
**Given** a card has `description: null` and `dueDate: null` (valid per `Card` type in `frontend/src/types/domain.ts`)
**When** the `CardDetailModal` opens for that card
**Then**:
  - The description area renders a visible, non-blank placeholder (not an empty `<p>` tag or JavaScript `null` rendered as text)
  - The due date area renders a visible, non-blank placeholder
  - No JavaScript errors are thrown from null coercion
  - The modal is fully functional — user can type into the description and set a due date

#### AC-DATA-1: Card edits persist across page refresh
**Priority**: MUST
**Given** a user has edited a card's title, description, or due date and saved successfully via the modal
**When** the user refreshes the page (triggering a fresh `GET /api/boards/:id`)
**Then** the updated values are returned from the API and rendered in the `CardTile` and any subsequent `CardDetailModal` open for that card, confirming the data reached the PostgreSQL `cards` table

### Scope Boundaries

**In scope**:
- `CardDetailModal` component rendered as an overlay on the board page when a card is clicked
- Inline editing of `title`, `description`, and `dueDate` fields only
- Save via existing `PATCH /api/cards/:id` endpoint
- Optimistic update of TanStack Query cache on save (following the pattern established in `useMoveCard.ts` and `useCreateCard.ts`)
- Search bar in `BoardHeader` filtering `CardTile` visibility by `card.title` (client-side)
- Label filter chips in `BoardHeader` — one chip per distinct label across all board cards
- Due-date filter chips: "Overdue" and "Due Soon" (within 7 days)
- Client-side filtering only — no additional API calls for search/filter
- Filter state held in component `useState` or Zustand `appStore` (per three-layer state contract from `state-architecture.md` learned rule — filter state is UI-only, not server state)
- Empty state per column when no cards match the active filter
- Empty state for null `description` and `dueDate` in the modal

**Out of scope**:
- Label management (creating, editing, or deleting labels) — no backend endpoint exists
- Adding or removing labels from a card in this modal — labels are display-only in this feature
- Card deletion from the modal
- Card comments, attachments, or activity log
- Assigning cards to users (no user assignment model exists in MVP)
- Server-side search (all filtering is client-side)
- Persisting filter state across page navigation or refresh
- Column card-count badge updating when filters are active (nice-to-have; explicitly out of scope)
- Mobile drag-and-drop interactions with the modal (post-MVP)

**Dependencies**:
- FEAT-003 complete (provides `CardTile`, `CardDetailPlaceholderPage`, `useBoard`, `PATCH /api/cards/:id`, and TanStack Query cache foundation) — confirmed complete
- `sonner` toast library already wired from FEAT-003 (used in `useMoveCard.ts` and `useCreateCard.ts`)
- TailwindCSS design tokens already established in FEAT-002 (`surface-card`, `border`, `text-primary`, `text-secondary`, `primary`, etc.)

**NFR implications**:
- Performance: Modal must open from cached data (no additional API call on card click) — the `useBoard` cache already holds full card data including `description`, `dueDate`, and `labels`
- Performance: Filter must complete < 50ms — client-side array filter against the cached board; acceptable for hundreds of cards (MVP scale)
- Accessibility (WCAG 2.1 AA best-effort): Modal must trap focus, be dismissible via Escape key, have appropriate `role="dialog"` and `aria-modal="true"`, and a visible close button with `aria-label`; search input must have a visible label or `aria-label`
- Browser support: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ (from productBrief)

### Creative Exploration Needed

Yes — the following questions require design exploration before implementation planning:

1. **Modal rendering strategy**: Two valid approaches — (a) render `CardDetailModal` as a React overlay inside `BoardView` with React state controlling open/close (no URL change), or (b) use the existing React Router route at `/boards/:boardId/cards/:cardId` and render a modal-style component at that route so the URL updates (deep-linkable). The task description says "modal opens when user clicks card" but the existing route infrastructure (`CardDetailPlaceholderPage`) was set up for FEAT-004. Option (b) enables deep-linking and browser back-button dismissal; option (a) is simpler. Need UX decision before Phase 1 implementation.

2. **Inline edit vs read/edit toggle**: Two valid approaches — (a) all fields are immediately editable inputs when the modal opens (inline edit, no explicit "Edit" button), or (b) fields render as read-only with a per-field or global "Edit" pencil icon that switches to an input. Option (a) is simpler and matches Linear-style UX; option (b) prevents accidental edits. Creative phase should decide.

3. **Save trigger**: With inline editing, when does the save happen — (a) a single "Save" button at the bottom of the modal, (b) per-field auto-save on blur (fire-and-forget PATCH per changed field), or (c) a "Save" button that only becomes active when fields have changed. Option (a) is established by `AddCardForm` pattern; option (b) is more fluid but more complex error handling. Creative phase should decide.

4. **Filter chip source for labels**: Label chips in `BoardHeader` could show (a) all labels present on any card in the current board (derived from `useBoard` cache), or (b) a separate `GET /api/boards/:id/labels` endpoint. Option (a) avoids a new API call and is consistent with the client-side filtering constraint; option (b) is cleaner if a board has labels defined independently of cards. Given the client-side constraint, option (a) is likely correct but needs confirmation.

5. **`BoardHeader` needs board context**: Currently `BoardHeader` receives only `{ onMenuClick }` (`frontend/src/components/layout/BoardHeader.tsx`). To render search + label chips and board title from real data, it needs either `boardId` prop (fetching via `useBoard`) or the search/filter state passed down from `BoardDetailPage`/`AppShell`. This is an architecture decision — need to confirm the prop-threading vs context approach before Phase 2.

---

## User Journey Definition

*(Superseded by the Specification section above. Retained for reference.)*

**Feature Type**: End-User Feature
**Creative Phase Required**: Yes — UI/UX Design (modal layout, filter UX)

### Acceptance Criteria (summary)
- AC-ENTRY-1: Clicking a card tile opens the card detail modal (not the placeholder page)
- AC-HAPPY-1: Modal displays card's full title, description, due date, and all label chips
- AC-HAPPY-2: User can edit title/description/due date inline and save — changes persist to DB and reflect on board
- AC-HAPPY-3: Board search bar filters visible cards by title text (case-insensitive, real-time)
- AC-HAPPY-4: Label filter chips filter cards by label; due-date filter chips filter by overdue/due-soon
- AC-ERROR-1: If card save fails, modal stays open with an error message and user can retry
- AC-ERROR-2: If card has no description/due date, modal shows appropriate empty states (not blank/broken)
- AC-DATA-1: Card edits persist across page refresh (confirmed via database)

## Test Strategy

### Approach
- **Emphasis**: Component tests (frontend) — all filtering is client-side; backend API already tested in FEAT-003
- **Target test count**: 18–22 tests total

### File Organization
- **New test files**:
  - `frontend/src/__tests__/cardDetail.test.tsx` — CardDetailModal component tests
  - `frontend/src/__tests__/boardSearch.test.tsx` — filterCards pure function + search/filter integration tests
- **Extend existing**:
  - `frontend/src/__tests__/boardView.test.tsx` — add filter integration (board with active search, label filter)

### What NOT to Test
- `PATCH /api/cards/:id` backend — already covered by `cards.test.ts` from FEAT-003
- TanStack Query cache internals — covered by the library
- React Router navigation — already covered by `routes.test.tsx`
- `filterCards` edge cases beyond blank query and empty results — over-testing pure logic

### Per-Phase Test Guidance

**Phase 1 (Card Detail Modal): 8–10 tests in `cardDetail.test.tsx`**
- Modal opens when `selectedCardId` is set in `appStore`
- Modal renders title, description, due date, and label chips from card data
- Null `description` renders placeholder, not blank
- Null `dueDate` renders placeholder, not blank
- Editing title and clicking Save calls `PATCH /api/cards/:id` with correct payload
- On save success, cache updates and modal closes (or card title updated in DOM)
- On save failure (mocked 500), modal stays open and inline error message is visible
- Pressing Escape or clicking close button closes the modal

**Phase 2 (Search + Filter): 10–12 tests — split across `boardSearch.test.tsx` and `boardView.test.tsx`**

`boardSearch.test.tsx` (pure function + unit):
- `filterCards` returns all cards when query is empty string
- `filterCards` returns matching cards (case-insensitive substring match on `card.title`)
- `filterCards` returns empty array when no cards match
- `filterCards` filters by label id (`activeLabelIds` non-empty)
- `filterCards` filters by "overdue" (cards where `dueDate < now`)
- `filterCards` filters by "due-soon" (cards where `dueDate` within 7 days)
- Combined: text query AND label filter both apply (AND semantics)

`boardView.test.tsx` extensions (integration):
- Search input renders in `BoardHeader` and typing hides non-matching cards
- Clearing search restores all cards
- Clicking a label chip hides cards without that label; clicking again removes filter

## Implementation Roadmap

- [x] Phase 1: Card Detail Modal
  - [x] 1.1: Add `updateCard(cardId, data: UpdateCardRequest)` to `frontend/src/api/boardsApi.ts`
  - [x] 1.2: Create `frontend/src/hooks/useUpdateCard.ts` — mutation hook with optimistic cache write, rollback on error, `onSettled` invalidate; expose `error` for inline display (follows `useCreateCard` pattern)
  - [x] 1.3: Router: nest `cards/:cardId` as child of `boards/:boardId`; replace `CardDetailPlaceholderPage` with `CardDetailModal` (creative Q1=Option B; selectedCardId in store NOT needed)
  - [x] 1.4: Create `frontend/src/components/card/CardDetailModal.tsx` — portal to `document.body`, renders title/description/dueDate/labels with inline editing, Save button (dirty check), close button, inline error state, null-field placeholders; focus trap + Escape dismiss
  - [x] 1.5: Update `frontend/src/components/board/BoardView.tsx` — add `<Outlet>` for route-based modal rendering (CardTile navigate unchanged — already correct)
  - [x] 1.6: Write 9 tests in `frontend/src/__tests__/cardDetail.test.tsx`

- [x] Phase 2: Board Search + Filter
  - [x] 2.1: Filter state as `useState` in `BoardView` (creative doc Q4 decision overrides roadmap — no appStore changes needed)
  - [x] 2.2: Create `frontend/src/utils/filterCards.ts` — pure `filterCards(cards: Card[], filters: FilterState): Card[]` function
  - [x] 2.3: Create `frontend/src/components/board/BoardHeader.tsx` (new board/ location per creative Q4); create `SearchInput`, `FilterChip`, `FiltersDropdown` in `filters/`; create `GenericTopBar` replacing `layout/BoardHeader` in `AppShell`
  - [x] 2.4: Update `frontend/src/components/board/BoardView.tsx` — `allLabels` (useMemo), `filteredColumns` (useMemo with filterCards), `BoardHeader` rendered inside `BoardView`
  - [x] 2.5: `Column.tsx` updated with `isFiltering` prop → "No matching cards" vs "No cards yet"
  - [x] 2.6: 9 tests in `boardSearch.test.tsx` + 6 tests extending `boardView.test.tsx` = 15 new tests

## Creative Phases

- [x] **User Journey Design** — `memory-bank/creative/TASK-004-card-detail-search-filter-user-journey.md`
- [x] **UI/UX Design** — `memory-bank/creative/TASK-004-card-detail-search-filter-uiux.md`
  Resolved design questions:
  1. Modal: Route-based overlay (`<Outlet />` in `BoardView`; URL updates to `.../cards/:cardId`; Back/Escape dismisses)
  2. Edit mode: All fields immediately editable (inline edit, no toggle); dirty check disables Save when unchanged
  3. Save: Single Save button (disabled until dirty); unsaved-changes guard on close
  4. BoardHeader: Moved into `BoardView` (has board data); filter state as `useState` in `BoardView`; `AppShell` gets generic top bar for non-board pages
  5. Filter chips: "Filters (N)" dropdown button reveals absolute-positioned chip panel (scales to any label count)

---

## Execution State

**Build Status**: IDLE
**Current Phase**: REFLECT → ARCHIVE
**Phase Number**: 2 of 2
**Is Multi-Phase**: YES
**Build Started**: 2026-05-19T00:00:00Z
**Can Resume**: NO

### Current Build Step
**Step**: Step 11 — Git Commit (Phase 2)
**Status**: COMPLETE

### Active Sub-Agents
(none)

### Completed Steps
- Step 0: Auto-provisioned TASK-004 for FEAT-004
- Step 0.2: Phase gate passed (Level 3, FEAT-004 linked)
- Step 3 (PLAN): Spec Writer Agent completed — specification approved by user (2026-05-19)
- Step 4 (PLAN): Codebase analysis completed
- Step 5 (PLAN): Implementation plan finalized — 2 phases
- Step 6 (PLAN): PLANNING_COMPLETE
- Step 7 (CREATIVE): User Journey Design complete (2026-05-19)
- Step 8 (CREATIVE): UI/UX Design complete (2026-05-19)
- Step 9 (CREATIVE): CREATIVE_COMPLETE
- Step 0.5 (BUILD P1): Feature branch `feature/FEAT-004-card-detail-search-filter` created (2026-05-19)
- Step 3 (BUILD P1): Tests written — 9 tests in `cardDetail.test.tsx` (2026-05-19)
- Step 4 (BUILD P1): Code implemented — `updateCard` in boardsApi, `useUpdateCard` hook, `CardDetailModal`, router nested routes, `BoardView` Outlet (2026-05-19)
- Step 7 (BUILD P1): Integration verification — 52/52 tests pass, typecheck clean, lint clean (2026-05-19)
- Step 11 (BUILD P1): Git commit on feature branch (2026-05-19)
- Step 0.5 (BUILD P2): On feature branch `feature/FEAT-004-card-detail-search-filter` (2026-05-19)
- Step 3 (BUILD P2): Tests written — 9 tests in `boardSearch.test.tsx`, 6 new in `boardView.test.tsx` (2026-05-19)
- Step 4 (BUILD P2): Code implemented — `filterCards`, `SearchInput`, `FilterChip`, `FiltersDropdown`, `GenericTopBar`, `board/BoardHeader`, AppShell updated, BoardView updated, Column updated (2026-05-19)
- Step 7 (BUILD P2): Integration verification — 68/68 tests pass, typecheck clean, lint clean, build clean (2026-05-19)
- Step 11 (BUILD P2): Git commit on feature branch (2026-05-19)

### Resumption Notes
**Can Resume**: NO
**Resume From**: N/A — BUILD_COMPLETE
**Notes**: Both phases complete. Next: `/banyan-reflect TASK-004` then `/banyan-archive TASK-004`.
