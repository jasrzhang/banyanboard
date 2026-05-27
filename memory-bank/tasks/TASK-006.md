# TASK-006: Card Labels

**Complexity**: Level 3
**Status**: REFLECTION_COMPLETE
**Reflection**: memory-bank/reflection/reflection-TASK-006.md
**Roadmap**: FEAT-006
**Branch**: feature/FEAT-006-card-labels
**Worktree**: .claude-worktrees/FEAT-006

## Task Description

Add color-coded labels to cards with filtering support. Includes label creation and management (name + color), label badge display on card tiles, inline label assignment from the card detail modal, and label filter chips in the board header. Requires design decisions on the color picker UX, label CRUD API, card-label data model, and client-side filter integration.

**Roadmap Link**: FEAT-006
**Feature Complexity**: Level 3 (inherited from FEAT-006)

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Member (individual contributor: dev, designer, PM) — goals: know what to work on next; categorize and organize cards quickly during sprint planning.
**Creative Exploration Needed**: Yes — see "Creative Exploration Needed" section below.

### Invocation Method

There are three distinct invocation surfaces for this feature:

#### 1. Label Assignment (from Card Detail Modal)
- **Location**: `frontend/src/components/card/CardDetailModal.tsx` — the modal opened by clicking a card tile (`/boards/:boardId/cards/:cardId` route)
- **Element**: A "Labels" section with an inline label picker (toggle chips or dropdown — see Creative Q1). Currently the modal renders labels as display-only badges; the section needs to become interactive.
- **Visibility**: Always visible within the modal; shows existing labels with add/remove affordance
- **Navigation**: Board → click card tile → card detail modal → Labels section
- **Confidence**: HIGH — the modal already has a `{card.labels}` display-only section at line 198–214 of `CardDetailModal.tsx`. The task is converting it from read-only to interactive.

#### 2. Label Management (create/edit/delete labels)
- **Location**: TBD — either (a) inline "Create label" within the card modal label picker, or (b) a dedicated label management panel accessible from the board header. **Confidence: LOW** — see Creative Q2.
- **Element**: A form with name (text input) + color (color picker or preset swatches — see Creative Q3) fields
- **Visibility**: Conditional — available when user opens the label management UI
- **Navigation**: Depends on Creative Q2 decision

#### 3. Label Filtering (from Board Header)
- **Location**: `frontend/src/components/board/BoardHeader.tsx` → `frontend/src/components/filters/FiltersDropdown.tsx`
- **Element**: Label filter chips inside the existing `FiltersDropdown` panel. The `FiltersDropdown` already accepts `labels: Label[]` and `activeLabelIds: string[]` props and renders `FilterChip` components per label. The `BoardView` (`frontend/src/components/board/BoardView.tsx`) already computes `allLabels` from card data and passes it down.
- **Visibility**: Always visible in the board header Filters dropdown button; active filters show a count badge
- **Navigation**: Board → "Filters" button → dropdown panel → click label chip to toggle
- **Confidence**: HIGH — the filter infrastructure (`FilterChip`, `FiltersDropdown`, `filterCards` util, `BoardView` filter state) is fully implemented and already wires label filtering end-to-end. The only gap is that labels must come from a dedicated label API (not just inferred from card data) to support label management.

### Success Criteria

- **User sees**: After assigning a label to a card, the label badge (colored pill with name and optional emoji icon) appears immediately on the card tile in the board view and inside the card detail modal. After creating a new label, it appears as an option in both the card modal label picker and the board header Filters dropdown.
- **Verifiable at**: Card tile label badges visible in `frontend/src/components/card/CardTile.tsx` (already renders `card.labels` at line 105–113). Card detail modal labels section. Board header Filters dropdown label chips.
- **Data persisted**: `labels` table (`id`, `board_id`, `name`, `color`, `icon?`) — base schema already migrated (`backend/migrations/1747600003000_create-labels.js`); one new migration needed to add `icon` column. `card_labels` join table (`card_id`, `label_id`) — schema already migrated (`backend/migrations/1747600004000_create-card-labels.js`).
- **Observable within**: Immediate (synchronous after save). No async operation — label assignment is a REST PATCH or POST returning updated state.

### Acceptance Criteria

#### AC-ENTRY-1: User can find and toggle labels on a card
**Priority**: MUST
**Given** the user is viewing a board and clicks on any card tile
**When** the card detail modal opens (route `/boards/:boardId/cards/:cardId`)
**Then** they see a "Labels" section in the modal that shows currently assigned labels and provides an interactive affordance (chips, checklist, or popover — TBD in Creative) to add or remove labels

