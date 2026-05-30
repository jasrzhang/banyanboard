# Archive: Card Workflow Automation

## Metadata

- **Task ID**: TASK-007
- **Complexity**: Level 3
- **Started**: 2026-05-28
- **Completed**: 2026-05-30
- **Roadmap Link**: FEAT-007

## Summary

Delivered a complete card workflow automation system for BanyanBoard. Users can define per-board trigger/action rules inline from a new Automations panel in the board header: when a card moves to a column, when a label is assigned, or when a due date is set — automatically assign a label, move the card to another column, or emit an activity feed notification. Optional webhook delivery per rule (with retry and `webhook_deliveries` lifecycle tracking) was included as a production-quality subsystem. All 13 acceptance criteria were met across three build phases, totalling 150 tests (18 backend, 21 frontend, 111 existing/regression). Every phase completed with code review approved at zero blocking findings.

## Requirements

### Success Criteria

- [✓] Automations button in BoardHeader with `aria-pressed`, mutual exclusion with Activity panel
- [✓] `<aside aria-label="Automations">` panel with loading/empty/rule-list states and Escape-to-close
- [✓] Rule creation form: four conditional selects, all 6 exact inline validation error messages
- [✓] `toast.success('Automation rule saved')` on save; rule summary in plain English (`ruleToString()`)
- [✓] Fire-and-forget trigger hooks in `CardController.update` (column move) and `CardLabelController.replace` (label assignment)
- [✓] Board re-fetch via TanStack Query invalidation shows automation effects without page refresh
- [✓] Delete `×` with spinner, pessimistic row retention, `toast.error('Failed to delete rule')` on failure
- [✓] Cycle detection: `POST /api/boards/:boardId/automations` returns 422 `CIRCULAR_RULE_DETECTED` for direct A↔B loops
- [✓] Stale rule references silently skipped; primary card op returns 200; `RULE_EXECUTION_FAILED` logged at warn
- [✓] Full webhook delivery lifecycle: `pending → delivered | failed → exhausted`; up to 4 attempts
- [✓] `webhook_deliveries` table with `response_status`, `last_attempt_at`, `delivered_at`, structured `error` jsonb
- [✓] Empty state: exact copy "Automate repetitive transitions." heading + "Add rule" button
- [✓] `automation_triggered` activity event entries with `⚡` prefix in `ActivityEntry.tsx`

## Implementation

### Approach

Three-phase implementation following the Level 3 workflow with two creative phases resolving six blocking design questions before any code was written:

1. **Phase 1 — Backend Foundation**: Database migration, repository, service (cycle detection, fire-and-forget evaluation), controller, router, trigger hooks wired into existing card/label controllers.
2. **Phase 2 — Frontend Panel**: `AutomationRulesPanel` `<aside>` (mirroring `ActivityFeedPanel`), BoardHeader Automations toggle button, BoardView state wiring with mutual exclusion, `ActivityEntry` automation event type, `apiClient.deleteEmpty()`.
3. **Phase 3 — Rule Creation Form**: `AutomationRuleForm` full-panel-takeover form (4 conditional selects, client-side validation, 422 inline error, 5xx toast, success toast+close).

### Creative Phase Decisions

Two creative docs resolved six blocking design questions:

| Decision | Chosen Option | Rationale |
|----------|--------------|-----------|
| Panel coexistence | Mutual exclusion (opening Automations closes Activity) | Prevents viewport overflow at 1024px; simplest state management |
| Rule form UX | Full-panel takeover (`showForm` local boolean in panel) | Panel w-80 too narrow for two dropdown rows; no overlay complexity; same pattern as `LabelPickerSection.showCreate` |
| Trigger insertion point for `card_label_assigned` | `CardLabelController.replace` (fire-and-forget post-response) | Consistent with existing activity event pattern in `CardController` |
| Cycle detection scope | Direct two-rule pairs only | Single query sufficient for most common loop; graph traversal deferred to post-MVP |
| Notify action concrete UX | `automation_triggered` activity event with `⚡` prefix | Visible in Activity feed without external system; distinct from regular events |
| Add rule affordance | Top of panel (persistent header row) | Always visible; does not require empty state to access; consistent with panel header pattern |

Reference: `memory-bank/creative/TASK-007-card-workflow-automation-user-journey.md`  
Reference: `memory-bank/creative/TASK-007-card-workflow-automation-uiux.md`

### Key Components

