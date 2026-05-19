# Archive: TASK-004 — Card Detail Modal + Search/Filter

## Metadata
- **Task ID**: TASK-004
- **Complexity**: Level 3
- **Feature**: FEAT-004
- **Branch**: feature/FEAT-004-card-detail-search-filter
- **Started**: 2026-05-19
- **Completed**: 2026-05-19
- **Roadmap Link**: FEAT-004

## Summary

TASK-004 delivered BanyanBoard's first interactive card-level workflow in two phases:

1. **Card Detail Modal (Phase 1)**: A route-based overlay rendered at `/boards/:boardId/cards/:cardId` via React Router `<Outlet>`. Users click any card tile to open the modal, which shows all card fields (title, description, due date, labels) with inline editing. A single Save button (disabled until dirty) triggers `PATCH /api/cards/:id` with optimistic cache update and rollback on error. Inline error display keeps the modal open on failure. Focus trap and Escape dismiss provide keyboard accessibility.

2. **Board Search + Filter (Phase 2)**: A `filterCards` pure utility applies AND-semantic filtering (case-insensitive title search, OR-within-label, mutually-exclusive date modes). A `FiltersDropdown` component with an absolute-positioned chip panel keeps the header at a fixed `h-14`. All filter state lives in `useState` within `BoardView` — no Zustand store changes required.

Both features are entirely client-side for reads, with server persistence only for card saves. Zero new dependencies were added.

## Requirements

### Original Requirements
- Click any card tile to open a modal overlay showing the full card
- Inline edit title, description, and due date
- Save via `PATCH /api/cards/:id` with optimistic update
- Inline error on save failure (modal stays open)
- Real-time search by card title (case-insensitive)
- Label filter chips with OR-within-labels semantics
- "Overdue" and "Due Soon" date filter chips
- Per-column empty state "No matching cards" when filters active
- All filtering client-side from TanStack Query cache

### Success Criteria
- [✓] AC-ENTRY-1: Card click opens modal (not placeholder page)
- [✓] AC-HAPPY-1: Modal displays title, description, due date, labels
- [✓] AC-HAPPY-2: Inline edit + save persists to DB
- [✓] AC-HAPPY-3: Search bar filters cards in real-time
- [✓] AC-HAPPY-4: Label and date filter chips with AND semantics
- [✓] AC-ERROR-1: Save failure shows inline error; modal stays open
- [✓] AC-ERROR-2: Null fields show placeholders, not blank/broken UI
- [✓] AC-DATA-1: Card edits persist across page refresh

## Implementation

### Approach

**Phase 1** upgraded the existing `CardDetailPlaceholderPage` route to a full `CardDetailModal` component. The modal is rendered inside `BoardView` via `<Outlet>` — just four lines of change to `BoardView.tsx`. Card data is resolved from the existing `useBoard(boardId)` cache (no additional network call on open), satisfying the < 200ms NFR. The `useUpdateCard` hook follows the optimistic-update pattern established in TASK-003.

**Phase 2** introduced a `filterCards` pure function extracted to `utils/` with its own test file. The key architectural decision was moving `BoardHeader` from `AppShell` into `BoardView` — `BoardView` already owns board data, so filter state as `useState` in `BoardView` eliminated all Zustand store changes. A `GenericTopBar` replaced `BoardHeader` in `AppShell` for non-board pages.

### Key Components

1. **`CardDetailModal`** (`frontend/src/components/card/CardDetailModal.tsx`)
   - Route-rendered at `/boards/:boardId/cards/:cardId` via `<Outlet>` in `BoardView`
   - Portal to `document.body` (escapes layout clipping)
   - Focus trap, Escape dismiss, `role="dialog"` `aria-modal="true"`
   - Dirty check (`JSON.stringify` comparison) gates Save button
   - `window.confirm` guard on close when isDirty (MVP approach)
   - `role="alert"` inline error banner on PATCH failure

2. **`useUpdateCard`** (`frontend/src/hooks/useUpdateCard.ts`)
   - TanStack Query `useMutation` with optimistic write + rollback on error
   - `onSettled` invalidates `['board', boardId]` for fresh sync
   - Exposes `error` for inline display (not toast — per AC-ERROR-1)

3. **`filterCards`** (`frontend/src/utils/filterCards.ts`)
   - Pure function: `filterCards(cards: Card[], filters: FilterState): Card[]`
   - Case-insensitive substring search, OR-within-labels, AND across filter types
   - `activeDateFilter: 'none' | 'overdue' | 'due-soon'` discriminated union enforces mutual exclusivity at the type level
   - 9 unit tests in `boardSearch.test.tsx` cover all combinations

4. **`FiltersDropdown`** (`frontend/src/components/filters/FiltersDropdown.tsx`)
   - "Filters" / "Filters (N)" button with absolute-positioned chip panel
   - `role="group"` `aria-label="Filter options"` on the panel
   - Outside-click close via `useEffect` + `document.addEventListener('mousedown')`
   - Escape close; `aria-expanded` + `aria-controls` on trigger button

5. **`SearchInput`** (`frontend/src/components/filters/SearchInput.tsx`)
   - `<label htmlFor="board-search" className="sr-only">` for screen reader accessibility
   - Controlled input with search icon

6. **`FilterChip`** (`frontend/src/components/filters/FilterChip.tsx`)
   - `aria-pressed` for toggle state
   - Color style applied only when inactive (active uses primary colors)