#### AC-ENTRY-2: User can access board label filter
**Priority**: MUST
**Given** the user is on the board view
**When** they click the "Filters" button in `BoardHeader`
**Then** the `FiltersDropdown` panel shows label chips for all labels defined on the board (not just labels that appear on cards)

#### AC-HAPPY-1: User creates a new label and assigns it to a card
**Priority**: MUST
**Given** the user is in the label management UI (location TBD by Creative Q2)
**When** they:
  1. Enter a label name (1–50 characters)
  2. Select a color (from preset palette or color picker — TBD by Creative Q3)
  3. Confirm creation
**Then**:
  - The label is persisted to `labels` table with `board_id`, `name`, `color`
  - The label appears as an assignable option in the card detail modal label picker
  - The label appears as a filter chip in the Filters dropdown

#### AC-HAPPY-2: User assigns an existing label to a card
**Priority**: MUST
**Given** the user is in the card detail modal and labels exist on the board
**When** they select a label from the label picker and save (or if inline/immediate — toggle it)
**Then**:
  - The `card_labels` row is inserted/removed via the API
  - The card tile in the board view shows the label badge immediately (optimistic update or post-save refresh)
  - The card detail modal shows the label in the labels display section

#### AC-HAPPY-3: User filters the board by label
**Priority**: MUST
**Given** labels are assigned to some cards on the board
**When** the user toggles one or more label filter chips in the Filters dropdown
**Then**:
  - Only cards that have at least one of the selected labels remain visible in the board columns
  - Cards without matching labels are hidden (filtered out client-side via `filterCards` in `frontend/src/utils/filterCards.ts`)
  - The Filters button shows an active count badge (already implemented in `FiltersDropdown`)

#### AC-HAPPY-4: User removes a label from a card
**Priority**: MUST
**Given** a card has one or more labels assigned
**When** the user opens the card detail modal and removes a label (toggle off or click remove)
**Then**:
  - The `card_labels` row is deleted via the API
  - The label badge disappears from the card tile and modal

#### AC-HAPPY-5: User deletes a label from the board
**Priority**: SHOULD
**Given** a label exists on the board
**When** the user deletes it from label management
**Then**:
  - The `labels` row is deleted (CASCADE removes `card_labels` rows automatically per migration constraint)
  - The label badge disappears from all card tiles that had it assigned
  - The label chip disappears from the Filters dropdown

#### AC-ERROR-1: User attempts to create a duplicate label name
**Priority**: MUST
**Given** the user is creating a label and a label with the same name already exists on the board
**When** they submit the create form
**Then**:
  - The backend returns 409 Conflict (enforced by `UNIQUE (board_id, name)` constraint in `labels` migration)
  - The user sees an inline error message: "A label with this name already exists"
  - The form remains open with their input intact

#### AC-ERROR-2: User attempts to create a label with empty name
**Priority**: MUST
**Given** the user is in the label creation form
**When** they submit without entering a name (or a whitespace-only name)
**Then**:
  - Client-side validation prevents submission
  - The input shows an error state: "Label name is required"

#### AC-ERROR-3: Label assignment fails due to network error
**Priority**: MUST
**Given** the user attempts to assign or remove a label
**When** the API call fails (network error or 5xx)
**Then**:
  - The card state is rolled back to its previous label assignment (consistent with the existing `useUpdateCard` optimistic rollback pattern in `frontend/src/hooks/useUpdateCard.ts`)
  - A toast notification appears with an error message (using `sonner` — already imported in `CardDetailModal.tsx`)

### Scope Boundaries

**In scope**:
- Label CRUD API: `GET /api/boards/:boardId/labels`, `POST /api/boards/:boardId/labels`, `PATCH /api/boards/:boardId/labels/:labelId`, `DELETE /api/boards/:boardId/labels/:labelId`
- Card-label assignment API: `PUT /api/cards/:cardId/labels` (replace full label set) or `POST/DELETE /api/cards/:cardId/labels/:labelId` (individual toggle — TBD by Creative Q4)
- `LabelRepository` with CRUD methods following the Repository Pattern (same pattern as `CardRepository`, `BoardRepository`)
- `LabelService` with business logic (duplicate name check, board-scoped access)
- `LabelController` with Zod validation (same pattern as `BoardController`, `CardController`)
- Frontend `labelsApi.ts` following `boardsApi.ts` pattern
- `useLabels(boardId)` hook (TanStack Query) and `useCreateLabel`, `useDeleteLabel`, `useAssignLabels` mutations
- Label picker UI in `CardDetailModal.tsx` — converting display-only section to interactive
- Label management UI — location TBD by Creative Q2
- Color selection UI — preset palette vs free color picker TBD by Creative Q3
- **Label icon/emoji** — optional emoji character displayed alongside the label color badge on card tiles and in the label picker; stored in a new nullable `icon` column on the `labels` table (requires one new migration: `ALTER TABLE labels ADD COLUMN icon VARCHAR(10)`); emoji selection UI TBD by Creative Q3 (could be a small emoji picker or free text input accepting a single emoji character)
- `BoardView` `allLabels` computation updated to fetch from `GET /api/boards/:boardId/labels` (instead of inferring from card data) so new labels without cards appear in the filter
- `frontend/src/types/api.ts` — new `CreateLabelRequest`, `UpdateLabelRequest`, `AssignLabelsRequest` DTOs
- `frontend/src/types/domain.ts` — `Label` type update: add optional `icon?: string` field