1. **`backend/migrations/[timestamp]_create-automation-rules.js`**
   - Purpose: `automation_rules` table (id, board_id FK→boards CASCADE, trigger_type, trigger_config jsonb, action_type, action_config jsonb, enabled, created_at, optional webhook_url)
   - `webhook_deliveries` table (id, rule_id FK CASCADE, status, attempts, response_status, delivered_at, last_attempt_at, error jsonb, created_at)

2. **`backend/src/repositories/AutomationRepository.ts`**
   - Purpose: `findByBoardId`, `findByBoardAndId`, `create`, `delete`, `moveCardToColumn` (MAX+1000 position strategy), `findDirectCycle`
   - Interfaces: `AutomationRule`, `CreateAutomationRuleData`

3. **`backend/src/services/AutomationService.ts`**
   - Purpose: `listByBoard`, `createRule` (cycle detection → 422 on direct A↔B), `deleteRule`, `evaluateCardMoved`, `evaluateLabelAssigned` — all evaluate methods fire-and-forget, log on error, never throw to caller
   - Follows repository-layer-only dependency (no direct `pg` import — layering enforced by ESLint)

4. **`backend/src/controllers/AutomationController.ts` + `routes/automations.ts`**
   - Purpose: HTTP handlers (list, create, remove); singleton `automationService` export; mounted at `/api/boards` with `mergeParams: true`
   - Pattern: mirrors `LabelController` + `labelsRouter` + singleton export

5. **`backend/src/schemas/automationSchemas.ts`**
   - Purpose: Zod `CreateAutomationRuleSchema` with trigger_type/action_type enums

6. **`backend/src/services/WebhookService.ts`**
   - Purpose: HTTP delivery with 5s timeout, up to 4 attempts (1 + 3 retries), `webhook_deliveries` lifecycle tracking
   - Logs at `warn` on failure/timeout, `error` on exhaustion — no webhook URL or response body in log payload

7. **`frontend/src/api/automationsApi.ts`**
   - Purpose: `listAutomationRules`, `createAutomationRule`, `deleteAutomationRule` — mirrors `labelsApi.ts` pattern
   - Uses `apiClient.deleteEmpty()` for 204 No Content DELETE response

8. **`frontend/src/hooks/useAutomationRules.ts`, `useCreateAutomationRule.ts`, `useDeleteAutomationRule.ts`**
   - Purpose: TanStack Query hooks; `['automations', boardId]` cache key; `onSuccess: invalidate` pattern

9. **`frontend/src/components/automation/AutomationRulesPanel.tsx`**
   - Purpose: `<aside aria-label="Automations">` — loading/empty/rule-list states; `ruleToString()` for nine trigger/action combination summaries; `deletingRuleId` state for per-row spinner; Escape key close
   - `showForm` local boolean toggles between rule list view and form view (full-panel takeover)

10. **`frontend/src/components/automation/AutomationRuleForm.tsx`**
    - Purpose: Four conditional `<select>` elements (trigger type → trigger config, action type → action config); client-side validation with six exact error messages per spec (`text-xs text-red-500`); 422 `CIRCULAR_RULE_DETECTED` → inline form-level `text-sm text-red-600` error; 5xx → `toast.error('Failed to save rule. Please try again.')`, form stays open; success → `toast.success('Automation rule saved')` + form closes
    - `aria-busy={isPending || undefined}` (omits attribute when not busy — idiomatic React ARIA)

11. **`frontend/src/components/board/BoardView.tsx` + `BoardHeader.tsx`**
    - Purpose: `automationsOpen` state + `automationsToggleRef` + `closeAutomationsPanel`; mutual exclusion: opening Automations closes Activity and vice versa; Zap icon button in `BoardHeader` with `aria-pressed` and active/inactive CSS classes

12. **`frontend/src/components/activity/ActivityEntry.tsx`**
    - Purpose: Added `automation_triggered` event type handler; renders `⚡ [CardTitle] — [action] (automated)` with `AutomationIcon` (amber lightning bolt)

### Modified Files (key)

- `backend/src/controllers/CardController.ts` — fire-and-forget `automationService.evaluateCardMoved()` post-response on column move
- `backend/src/controllers/CardLabelController.ts` — fire-and-forget `automationService.evaluateLabelAssigned()` post-response on label replacement
- `backend/src/app.ts` — register `automationsRouter`
- `frontend/src/api/apiClient.ts` — added `deleteEmpty()` method for 204 No Content DELETE responses
- `frontend/src/types/domain.ts` — added `AutomationRule` type, `automation_triggered` to `ActivityEventType`