7. **`GenericTopBar`** (`frontend/src/components/layout/GenericTopBar.tsx`)
   - Replaces `BoardHeader` in `AppShell` — hamburger + BanyanBoard wordmark only
   - No data dependencies

8. **`board/BoardHeader`** (`frontend/src/components/board/BoardHeader.tsx`)
   - Moved from `layout/` to `board/` — board-specific, owned by `BoardView`
   - Receives `boardName`, `labels`, filter state + handlers from `BoardView`

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Q1: Modal rendering | Route-based Outlet | CardTile already navigated to this route; deep-linkable; browser Back works |
| Q2: Edit mode | All fields immediately editable | Fewer clicks; Linear/Jira pattern; accidental edits prevented by disabled Save |
| Q3: Save trigger | Single Save button + dirty check | Follows AddCardForm pattern; explicit user intent |
| Q4: BoardHeader location | Move into BoardView | BoardView owns board data; eliminates prop-drilling; no Zustand changes needed |
| Q5: Filter chip layout | Dropdown panel | Fixed h-14 header; scales to any label count; works on tablet |

Reference: `memory-bank/creative/TASK-004-card-detail-search-filter-uiux.md`

## Testing

- **New test files**: `cardDetail.test.tsx` (9 tests), `boardSearch.test.tsx` (9 tests)
- **Extended**: `boardView.test.tsx` (+6 search/filter integration tests), `AppShell.test.tsx` (1 updated for GenericTopBar)
- **Total tests at completion**: 68/68 passing (up from 42 before TASK-004)
- **tsc**: Clean
- **ESLint**: Clean
- **Vite build**: Clean

## Files Changed

### New Files
- `frontend/src/components/card/CardDetailModal.tsx` — Route-rendered modal overlay
- `frontend/src/hooks/useUpdateCard.ts` — Mutation hook with optimistic update
- `frontend/src/utils/filterCards.ts` — Pure filter utility
- `frontend/src/components/filters/SearchInput.tsx` — Controlled search input
- `frontend/src/components/filters/FilterChip.tsx` — Toggleable filter chip
- `frontend/src/components/filters/FiltersDropdown.tsx` — Dropdown filter panel
- `frontend/src/components/board/BoardHeader.tsx` — Board-specific header
- `frontend/src/components/layout/GenericTopBar.tsx` — Generic non-board header
- `frontend/src/__tests__/cardDetail.test.tsx` — Modal component tests (9)
- `frontend/src/__tests__/boardSearch.test.tsx` — filterCards pure function tests (9)

### Modified Files
- `frontend/src/components/board/BoardView.tsx` — Added `<Outlet>`, filter state, BoardHeader, filteredColumns
- `frontend/src/components/board/Column.tsx` — Added `isFiltering` prop for empty state
- `frontend/src/components/layout/AppShell.tsx` — Replaced BoardHeader with GenericTopBar
- `frontend/src/api/boardsApi.ts` — Added `updateCard()` function
- `frontend/src/router/index.tsx` — Nested `cards/:cardId` route under `boards/:boardId`
- `frontend/src/__tests__/boardView.test.tsx` — Added 6 search/filter integration tests
- `frontend/src/__tests__/AppShell.test.tsx` — Updated header test for GenericTopBar

## Lessons Learned

1. **Creative phase Q4 decision was the most impactful** — Moving `BoardHeader` into `BoardView` eliminated all Zustand store changes, simplified filter state to three `useState` calls, and placed a board-specific component exactly where board data lives. The payoff was immediate.

2. **Pure functions in `utils/` are correct on first write** — `filterCards` had 9 tests all passing on first write. Extracting filter logic before wiring into components makes the business logic independently verifiable.

3. **`within()` for ARIA group test isolation** — When label text appears in both a FilterChip and a CardTile, `getByRole('button', { name: /bug/ })` is ambiguous. Adding `role="group"` + `aria-label` to the filter panel and using `within(filterPanel)` resolves it — simultaneously improving accessibility.

4. **Phase scope should be estimated before starting** — Phase 2 created ~10 new files and exhausted the build agent context before reaching test verification. A phase creating > 8 new files should be split beforehand.

Reference: `memory-bank/reflection/reflection-TASK-004.md`

## Technical Debt Inherited

- `applyCardUpdate` pure function in `useUpdateCard.ts` has no dedicated unit tests (inconsistent with TASK-003 pattern for optimistic transform functions)
- `window.confirm` for unsaved-changes guard — MVP shortcut; replace with design-system dialog when available
- No mobile optimization for filter panel at < 640px

## References
- Task: `memory-bank/tasks/TASK-004.md`
- Creative (UI/UX): `memory-bank/creative/TASK-004-card-detail-search-filter-uiux.md`
- Creative (User Journey): `memory-bank/creative/TASK-004-card-detail-search-filter-user-journey.md`
- Reflection: `memory-bank/reflection/reflection-TASK-004.md`
- Progress: `memory-bank/progress.md`

## Follow-up

- **FEAT-005 (future)**: Label management — create/edit/delete labels; assign labels to cards in the modal
- **UAT E2E tests**: User journey acceptance criteria (AC-ENTRY-1 through AC-A11Y-1) not yet automated as E2E tests; should be implemented in a future `/banyan-uat` cycle
- **URL-persisted filters**: Encode `searchQuery` and `activeLabelIds` in URL search params for bookmarkable filtered board views (post-MVP)