**Out of scope**:
- Global/cross-board labels (labels are board-scoped per the existing `labels.board_id` FK)
- Label ordering/priority
- Label descriptions or metadata beyond name + color + icon/emoji
- Server-side label filtering (all filtering is client-side per existing `filterCards` pattern)
- Activity feed events for label assignment (label events can be added in a future task)
- Mobile touch color picker optimization (post-MVP per productBrief)

**Dependencies**:
- `labels` and `card_labels` tables already migrated (no new migration needed)
- `Label` type already defined in `frontend/src/types/domain.ts`
- `CardTile` already renders `card.labels` badges (no changes needed to tile rendering)
- `FiltersDropdown` already handles label chips (no changes needed to filter rendering once `allLabels` source is corrected)
- `filterCards` utility already implements label OR-filter logic (no changes needed)
- `sonner` toast library already imported in `CardDetailModal.tsx`

**NFR implications**:
- API response time p95 < 200ms — label endpoints are simple CRUD with a single-table query; no performance risk
- WCAG 2.1 AA — color picker must meet contrast requirements; preset colors must be pre-validated for contrast against label text (white or dark). Color-only selection must not be the sole means of conveying label meaning (name is always shown)
- Keyboard navigation — label picker must be keyboard-accessible (Tab/Enter/Space to toggle); focus management inside modal must be maintained (already implemented in `CardDetailModal.tsx` Tab trap)

### Creative Exploration Needed

This is a Level 3 feature. The following design questions require creative exploration before implementation planning:

**Q1 — Label picker interaction pattern in card modal** (HIGH impact):
- Option A: Inline checkbox list — labels shown as a checklist directly in the modal body; no popover
- Option B: Popover/dropdown — a compact "Add labels" button opens a floating panel with checkboxes
- Option C: Toggle chips — existing labels shown as clickable chips in the modal (toggled = assigned)
- Decision affects `CardDetailModal.tsx` layout complexity and accessible focus management

**Q2 — Label management entry point** (HIGH impact):
- Option A: Inline in label picker — a "Create label" text input and color swatch at the bottom of the label picker (no separate page/panel)
- Option B: Board settings panel — a dedicated "Manage Labels" section accessible from the board header (new UI surface)
- Option C: Inline creation only, edit/delete from the same picker popover
- Decision drives whether a new route/panel component is needed

**Q3 — Color and icon/emoji selection UI** (MEDIUM impact):
- Option A: Preset color palette + optional emoji text input — 12–16 curated swatches for color; a single text input (or small emoji picker) for an optional emoji character (e.g. 🔥, ✅, 🐛). Simple, WCAG-safe.
- Option B: Preset color palette only (no emoji UI) — defer icon to a future task if the implementation complexity grows
- Option C: Preset color palette + emoji picker popover (e.g. emoji-picker-element or a curated grid of common emojis)
- Recommendation lean: Option A (preset colors + plain emoji text input) keeps scope manageable while delivering the feature. The seed script uses 4 hardcoded colors: `#be123c`, `#047857`, `#0369a1`, `#6d28d9` — a curated palette of ~12 feels natural.

**Q4 — Card-label assignment API shape** (MEDIUM impact):
- Option A: Replace-all endpoint — `PUT /api/cards/:cardId/labels` with body `{ labelIds: string[] }` (simple, single call, matches TanStack Query mutation pattern)
- Option B: Individual toggle endpoints — `POST /api/cards/:cardId/labels/:labelId` and `DELETE /api/cards/:cardId/labels/:labelId` (more granular, optimistic update per label)
- Decision affects API surface, optimistic update logic, and activity event granularity

## Test Strategy

### Approach
- **Emphasis**: [To be filled during planning]
- **Target test count**: [To be filled during planning]

