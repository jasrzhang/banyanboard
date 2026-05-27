# Archive: TASK-006 — Card Labels

## Metadata

- **Task ID**: TASK-006
- **Complexity**: Level 3
- **Started**: 2026-05-27
- **Completed**: 2026-05-28
- **Roadmap Link**: FEAT-006
- **Branch**: feature/FEAT-006-card-labels
- **Total Phases**: 4

---

## Summary

TASK-006 delivered color-coded card labels for BanyanBoard — the first user-facing categorization and filtering feature. Users can create labels with a name, color (from a 12-color WCAG-AA palette), and optional emoji icon; assign or remove labels from any card via an interactive popover picker in the card detail modal; and filter the board by one or more labels using the existing Filters dropdown. All label data is board-scoped and persisted to PostgreSQL.

The feature required end-to-end implementation across four phases: backend CRUD API, backend card-label assignment API with transactional atomicity, frontend label picker UI and React Query hooks, and a filter-source fix with accessibility audit. All 9 acceptance criteria were met with 129/129 tests passing.

---

## Requirements

### Original Requirements

- Label CRUD API: `GET / POST / PATCH / DELETE /api/boards/:boardId/labels`
- Card-label assignment API: `PUT /api/cards/:cardId/labels` (replace-all)
- LabelRepository, LabelService, LabelController following existing Clean Architecture patterns
- Frontend `labelsApi.ts`, `useLabels`, `useCreateLabel`, `useDeleteLabel`, `useReplaceCardLabels` hooks (TanStack Query)
- LabelPickerSection in CardDetailModal — interactive popover with checkbox chips + inline creation form
- ColorSwatchGrid — 12 WCAG-AA validated preset colors
- Optional emoji text input for label icons
- BoardView `allLabels` from label API (not card-derived) so unassigned labels appear in filter
- Migration: `1747600006000_add-icon-to-labels.js` (nullable `icon VARCHAR(10)` column)

### Success Criteria

- [x] Label badges appear on card tiles immediately after assignment
- [x] Label CRUD API operational with board-scoped uniqueness enforcement
- [x] PUT replace-all endpoint is transactionally atomic
- [x] LabelPickerSection popover is fully interactive and keyboard-navigable
- [x] BoardView allLabels from API (unassigned labels appear in filter)
- [x] 129/129 tests PASS, Build PASS, Lint 0 errors

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC-ENTRY-1 | Interactive label picker in card modal | ✅ Met |
| AC-ENTRY-2 | Board filter shows labels from API (including unassigned) | ✅ Met |
| AC-HAPPY-1 | Create label with name + color + optional emoji | ✅ Met |
| AC-HAPPY-2 | Assign label with optimistic update + rollback | ✅ Met |
| AC-HAPPY-3 | Filter board by label (client-side) | ✅ Met |
| AC-HAPPY-4 | Remove label from card | ✅ Met |
| AC-HAPPY-5 | Delete label — CASCADE removes card_labels | ✅ Met |
| AC-ERROR-1 | Duplicate label name → 409 with inline error | ✅ Met |
| AC-ERROR-2 | Empty name → client validation | ✅ Met |
| AC-ERROR-3 | Network error → rollback + toast | ✅ Met |

---

## Implementation

### Approach

Bottom-up Clean Architecture implementation: Repository → Service → Controller → Routes for the backend; API module → Query/Mutation hooks → UI components for the frontend. All new modules mirror existing analogs in the codebase (LabelRepository mirrors CardRepository, labelsRouter mirrors activityRouter, useReplaceCardLabels mirrors useUpdateCard).

### Phase 1: Backend Label CRUD API (commit 561d432)

**Goal**: Full CRUD for board-scoped labels with duplicate-name protection.

**Key components:**
- `backend/src/repositories/LabelRepository.ts` — `findByBoardId`, `findById`, `create`, `update`, `delete`, `getCardBoardId`, `getAssignedLabelIds`, `replaceAssignments` (transactional)
- `backend/src/services/LabelService.ts` — board-scope validation, `DuplicateLabelError` typed error, `replaceCardLabels` returning `{ added, removed }` diff
- `backend/src/controllers/LabelController.ts` + `CardLabelController` — Zod validation, `DuplicateLabelError` → 409, null → 404
- `backend/src/schemas/labelSchemas.ts` — `CreateLabelSchema`, `UpdateLabelSchema`, `ReplaceCardLabelsSchema`
- `backend/src/routes/labels.ts` — `Router({ mergeParams: true })`, mounted at `/api/boards`
- `backend/migrations/1747600006000_add-icon-to-labels.js` — nullable `icon VARCHAR(10)` column
- Updated `BoardRepository.findByIdWithColumnsAndCards` to include `icon` field in per-label `json_build_object`