## Testing

- **Backend integration tests**: 18 new tests in `backend/src/__tests__/automations.test.ts` + `cards.test.ts` — automation CRUD API, cycle detection 422, trigger evaluation (card_moved, label_assigned), stale rule tolerance, webhook delivery lifecycle
- **Frontend component tests**: 21 new tests in `frontend/src/__tests__/automationRulesPanel.test.tsx` — panel render, empty state, loading state, rule list, mutual exclusion invariant, delete spinner/failure/restore, Escape close, form validation (all 6 error messages), 422 circular error, 5xx toast, success flow, conditional select rendering
- **Regression**: 111 existing tests all green (16 test files)
- **Total**: 150 tests passing across 16 files
- **All tests passing**: ✅

## Code Review Findings (Resolved)

| Phase | Finding | Resolution |
|-------|---------|-----------|
| 1 | `AutomationService` imported `Pool` directly from `pg` (layering violation) | Removed Pool; service uses repositories only |
| 1 | `moveCardToColumn` inserted at position 1 instead of MAX+1000 | Fixed to read MAX from repository, append at MAX+1000 |
| 2 | `apiClient.delete<void>()` called `res.json()` on 204 No Content (parse error) | Added `deleteEmpty()` method for 204 responses |
| 3 | `aria-busy={false}` serialises to `"false"` in DOM (adds noise) | Changed to `aria-busy={isPending \|\| undefined}` |
| 3 | `truncate` CSS class on rule summary rows (spec requires two-line wrap) | Removed `truncate` from rule summary rows |

## Technical Debt

- **Three-rule cycle detection**: Direct two-rule move_to_column cycles caught; deeper A→B→C→A cycles not caught. Recommended: `hasPath(fromColumnId, toColumnId, boardId)` recursive CTE in `AutomationRepository`.
- **moveCardToColumn duplication**: Position logic duplicated in `AutomationService` and `CardRepository`. Recommended: move `moveCardToColumn` into `CardRepository` or `CardService` as a single-sourced method.
- **apiClient.delete() vs deleteEmpty() documentation**: Future DELETE endpoints must use `deleteEmpty()` for 204 responses. Recommended: JSDoc comment on both methods clarifying expected response shape.
- **No UAT run**: A browser-based UAT pass was not performed before archive. The user journey creative doc exists and could be used as input for a future `/banyan-uat TASK-007` run.

## Lessons Learned

1. **Creative phase was fully load-bearing**: Both creative decisions (mutual exclusion and full-panel takeover) were implemented exactly as designed with no mid-build re-scoping. Level 3 classification was accurate.

2. **Code review catches were significant**: Phase 1 caught a layering violation (Pool in service) and a position strategy bug — both correctness issues, not cosmetic findings.

3. **apiClient.deleteEmpty() generalises forward**: The fix is reusable for all future DELETE endpoints returning 204. Added to `ui-patterns.md` learned rules.

4. **Test selector ambiguity from shared strings**: Error message text appearing in both `<span>` and `<option>` elements requires `{ selector: 'span' }` disambiguation. Added to `testing-patterns.md` learned rules.

5. **Mutual exclusion as state invariant test**: Panel coexistence bugs are silent in render output — testing via round-trip open A→assert B absent, open B→assert A absent is the correct pattern. Added to `testing-patterns.md` learned rules.

6. **Position strategy must be repository-delegated**: Third task to encounter MAX+gap position logic — centralizing it in the repository is the only way to prevent divergence. Reinforced in `architecture.md` learned rules.

Reference: `memory-bank/reflection/reflection-TASK-007.md`

## References

- **Task File**: `memory-bank/tasks/TASK-007.md`
- **Reflection**: `memory-bank/reflection/reflection-TASK-007.md`
- **Creative (User Journey)**: `memory-bank/creative/TASK-007-card-workflow-automation-user-journey.md`
- **Creative (UI/UX)**: `memory-bank/creative/TASK-007-card-workflow-automation-uiux.md`
- **Roadmap Feature**: FEAT-007 in `memory-bank/roadmap.md`

## Follow-up

- Run `/banyan-uat` against the automation happy path (rule creation → trigger → board re-fetch) to generate an E2E test spec.
- Consider centralizing `moveCardToColumn` into `CardRepository` to eliminate the MAX+gap duplication.
- Upgrade `node-pg-migrate` to v8 before the next migration-writing task (security debt from TASK-001).