### File Organization
- **New test files**: [To be filled during planning]
- **Extend existing**: [To be filled during planning]

### What NOT to Test
- [To be filled during planning]

### Per-Phase Test Guidance
- [To be filled during planning]

## Implementation Roadmap

- [x] Phase 1: Backend — Label CRUD API (`LabelRepository`, `LabelService`, `LabelController`, routes: `GET/POST/PATCH/DELETE /api/boards/:boardId/labels`, migration for `icon` column)
- [x] Phase 2: Backend — Card-label assignment API (`PUT /api/cards/:cardId/labels` replace-all endpoint; `CardLabelController`, `replaceAssignments` transactional repo method, `InvalidLabelAssignmentError`)
- [x] Phase 3: Frontend — Label management UI + card modal label picker (entry point and interaction pattern TBD by Creative Q1/Q2; color/emoji picker TBD by Creative Q3)
- [x] Phase 4: Frontend — Filter source fix (`BoardView` fetches `allLabels` from label API instead of card data), accessibility pass, E2E tests

## Creative Phases

- [x] User Journey Design → memory-bank/creative/TASK-006-card-labels-user-journey.md
- [x] UI/UX Design → memory-bank/creative/TASK-006-card-labels-uiux.md
- [x] Architecture Design → memory-bank/creative/TASK-006-card-labels-architecture.md

---

## Execution State

**Build Status**: IDLE
**Current Phase**: REFLECT → ARCHIVE
**Current Step**: Step 5 - Report Completion
**Can Resume**: NO
**Current Build**: ALL 4 PHASES COMPLETE
**Phase Number**: 4 of 4
**Is Multi-Phase**: YES
**Build Started**: 2026-05-28T10:00:00Z
**Build Completed**: 2026-05-28T10:30:00Z

### Active Sub-Agents
- Reflection Agent: COMPLETE, Agent ID: adb1791a06dd94690, Completed: 2026-05-28T11:30:00Z

### Completed Steps
- Reflection Agent: COMPLETE — Output: memory-bank/reflection/reflection-TASK-006.md
- Pattern Extraction: COMPLETE — 4 learnings extracted, 4 existing _learned/ files amended
- Git Commit: PENDING

### Current Build Step
**Step**: Step 11 — Git Completion
**Status**: COMPLETE
**Completed**: 2026-05-28T10:30:00Z

### Completed Phases
- Phase 1: Backend Label CRUD API — COMPLETE (2026-05-27) - commit 561d432
- Phase 2: Backend Card-Label Assignment API — COMPLETE (2026-05-27) - commit bdd28ca
- Phase 3: Frontend Label Management UI + Card Modal Label Picker — COMPLETE (2026-05-28) - commit cf34d5f

### Phase 3 Summary
- 55 new tests (121 total): labelsApi.test.ts ×8, labelHooks.test.tsx ×11, colorSwatchGrid.test.tsx ×7, labelPickerSection.test.tsx ×18, cardDetail.test.tsx ×11
- New files: labelsApi.ts, useLabels/useCreateLabel/useDeleteLabel/useReplaceCardLabels hooks, LabelPickerSection.tsx, ColorSwatchGrid.tsx
- Modified: CardDetailModal.tsx (interactive label picker), types/api.ts and domain.ts (new DTOs + icon field)
- Tests: 121/121 PASS | Build: PASS | Lint: 0 errors

### Phase 4 Summary
- 8 new tests (129 total): boardView.test.tsx +1 (unassigned-label filter AC-ENTRY-2), labelPickerSection.test.tsx +7 (aria-expanded, aria-controls, panel id/aria-label, aria-checked, aria-invalid, aria-live)
- Modified: BoardView.tsx (replace 14-line card-derived allLabels useMemo with useLabels(boardId) API call)
- Modified: boardView.test.tsx (mock useLabels, add unassigned-label filter test)
- Modified: labelPickerSection.test.tsx (7 accessibility tests)
- Tests: 129/129 PASS | Build: PASS | Lint: 0 errors

### Completed Phases
- Phase 1: Backend Label CRUD API — COMPLETE (2026-05-27) - commit 561d432
- Phase 2: Backend Card-Label Assignment API — COMPLETE (2026-05-27) - commit bdd28ca
- Phase 3: Frontend Label Management UI + Card Modal Label Picker — COMPLETE (2026-05-28) - commit cf34d5f
- Phase 4: Frontend Filter Source Fix + Accessibility + E2E Tests — COMPLETE (2026-05-28) - commit 9f5efc5

### Resumption Notes
**Can Resume**: NO
**Resume From**: N/A — all phases complete. Run /banyan-reflect TASK-006.