### Phase 2: Backend Card-Label Assignment API (commit bdd28ca)

**Goal**: Atomic replace-all endpoint for card-label assignments.

**Key components:**
- `LabelRepository.replaceAssignments` — transactional SQL: `BEGIN; validate labels belong to board; DELETE old; INSERT ON CONFLICT DO NOTHING; SELECT result; COMMIT`
- `CardLabelController.replace` — `PUT /api/cards/:cardId/labels`; `cardLabelController` exported from `routes/labels.ts`, imported in `routes/cards.ts` (same singleton-sharing pattern as `activityService`)
- `InvalidLabelAssignmentError` for cross-board label ID attempts

### Phase 3: Frontend Label Management UI (commit cf34d5f)

**Goal**: Interactive label picker in card modal with inline creation form.

**Key components:**
- `frontend/src/api/labelsApi.ts` — `fetchLabels`, `createLabel`, `updateLabel`, `deleteLabel`, `replaceCardLabels`
- `frontend/src/hooks/useLabels.ts`, `useCreateLabel.ts`, `useDeleteLabel.ts`, `useReplaceCardLabels.ts` — TanStack Query with snapshot/rollback/invalidate pattern
- `frontend/src/components/card/LabelPickerSection.tsx` — popover trigger + panel + inline creation form; `isOpen`/`showCreate` state; outside-click close; focus management (aria-expanded, aria-controls, focus on open/close/back)
- `frontend/src/components/ui/ColorSwatchGrid.tsx` — 12-swatch grid, `aria-label` + `aria-pressed` per swatch
- `frontend/src/types/api.ts` — `CreateLabelRequest`, `UpdateLabelRequest`, `ReplaceCardLabelsRequest`, `ReplaceCardLabelsResponse`
- `frontend/src/types/domain.ts` — `Label` type extended with `icon?: string | null`
- `frontend/src/components/card/CardDetailModal.tsx` — display-only labels block replaced with `<LabelPickerSection>`
- **Tests**: 55 new tests (121 total) — `labelsApi.test.ts` ×8, `labelHooks.test.tsx` ×11, `colorSwatchGrid.test.tsx` ×7, `labelPickerSection.test.tsx` ×18, `cardDetail.test.tsx` ×11

### Phase 4: Filter Source Fix + Accessibility + E2E Tests (commit 9f5efc5)

**Goal**: Correct `allLabels` source in BoardView; full accessibility audit of LabelPickerSection.

**Key changes:**
- `frontend/src/components/board/BoardView.tsx` — replaced 14-line card-derived `allLabels` `useMemo` with `useLabels(boardId)` API call
- **Tests**: 8 new tests (129 total) — `boardView.test.tsx` +1 (unassigned-label filter AC-ENTRY-2), `labelPickerSection.test.tsx` +7 (aria-expanded, aria-controls, panel id/aria-label, aria-checked, aria-invalid, aria-live)

### Design Decisions

See full creative exploration in:
- Architecture: `memory-bank/creative/TASK-006-card-labels-architecture.md`
- UI/UX: `memory-bank/creative/TASK-006-card-labels-uiux.md`
- User Journey: `memory-bank/creative/TASK-006-card-labels-user-journey.md`

**Key decisions:**
1. **Q4 — Replace-all API** (`PUT /api/cards/:cardId/labels` with full `labelIds[]`) — Mirrors `useUpdateCard` snapshot/rollback/invalidate pattern; eliminates race conditions; single transaction; `{ added, removed }` diff for future activity-feed integration.
2. **Q1 — Popover picker** (anchored to trigger button, consistent with FiltersDropdown) — Modal-space-efficient; scales to any label count; one extra click vs always-visible list is acceptable.
3. **Q3 — Preset 12-color swatch grid + emoji text input** — No library dependency; all 12 colors WCAG 2.1 AA vs white text; emoji `maxLength=2` with grapheme-cluster extraction.
4. **Q2 — Inline creation inside picker panel** (`showCreate` toggle within `LabelPickerSection`) — Avoids a separate route/panel; no modal-height impact.

---

## Testing

- **Unit tests**: 129 total (55 new in Phase 3, 8 new in Phase 4; extended across Phases 1–4)
- **Integration tests**: Backend label CRUD + replace-all endpoint (Phases 1–2)
- **Component tests**: `LabelPickerSection`, `ColorSwatchGrid`, `CardDetailModal`, `BoardView` (Phases 3–4)
- **All tests passing**: ✅ 129/129 PASS
- **Build**: ✅ PASS
- **Lint**: ✅ 0 errors

---

## Files Changed

### Backend (new)
- `backend/src/repositories/LabelRepository.ts` — CRUD + transactional `replaceAssignments`
- `backend/src/services/LabelService.ts` — business logic, `DuplicateLabelError`
- `backend/src/controllers/LabelController.ts` — `LabelController` + `CardLabelController`
- `backend/src/schemas/labelSchemas.ts` — Zod schemas for all label DTOs
- `backend/src/routes/labels.ts` — `labelsRouter` + `cardLabelController` export
- `backend/migrations/1747600006000_add-icon-to-labels.js` — `icon` column migration
- `backend/src/__tests__/labels.test.ts` — label CRUD integration tests
- `backend/src/__tests__/cardLabels.test.ts` — replace-all integration tests

### Backend (modified)
- `backend/src/repositories/BoardRepository.ts` — add `icon` to per-label `json_build_object`
- `backend/src/app.ts` — mount `labelsRouter`
- `backend/src/routes/cards.ts` — import `cardLabelController`, wire `PUT /:cardId/labels`

### Frontend (new)
- `frontend/src/api/labelsApi.ts` — `fetchLabels`, `createLabel`, `updateLabel`, `deleteLabel`, `replaceCardLabels`
- `frontend/src/hooks/useLabels.ts`
- `frontend/src/hooks/useCreateLabel.ts`
- `frontend/src/hooks/useDeleteLabel.ts`
- `frontend/src/hooks/useReplaceCardLabels.ts`
- `frontend/src/components/card/LabelPickerSection.tsx`
- `frontend/src/components/ui/ColorSwatchGrid.tsx`
- `frontend/src/__tests__/labelsApi.test.ts`
- `frontend/src/__tests__/labelHooks.test.tsx`
- `frontend/src/__tests__/colorSwatchGrid.test.tsx`
- `frontend/src/__tests__/labelPickerSection.test.tsx`

### Frontend (modified)
- `frontend/src/components/card/CardDetailModal.tsx` — interactive `LabelPickerSection` replaces display-only block
- `frontend/src/components/board/BoardView.tsx` — `allLabels` from `useLabels(boardId)` API
- `frontend/src/types/api.ts` — `CreateLabelRequest`, `UpdateLabelRequest`, `ReplaceCardLabelsRequest/Response` DTOs
- `frontend/src/types/domain.ts` — `Label.icon?: string | null`
- `frontend/src/__tests__/cardDetail.test.tsx` — extended for label picker interactions
- `frontend/src/__tests__/boardView.test.tsx` — mock `useLabels`, add unassigned-label filter test

---

## Lessons Learned

From `memory-bank/reflection/reflection-TASK-006.md`:

1. **Creative phase as implementation spec.** Architecture and UI/UX creative docs were specific enough (exact SQL, exact interfaces, exact Zod schemas, exact aria attributes) that build phases needed no re-design. The Phase 2 transactional SQL was copied from the creative doc with minimal adjustment.

2. **Accessibility testing is an in-phase concern.** Seven accessibility tests (aria-expanded, aria-controls, aria-checked, aria-invalid, aria-live) were added in Phase 4 that logically belonged in Phase 3. Co-locating ARIA attribute tests with component implementation is now encoded as a learned rule.

3. **Replace-all API simplifies the full stack.** A single idempotent PUT eliminates frontend race conditions, simplifies optimistic-update logic to one snapshot/rollback/invalidate, and makes diff computation trivial for future activity events.

---

## Technical Debt & Future Work

- **Activity event integration**: `LabelService.replaceCardLabels` already returns `{ added, removed }`. Wiring `activityService.recordEvent` is a future Level 2 task with no structural changes needed.
- **SSE-driven label sync**: Labels on two concurrent sessions won't sync until reload. Post-MVP.
- **Label editing UI**: `PATCH /api/boards/:boardId/labels/:labelId` backend exists; no frontend editor yet.
- **Mobile picker optimization**: Bottom-sheet layout for `<640px` is noted as post-MVP.

---

## References

- Task Plan: `memory-bank/tasks/TASK-006.md`
- Reflection: `memory-bank/reflection/reflection-TASK-006.md`
- Architecture: `memory-bank/creative/TASK-006-card-labels-architecture.md`
- UI/UX: `memory-bank/creative/TASK-006-card-labels-uiux.md`
- User Journey: `memory-bank/creative/TASK-006-card-labels-user-journey.md`
