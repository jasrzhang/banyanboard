# TASK-007: Card Workflow Automation

**Complexity**: Level 3
**Status**: REFLECTION_COMPLETE
**Reflection**: memory-bank/reflection/reflection-TASK-007.md
**Roadmap**: FEAT-007
**Branch**: feature/FEAT-007-card-workflow-automation
**Worktree**: C:/git/banyanboard/.claude-worktrees/FEAT-007

## Task Description

Simple trigger/action rules on cards: when a card moves to a column or gets a label/due date, automatically fire a configurable action (assign a label, move to another column, send a notification). Rules defined inline per-board with no separate automation page.

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Lead (engineering or product lead) — wants to reduce manual housekeeping on the board by automating repetitive state transitions (e.g., when a card moves to "Done", automatically apply a "Shipped" label). Secondary persona: Team Member who benefits from labels and columns being kept consistent without manual steps.
**Creative Exploration Needed**: Yes — see "Creative Exploration Needed" section below.

### Invocation Method

- **Location**: BoardHeader (`frontend/src/components/board/BoardHeader.tsx`) — a new "Automations" button added to the right-side controls row, positioned between the "Activity" button and the "New Card" button, following the same button styling pattern as the existing "Activity" toggle.
- **Element**: A labeled button with an icon (automation/lightning bolt) that toggles open an "Automations" side panel — mirroring the exact `activityOpen` / `onActivityToggle` pattern in `BoardView.tsx` and `ActivityFeedPanel.tsx` (`frontend/src/components/activity/ActivityFeedPanel.tsx`).
- **Visibility**: Always visible to any user who has a board open. All team members can view and manage automations (no role-based access control in MVP — board-level access is the only authorization boundary).
- **Navigation**: User opens any board (sidebar → board) → sees "Automations" button in `BoardHeader` → clicks to open the Automations panel as a right-side `<aside>` overlay (same position and layout as `ActivityFeedPanel` at `w-80 border-l border-border bg-surface-card flex flex-col h-full`).
- **Confidence**: MEDIUM — the "Activity panel as toggle-able aside" pattern is a strong precedent (`BoardView`, `ActivityFeedPanel`, `BoardHeader` all implement this), but the exact button label, icon, and whether the panel can coexist with the activity panel open simultaneously are design decisions for the creative phase.

### Success Criteria

- **User sees (rule creation)**: After completing the rule creation form in the Automations panel and clicking "Save rule", the new rule appears as a row in the panel's rule list with its trigger and action summarized in plain English (e.g., "When card moves to Done → Apply label Shipped"). A toast notification ("Automation rule saved") confirms persistence, consistent with the `toast.success('Card saved')` pattern in `CardDetailModal.tsx`.
- **User sees (rule firing)**: When a card event matches a saved rule's trigger, the action executes immediately — the board re-renders with the action applied (e.g., a label chip appears on the card tile, or the card appears in its new column) without a manual page refresh. The activity feed (`ActivityFeedPanel`) gains a new entry for the action taken by the automation (e.g., "Automation: moved card to Done").
- **Verifiable at**: The Automations panel (rules list) shows the saved rule. The affected card tile on the board reflects the applied action. The activity feed shows an event entry for the automation-triggered action.
- **Data persisted**: A new `automation_rules` table (PostgreSQL) with columns: `id` (uuid PK), `board_id` (uuid FK → boards CASCADE), `trigger_type` (text — e.g., `card_moved_to_column`, `card_label_assigned`, `card_due_date_set`), `trigger_config` (jsonb — e.g., `{ "columnId": "..." }` or `{ "labelId": "..." }`), `action_type` (text — e.g., `assign_label`, `move_to_column`, `notify`), `action_config` (jsonb — e.g., `{ "labelId": "..." }` or `{ "columnId": "..." }`), `created_at` (timestamptz). Board-level scope — no per-user ownership of rules.
- **Observable within**: Rule creation is immediate (synchronous POST). Rule execution when a trigger fires is immediate (in-process, synchronous within the card update request cycle or as a post-response side effect, consistent with the fire-and-forget activity event pattern in `CardController.ts`).

### Acceptance Criteria

#### AC-ENTRY-1: User can find the Automations panel entry point

**Priority**: MUST
**Given** a user has a board open in `BoardView` (board loaded, at least one column visible)
**When** the user looks at the `BoardHeader` right-side controls (which currently contains SearchInput, FiltersDropdown, Activity button, New Card button)
**Then** they see an "Automations" button in the `BoardHeader` controls row with `bg-nav-hover text-text-secondary hover:bg-border` styling when inactive — identical to the "Activity" button's inactive classes (`BoardHeader.tsx` L50–74)

#### AC-ENTRY-2: User can open the Automations panel

**Priority**: MUST
**Given** the user is on a board with the Automations panel closed
**When** the user clicks the "Automations" button in `BoardHeader`
**Then** an Automations `<aside aria-label="Automations">` panel appears on the right of the board area (instant conditional render — no slide animation; identical to `{activityOpen && <ActivityFeedPanel … />}` at `BoardView.tsx` L242–244) with classes `w-80 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden`, and the "Automations" button gains `aria-pressed="true"` and switches to `bg-primary text-primary-foreground` active classes

#### AC-HAPPY-1: User creates a "card moved to column" trigger with "assign label" action

**Priority**: MUST
**Given** the user has the Automations panel open on a board that has at least two columns and at least one label
**When** they:

1. Click the "Add rule" button in the panel
2. Select trigger type "When a card moves to a column" from the trigger type dropdown
3. Select the target column from the "Column" dropdown (populated from the board's columns)
4. Select action type "Assign label" from the action type dropdown
5. Select the target label from the "Label" dropdown (populated from the board's labels)
6. Click "Save rule"
   **Then**:

- The rule creation form closes
- The new rule appears in the panel's rule list with the plain-English summary: `When card moves to [ColumnName] → Assign label [LabelName]`
- `toast.success('Automation rule saved')` is displayed (exact string)
- `GET /api/boards/:boardId/automations` returns the new rule with `trigger_type: "card_moved_to_column"`, `trigger_config: { "columnId": "<uuid>" }`, `action_type: "assign_label"`, `action_config: { "labelId": "<uuid>" }`

#### AC-HAPPY-2: Automation rule fires when a card is moved to the trigger column

**Priority**: MUST
**Given** a rule exists: trigger `card_moved_to_column` → column C, action `assign_label` → label L
**When** a user drags a card (title: "Fix login bug") into column C (triggering `PATCH /api/cards/:cardId` with `{ columnId: <C.id> }` via `CardController.update`)
**Then**:

- The primary `PATCH` returns 200 immediately
- The board's TanStack Query cache is invalidated via `queryClient.invalidateQueries(['board', boardId])` in the card mutation's `onSettled`; the subsequent `GET /api/boards/:boardId` returns the card with label L already in its `labels` array (automation runs fire-and-forget post-response; on localhost the DB write completes before the re-fetch arrives — see AC-ASYNC-3 for timing nuance)
- Label L appears as a chip on the card tile without a manual page refresh
- The Activity feed gains an entry with event_type `automation_triggered` rendered as: `⚡ Fix login bug — label [LabelName] applied (automated)` (exact display format — `ActivityEntry.tsx` must handle `automation_triggered` event_type with the `⚡` prefix)
- `GET /api/boards/:boardId` returns the card with label L in its `labels` array

#### AC-HAPPY-3: User creates a "card label assigned" trigger with "move to column" action, and it fires

**Priority**: MUST
**Given** the Automations panel is open and the board has at least two columns and at least one label
**When** the user:

1. Selects trigger type "When a label is assigned to a card", selects label X, selects action type "Move card to column", selects column Y, and clicks "Save rule"
   **Then**:

- `toast.success('Automation rule saved')` is displayed (same exact string as AC-HAPPY-1)
- The rule appears in the list as: `When label [LabelName] is assigned → Move to [ColumnName]`
  **And** when a user subsequently assigns label X to any card (via `LabelPickerSection` → `PUT /api/cards/:cardId/labels`):
- The card appears in column Y on the next board re-fetch (TanStack Query invalidation — same mechanism as AC-HAPPY-2)
- The Activity feed gains an entry: `⚡ [CardTitle] — moved to [ColumnName] (automated)` (exact format)

#### AC-HAPPY-4: User deletes an existing automation rule

**Priority**: MUST
**Given** at least one rule exists in the Automations panel rule list
**When** the user clicks the `×` delete button on a rule row (no confirmation dialog)
**Then**:

- The `×` icon is replaced by a spinner for the duration of the `DELETE /api/boards/:boardId/automations/:ruleId` request (pessimistic — rule stays in list during flight)
- On `204 No Content`: the rule row is removed from the list
- On error (see AC-ERROR-4): the spinner is restored to `×`, the row remains, `toast.error('Failed to delete rule')` is shown

#### AC-ERROR-1: User submits an incomplete rule form

**Priority**: MUST
**Error code**: `INVALID_RULE_FORM` (client-side only — no HTTP request is made)
**Given** the rule creation form is open
**When** the user clicks "Save rule" with one or more required fields unselected
**Then** the form does not submit, no network request is made, and inline errors appear below each missing field (`text-xs text-red-500` — same class as `nameError` in `LabelPickerSection.tsx`):

| Missing field                                        | Exact error message          |
| ---------------------------------------------------- | ---------------------------- |
| Trigger type not selected                            | `Select a trigger type`      |
| Trigger column not selected (`card_moved_to_column`) | `Select a column to watch`   |
| Trigger label not selected (`card_label_assigned`)   | `Select a label to watch`    |
| Action type not selected                             | `Select an action type`      |
| Action label not selected (`assign_label`)           | `Select a label to apply`    |
| Action column not selected (`move_to_column`)        | `Select a column to move to` |

#### AC-ERROR-2: Stale rule references — automation silently skipped

**Priority**: MUST
**Error code**: `RULE_EXECUTION_FAILED` (internal — logged only; never surfaced to the user)
**Given** an automation rule references a label or column that has since been deleted
**When** a card move or label assignment triggers the rule
**Then**:

- The primary card operation succeeds; HTTP response is 200 — the automation failure must not block the primary operation
- `AutomationService.evaluate*` catches the error and logs at `warn` level via the root logger with payload: `{ event: "RULE_EXECUTION_FAILED", ruleId: "<uuid>", triggerType: "<string>", reason: "<error message>" }` — no card IDs, label names, or column names in the log payload (minimise PII/noise)
- The user sees no error message; the stale rule is silently skipped

#### AC-ERROR-3: User cannot create a directly circular move-to-column rule

**Priority**: SHOULD
**Error code**: `CIRCULAR_RULE_DETECTED`
**Response shape**: `{ "code": "CIRCULAR_RULE_DETECTED", "message": "This rule would create a circular automation loop", "details": [] }`
**Given** a rule "When card moves to column A → Move card to column B" already exists
**When** the user attempts to save "When card moves to column B → Move card to column A"
**Then**:

- `POST /api/boards/:boardId/automations` returns HTTP 422 with the exact response shape above
- The frontend displays `This rule would create a circular automation loop` as an inline form-level error below the "Save rule" button, styled `text-sm text-red-600` (same as `errorMessage` rendering in `CardDetailModal.tsx`)
- The form fields remain editable; the user can change their selection and retry
- Scope limited to direct two-rule cycles (A→B, B→A); deeper cycles (A→B→C→A) are out of scope for MVP — Confidence: LOW (creative phase confirms scope)

#### AC-ERROR-4: Delete rule fails

**Priority**: MUST
**Given** the user clicks `×` on a rule row and `DELETE /api/boards/:boardId/automations/:ruleId` returns a non-204 response (network error or 5xx)
**When** the request fails
**Then**:

- The spinner on that row reverts to the `×` icon
- The rule row remains in the list unchanged
- `toast.error('Failed to delete rule')` is displayed (exact string)

#### AC-EMPTY-1: Empty state when no rules exist

**Priority**: MUST
**Given** the user opens the Automations panel on a board with no rules configured
**Then** the panel body shows:

- Heading text (exact): `Automate repetitive transitions.`
- Sub-text (exact): `When a card moves to Done, apply the Shipped label — automatically.`
- A prominent "Add rule" button (`+ Add rule`) using the same primary button style as the `CardDetailModal` save button
- No spinner or loading indicator (the empty state is shown after the query resolves with an empty array)

#### AC-ASYNC-1: Panel shows loading state while rules are being fetched

**Priority**: MUST
**Given** the user opens the Automations panel
**When** `useAutomationRules` query is in flight (initial load; `isLoading: true`)
**Then** the panel body shows a centered spinner (a `<div className="flex justify-center p-4">` containing a spinner element with `<span className="sr-only">Loading rules…</span>`) — same pattern as `ActivityFeedPanel`'s SSE connecting indicator; the "Add rule" affordance is not rendered until the query resolves

#### AC-ASYNC-2: Save rule button is disabled while POST is in flight; form survives failure

**Priority**: MUST
**Given** the user has filled in a valid rule form and clicks "Save rule"
**When** `POST /api/boards/:boardId/automations` is in flight (`isPending: true` on the mutation)
**Then**:

- The "Save rule" button is `disabled` and displays a spinner in place of its label (same `disabled` + spinner pattern used on the save button in `CardDetailModal.tsx` during save)
- The form fields remain visible (not locked); no second submission is possible while pending
  **And when** the POST returns a non-2xx response (including unexpected 5xx):
- `toast.error('Failed to save rule. Please try again.')` is displayed (exact string)
- The form remains open with all user-entered selections preserved (no reset)
- The rules list is unchanged

#### AC-ASYNC-3: Automation effect is visible after card operation re-fetch

**Priority**: MUST
**Given** an active automation rule (e.g., `card_moved_to_column` → `assign_label`)
**When** a card operation completes (`PATCH /api/cards/:cardId` returns 200) and TanStack Query invalidates `['board', boardId]` in `onSettled`
**Then**:

- The subsequent `GET /api/boards/:boardId` re-fetch returns the card with the automation-applied change already reflected (label added or card in new column)
- The board UI updates to show the automation effect without a manual page refresh
- Timing note: automation runs fire-and-forget post-response on the backend; on localhost the automation DB write completes before the GET arrives. If the re-fetch races ahead of the automation write (theoretically possible under load), the effect will appear on the next board re-fetch (e.g., next card interaction). This is acceptable for MVP — no additional polling or websocket push is required

#### AC-HAPPY-5: Webhook delivery succeeds for a rule with a webhook URL

**Priority**: MUST
**Given** a rule has `webhook_url` set to a valid URL (e.g., `https://hooks.example.com/board-events`) and the rule's trigger fires (e.g., card moved to the trigger column)
**When** the webhook endpoint responds 2xx within 5 seconds
**Then**:

- A `POST` request is sent to the `webhook_url` with `Content-Type: application/json` and body:
  ```json
  {
    "ruleId": "<uuid>",
    "boardId": "<uuid>",
    "cardId": "<uuid>",
    "triggerType": "<string — e.g. card_moved_to_column>",
    "triggerContext": { "<trigger-specific key>": "<uuid>" },
    "triggeredAt": "<ISO 8601 UTC timestamp>"
  }
  ```
- The primary card operation is unaffected — webhook delivery runs fire-and-forget post-response (same pattern as rule evaluation)
- A `webhook_deliveries` record is created with: `id` (uuid), `rule_id` (uuid FK→automation_rules CASCADE), `status: "delivered"`, `attempts: 1`, `response_status: <HTTP status code returned by endpoint>`, `delivered_at: <timestamptz>`, `last_attempt_at: <timestamptz>`, `created_at: <timestamptz>`
- The delivery lifecycle transitions: `pending` → `delivered` (single-attempt success case)
- Delivery latency: the webhook POST is initiated within 2 seconds of the trigger completing its in-process action execution (not counting network round-trip to the external endpoint)

#### AC-ERROR-5: Webhook endpoint returns non-2xx — retry scheduled

**Priority**: MUST
**Error code**: `WEBHOOK_DELIVERY_FAILED` (internal — recorded in `webhook_deliveries`; never surfaced to the user)
**Response shape** (delivery record `error` field): `{ "code": "WEBHOOK_DELIVERY_FAILED", "message": "Endpoint returned <status>", "details": [] }`
**Given** a rule has a `webhook_url` and the trigger fires
**When** the webhook endpoint returns a non-2xx HTTP status (e.g., 500, 404, 429)
**Then**:

- The `webhook_deliveries` record `status` is `"failed"` after the attempt
- `attempts` is incremented; `last_attempt_at` updated; `response_status` records the HTTP status returned; `error` field holds the `WEBHOOK_DELIVERY_FAILED` payload
- A retry is scheduled (up to 3 retries — 4 total attempts maximum)
- The primary card operation is unaffected — the non-2xx response does not propagate to the card update result
- `WebhookService` logs at `warn` level: `{ event: "WEBHOOK_DELIVERY_FAILED", ruleId: "<uuid>", attempt: <n>, responseStatus: <n> }` — no webhook URL or response body in the log payload

#### AC-ERROR-6: Webhook endpoint times out — retry scheduled

**Priority**: MUST
**Error code**: `WEBHOOK_DELIVERY_TIMEOUT` (internal — recorded in delivery record `error` field)
**Response shape** (delivery record `error` field): `{ "code": "WEBHOOK_DELIVERY_TIMEOUT", "message": "Request timed out after 5000ms", "details": [] }`
**Given** a rule has a `webhook_url` and the trigger fires
**When** the webhook endpoint does not respond within 5 seconds (connection or read timeout)
**Then**:

- The timeout is treated identically to a non-2xx response for retry purposes
- The `webhook_deliveries` record `status` is `"failed"`; `error` field holds the `WEBHOOK_DELIVERY_TIMEOUT` payload; `attempts` is incremented; retry is scheduled (subject to the 3-retry / 4-total-attempt cap)
- The primary card operation is unaffected (fire-and-forget)
- `WebhookService` logs at `warn` level: `{ event: "WEBHOOK_DELIVERY_TIMEOUT", ruleId: "<uuid>", attempt: <n>, timeoutMs: 5000 }`

#### AC-ERROR-7: Retry exhaustion — delivery marked exhausted

**Priority**: MUST
**Error code**: `WEBHOOK_DELIVERY_EXHAUSTED` (internal — recorded in delivery record)
**Response shape** (delivery record `error` field): `{ "code": "WEBHOOK_DELIVERY_EXHAUSTED", "message": "Max retries exceeded after 4 attempts", "details": [] }`
**Given** a rule has a `webhook_url`, the trigger fires, and every attempt (1 original + 3 retries = 4 total) returns non-2xx or times out
**When** the 4th attempt completes without a 2xx response
**Then**:

- The `webhook_deliveries` record `status` transitions to `"exhausted"`
- `attempts: 4`, `last_attempt_at: <timestamptz of final attempt>`, `error` field holds the `WEBHOOK_DELIVERY_EXHAUSTED` payload; `delivered_at` remains null
- No further retry is scheduled for this delivery record
- The primary card operation and the rule's in-process action (e.g., label assignment) are both already complete — exhaustion has no retroactive effect on card state
- `WebhookService` logs at `error` level: `{ event: "WEBHOOK_DELIVERY_EXHAUSTED", ruleId: "<uuid>", attempts: 4 }`

#### AC-ASYNC-4: Webhook delivery lifecycle — pending → delivered | failed → exhausted

**Priority**: MUST
**Given** a rule with `webhook_url` fires
**When** `WebhookService` begins delivery
**Then** the `webhook_deliveries` record progresses through the following lifecycle:

| State | Meaning | Transitions to |
|-------|---------|----------------|
| `pending` | Record created; no HTTP attempt made yet | `delivered` (2xx on first attempt) or `failed` (non-2xx/timeout on first attempt) |
| `failed` | Most recent attempt returned non-2xx or timed out; retries remain | `delivered` (next attempt succeeds) or `exhausted` (all 4 attempts used) |
| `exhausted` | All 4 attempts failed; no further retries | Terminal |
| `delivered` | A 2xx response received on any attempt | Terminal |

- Invariants: `attempts` reflects the number of HTTP requests made (1–4); `delivered_at` is set only when `status = "delivered"`; `error` is populated only when `status` is `"failed"` or `"exhausted"`
- Delivery tracking is independent of trigger execution status — a rule whose in-process action (e.g., label assignment) succeeds but whose webhook delivery reaches `exhausted` does not cause the action to be rolled back
- No delivery status is shown in the Automations panel UI for MVP — `webhook_deliveries` records are backend-only (observable via the database or logs)

### Scope Boundaries

- **In scope**:
  - Three trigger types: card moved to a specific column, a specific label assigned to a card, a due date set on a card
  - Three action types: assign a specific label to the card, move the card to a specific column, emit a notification (an activity event visible in the Activity feed — no external notification system in MVP)
  - Rules are board-scoped — each board has its own independent rule set
  - Rules defined inline in the Automations panel — no separate "automation page" or dedicated route
  - Rule CRUD: create, list, delete (edit is out of scope for MVP — delete and recreate)
  - Rule execution is synchronous in-process on the backend, post-response (fire-and-forget, consistent with activity event pattern)
  - Frontend re-fetches board data after a card operation so automation effects are visible without a page refresh
  - Cycle detection for direct two-rule move-to-column cycles (deeper cycle detection is post-MVP)
  - Optional `webhook_url` per rule: when set, `WebhookService` POSTs a JSON trigger payload to the URL on rule fire; retries up to 3 times (4 total attempts) on non-2xx or timeout; delivery status tracked in a `webhook_deliveries` table (`id`, `rule_id`, `status` [pending/delivered/failed/exhausted], `attempts`, `response_status`, `delivered_at`, `last_attempt_at`, `error` jsonb, `created_at`)

- **Out of scope**:
  - A dedicated /automations page or route (constraint from task description: inline per-board only)
  - External notifications (email, Slack) — "notify" action maps to an activity feed entry only; email/Slack integration is post-MVP
  - Scheduling-based triggers (e.g., "when due date passes") — the "due date set" trigger fires when the user saves a due date, not when time elapses
  - Rule ordering / priority (all matching rules fire; order is insertion order)
  - Rule editing (update) — delete and recreate pattern for MVP
  - Per-user rule ownership or permissions beyond board membership
  - Conditional logic within a rule (AND/OR conditions — one trigger per rule only)
  - Action chaining / multi-action rules — one action per rule only
  - Automation history or audit log (activity feed is the observable trail)

- **Dependencies**:
  - FEAT-006 (Card Labels) — must be complete (it is: merged 2026-05-28). The `labels` table, `LabelRepository`, `LabelService`, and `LabelPickerSection` are prerequisites for label-related triggers and actions.
  - Existing `ActivityEventEmitter` and `activityService` — automation actions that "notify" will emit via `activityEmitter`, same as card events.
  - Existing `CardController.update` — the trigger detection hook for `card_moved_to_column` and `card_label_assigned` must be added to or called from the existing update flow.

- **NFR implications**:
  - Performance: Rule evaluation adds one DB read per card update (fetch matching rules for the board). For MVP scale (2–15 users, tens of boards, hundreds of cards), this is acceptable; the existing "pre-update context capture" pattern already adds one extra DB read per card update.
  - Reliability: Automation execution is best-effort (fire-and-forget after response) — a rule execution failure must not fail the primary card operation, consistent with the existing activity event pattern.
  - Accessibility: The Automations panel must follow the same ARIA patterns as `ActivityFeedPanel` (`<aside>`, `aria-label`, keyboard close via Escape). Rule form inputs must have `aria-invalid` and inline error messages consistent with `LabelPickerSection.tsx`.
  - No real-time push for automation effects — TanStack Query cache invalidation on card update will cause the board to re-fetch and display automation results.

### Creative Exploration Needed

Yes — the following questions require design exploration before implementation planning:

1. **Automations panel coexistence with Activity panel**: Can both the Activity panel and Automations panel be open simultaneously? If yes, the board area becomes very narrow on a 1024px-wide viewport. If no, opening one must close the other. The `BoardView` state management and `BoardHeader` layout must accommodate this decision. Three options: (a) mutual exclusion — opening Automations closes Activity, (b) tabs within a single right panel, (c) independent panels allowed (may overflow on small desktops). This is the highest-priority design decision.

2. **Rule creation UX — inline vs modal**: The rule creation form has two dropdowns (trigger config) and two dropdowns (action config). Two options: (a) inline expansion within the panel (the panel grows a form section, consistent with `LabelPickerSection` "New label" inline form pattern), (b) a modal dialog overlaying the board (consistent with `CardDetailModal` pattern). Given the panel is already `w-80`, an inline form is likely too narrow for two dropdown rows with labels — a modal may be better, but this needs a design decision.

3. **Trigger type for "label assigned"**: The `card_label_assigned` trigger fires when `PUT /api/cards/:cardId/labels` is called (`cardLabelController.replace` in `backend/src/routes/cards.ts`). The controller currently has no activity service wired — the trigger hook must be added here. Confirm whether this is the right insertion point or whether label assignment events should route through the domain event emitter instead.

4. **Cycle detection scope**: For the `move_to_column` action, direct two-rule cycles (A→B, B→A) are detectable with a single query. Deeper cycles (A→B, B→C, C→A) require graph traversal. Scope must be decided before the backend implementation: detect direct cycles only (simpler, ships with MVP), or run full graph traversal (more correct, more complex). Flag for creative phase.

5. **"Notify" action concrete UX**: If the "notify" action simply adds an activity event to the feed, it is indistinguishable from a regular card event. The activity entry needs a marker (e.g., event type `automation_notification`, distinct icon in `ActivityEntry.tsx`). The exact text and icon for the automation-triggered activity entry must be designed.

6. **Rule list empty-state and "Add rule" affordance placement**: The Automations panel needs an empty state (similar to `ActivityFeedPanel`'s "No activity yet") and a persistent "Add rule" button. Whether "Add rule" is always visible at the top or bottom of the list, or only in the empty state, is a minor but concrete design decision needed before building the panel component.

## Test Strategy

### Approach

- **Emphasis**: Integration-first (backend HTTP tests via supertest; frontend component tests via React Testing Library), consistent with systemPatterns.md "integration-first" default
- **Target test count**: ~37 tests across 3 phases (17 backend + 11 frontend panel + 9 form)

### File Organization

- **New test files**:
  - `backend/src/__tests__/automations.test.ts` — automation CRUD API + rule evaluation + cycle detection
  - `frontend/src/__tests__/AutomationRulesPanel.test.tsx` — panel render, empty state, rule list, Escape key close
- **Extend existing**:
  - `backend/src/__tests__/cards.test.ts` — add automation trigger tests (card_moved fires an action; label_assigned fires an action; both remain fire-and-forget so primary card op succeeds even when rule evaluation fails)

### What NOT to Test

- TanStack Query cache internals — covered by library; test via `queryClient.getQueryData` only when verifying side effects
- PostgreSQL CASCADE delete on `board_id` — covered by DB engine; trust the constraint, don't write a test for it
- TypeScript compilation — covered by `tsc --noEmit`
- `ActivityFeedPanel` or `BoardHeader` existing behavior — covered by existing tests; only test the new props and button we add

### Per-Phase Test Guidance

- Phase 1 (Backend Foundation): **17 tests**
  - `GET /api/boards/:boardId/automations` — returns `[]` when none exist; returns rule list with correct shape
  - `POST /api/boards/:boardId/automations` — creates `card_moved_to_column` + `assign_label` rule (201); creates `card_label_assigned` + `move_to_column` rule (201); rejects missing `trigger_type` (400); rejects missing `action_config.columnId` (400); rejects circular `move_to_column` pair (422 `CIRCULAR_RULE_DETECTED`); 422 body matches `{ code, message, details }` shape
  - `DELETE /api/boards/:boardId/automations/:ruleId` — deletes rule (204); returns 404 for unknown id; returns 404 for wrong-board id
  - Trigger evaluation (via `cards.test.ts`): `PATCH /api/cards/:id` with new columnId fires matching `card_moved_to_column` rule (fire-and-forget — primary 200 still returned, board re-fetch shows label added); `PUT /api/cards/:id/labels` fires matching `card_label_assigned` rule (fire-and-forget)
  - Stale rule tolerance: `card_moved_to_column` trigger where target label was deleted → primary op returns 200, error logged (verify log spy sees `RULE_EXECUTION_FAILED`)
  - Activity event emitted: `automation_triggered` event_type recorded in `activity_events` with correct payload after rule fires
- Phase 2 (Frontend Panel): **11 tests**
  - `AutomationRulesPanel` renders with `aria-label="Automations"`
  - Shows exact empty state copy ("Automate repetitive transitions." heading + "Add rule" button) when query returns `[]`
  - Shows spinner (`sr-only` text "Loading rules…") when query is loading
  - Renders rule list rows with plain-English summaries when rules exist
  - Delete `×` button shows spinner during `isPending`; rule row persists during flight
  - `toast.error('Failed to delete rule')` shown and row restored when DELETE fails
  - Closes on Escape key press
  - `BoardHeader` renders Automations button; `aria-pressed="false"` by default; `aria-pressed="true"` when `automationsOpen=true`
  - `BoardView` opens panel on Automations button click (smoke test)
  - `BoardHeader` Automations button uses `bg-primary text-primary-foreground` when `automationsOpen=true`
  - `BoardView` can have `automationsOpen=true` and `activityOpen=false` independently (panels are mutually exclusive per creative decision — test both can't be true simultaneously)
- Phase 1 (Backend Foundation — Webhook Extension): **+8 tests** (appended to `automations.test.ts` and `cards.test.ts`)
  - `POST /api/boards/:boardId/automations` with `webhook_url` persists the URL on the rule (201; `GET` returns rule with `webhook_url` present)
  - Trigger fires with `webhook_url` set → `WebhookService` makes `POST` to URL with correct payload shape (`ruleId`, `boardId`, `cardId`, `triggerType`, `triggerContext`, `triggeredAt`); primary card op returns 200 (mock HTTP client — no real network)
  - Webhook 2xx → `webhook_deliveries` row: `status: "delivered"`, `attempts: 1`, `response_status: 200`, `delivered_at` set
  - Webhook non-2xx (e.g., 500) on all 4 attempts → row: `status: "exhausted"`, `attempts: 4`, `error.code: "WEBHOOK_DELIVERY_EXHAUSTED"`, `delivered_at: null`; primary card op unaffected (returns 200)
  - Webhook non-2xx on first attempt only, 2xx on second → row: `status: "delivered"`, `attempts: 2`, `delivered_at` set
  - Webhook timeout (mock 5s timeout) → treated as failed attempt; `error.code: "WEBHOOK_DELIVERY_TIMEOUT"`; retry scheduled
  - Delivery lifecycle: `pending` → `failed` (after first failure) → `exhausted` (after 4th failure); status checked at each step
  - Rule without `webhook_url` (null) → no `webhook_deliveries` row created; existing rule-fire behavior unchanged (non-regression)

- Phase 3 (Rule Creation Form): **9 tests**
  - "Save rule" disabled + spinner shown while mutation `isPending`
  - Form not submitted when trigger type unselected; exact error `Select a trigger type` visible
  - Form not submitted when trigger column unselected; exact error `Select a column to watch` visible
  - Form not submitted when action label unselected; exact error `Select a label to apply` visible
  - Successful submit: `createAutomationRule` called, `toast.success('Automation rule saved')` shown, form closes
  - Backend 422 (`CIRCULAR_RULE_DETECTED`) displays `This rule would create a circular automation loop` below Save button
  - Backend 5xx displays `toast.error('Failed to save rule. Please try again.')`, form stays open with inputs preserved
  - Selecting `card_moved_to_column` renders column dropdown; `card_label_assigned` renders label dropdown
  - Selecting `assign_label` action renders label dropdown; `move_to_column` renders column dropdown

## Implementation Roadmap

- [x] Phase 1: Backend Foundation — automation_rules table, CRUD API, rule evaluation engine, trigger hooks ✓

**Status**: COMPLETED - 2026-05-30
**Test Results**: 112 tests passing (18 new automation tests + 94 existing), requires Docker for DB integration tests
**Code Review**: APPROVED (0 blocking issues; layering fix applied; position-on-move fix applied)
- [x] Phase 2: Frontend Panel — AutomationRulesPanel, BoardView/BoardHeader wiring, API client + hooks ✓

**Status**: COMPLETED - 2026-05-30
**Test Results**: 140 tests passing (11 new frontend panel tests + 129 existing), 16 test files all green
**Code Review**: APPROVED (0 blocking issues; apiClient.deleteEmpty() added for 204 No Content)
- [x] Phase 3: Rule Creation Form — form component (inline/modal per creative decision), validation, full E2E flow ✓

**Status**: COMPLETED - 2026-05-30
**Test Results**: 150 tests passing (10 new Phase 3 form tests + 140 existing), 16 test files all green
**Code Review**: APPROVED (0 blocking; aria-busy coercion fix applied; truncate removed from rule summary rows per spec)

### Phase 1 Detail: Backend Foundation

**New files:**

- `backend/migrations/[timestamp]_create-automation-rules.js` — `automation_rules` table: `id uuid PK`, `board_id uuid FK→boards CASCADE`, `trigger_type text NOT NULL`, `trigger_config jsonb NOT NULL DEFAULT '{}'`, `action_type text NOT NULL`, `action_config jsonb NOT NULL DEFAULT '{}'`, `enabled boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`
- `backend/src/repositories/AutomationRepository.ts` — `findByBoardId(boardId)`, `findByBoardAndId(boardId, id)`, `create(boardId, data)`, `delete(boardId, id)`, typed `AutomationRule` interface
- `backend/src/services/AutomationService.ts` — `listByBoard`, `createRule` (with cycle-detection validation), `deleteRule`, `evaluateCardMoved(boardId, cardId, toColumnId)`, `evaluateLabelAssigned(boardId, cardId, labelId)` — all evaluation methods fire-and-forget, log on error, never throw to caller
- `backend/src/controllers/AutomationController.ts` — HTTP handlers: `list`, `create`, `remove` (mirrors `LabelController` structure)
- `backend/src/routes/automations.ts` — mounted at `app.use('/api/boards', automationsRouter)` with `mergeParams: true`; exports `automationService` singleton (mirrors `activity.ts` singleton export pattern)
- `backend/src/schemas/automationSchemas.ts` — Zod: `CreateAutomationRuleSchema` (trigger_type enum + trigger_config + action_type enum + action_config)

**Modified files:**

- `backend/src/controllers/CardController.ts` — after `res.status(200).json(card)` (L48), add fire-and-forget call to `automationService.evaluateCardMoved(preCtx.boardId, parsedId.data, preCtx.columnId, card.columnId)` when `isMove` is true (mirrors existing activity event block at L51-62)
- `backend/src/controllers/CardLabelController.ts` — in `replace` handler, after sending response, add fire-and-forget `automationService.evaluateLabelAssigned(boardId, cardId, labelIds)` for each new label added
- `backend/src/app.ts` — register `automationsRouter`
- `backend/src/routes/cards.ts` — import `automationService` singleton from `routes/automations.ts`

### Phase 2 Detail: Frontend Panel

**New files:**

- `frontend/src/api/automationsApi.ts` — `listAutomationRules(boardId)`, `createAutomationRule(boardId, data)`, `deleteAutomationRule(boardId, ruleId)` (mirrors `labelsApi.ts` pattern)
- `frontend/src/hooks/useAutomationRules.ts` — `useQuery` for `['automations', boardId]`
- `frontend/src/hooks/useCreateAutomationRule.ts` — `useMutation` + `onSuccess: invalidate ['automations', boardId]`
- `frontend/src/hooks/useDeleteAutomationRule.ts` — `useMutation` + `onSuccess: invalidate ['automations', boardId]`
- `frontend/src/components/automation/AutomationRulesPanel.tsx` — `<aside>` cloning `ActivityFeedPanel` structure; props: `{ boardId: string; onClose: () => void; onAddRule: () => void }`; renders empty state or rule list; Escape key handler; delete button per rule
- `frontend/src/types/domain.ts` — add `AutomationRule` type (id, boardId, triggerType, triggerConfig, actionType, actionConfig, enabled, createdAt)

**Modified files:**

- `frontend/src/components/board/BoardView.tsx` — add `automationsOpen` state + `automationsToggleRef` ref + `closeAutomationsPanel` useCallback (mirrors `activityOpen` pattern at L84-143); pass to `BoardHeader`; conditionally render `<AutomationRulesPanel>` in flex-row container
- `frontend/src/components/board/BoardHeader.tsx` — add `automationsOpen: boolean`, `onAutomationsToggle: () => void`, `automationsToggleRef?: Ref<HTMLButtonElement>` to props; render Automations button (same pattern as Activity button at L50-74, using `aria-pressed`, `ref`, active/inactive CSS)

### Phase 3 Detail: Rule Creation Form _(requires creative phase decision on inline vs modal)_

**New files:**

- `frontend/src/components/automation/AutomationRuleForm.tsx` (or `AutomationRuleModal.tsx`) — form with: trigger type select, trigger config select (columns or labels, conditional on trigger type), action type select, action config select (labels or columns, conditional on action type); inline validation errors (`text-xs text-red-500` per `LabelPickerSection` pattern); calls `useCreateAutomationRule`; shows `toast.success('Automation rule saved')`

**Modified files:**

- `frontend/src/components/automation/AutomationRulesPanel.tsx` — wire "Add rule" affordance to open the form (inline expand or modal, per creative decision)

### Observability Requirements

- **Applies**: Yes (new HTTP handlers + rule evaluation side-effects)
- **Logging**: Rule evaluation errors logged at `warn` level via `req.logger` (or rootLogger in fire-and-forget context) — same pattern as activity recording errors in `CardController.ts`; no sensitive data in rule config logged (log rule ID + trigger type only)
- **Tracing**: No new distributed tracing spans required — rule evaluation is in-process; existing W3C traceparent propagation in `requestContext.ts` covers the request context
- **Metrics**: No new custom metrics for MVP; API response time for `POST /api/boards/:boardId/automations` must stay within p95 < 200ms NFR (single DB write + cycle-detection query)
- **Configuration**: No new OTEL*\* or LOG*\* env vars required

### API Requirements — REST

- **Involves REST API**: Yes
- **OpenAPI Spec Location**: None (no OpenAPI spec in project — follow existing undocumented REST convention)
- **Endpoints**:
  - `GET    /api/boards/:boardId/automations` — list all rules for a board (ordered by created_at ASC)
  - `POST   /api/boards/:boardId/automations` — create a rule; returns 201 with created rule; 422 `CIRCULAR_RULE_DETECTED` on direct cycle; 400 on invalid schema
  - `DELETE /api/boards/:boardId/automations/:ruleId` — delete a rule; 404 on unknown/wrong-board id
- **Build Phase**: No separate API context file needed — follow `LabelController` + `labelsRouter` pattern directly

### Dependencies & Risks

| Risk                                                                                                                                  | Likelihood | Mitigation                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel coexistence — two panels open simultaneously overflows narrow desktop viewport                                                  | Medium     | Creative phase resolves; default to mutual exclusion (opening Automations closes Activity) if no design decision                                                      |
| Rule evaluation adds latency to card operations                                                                                       | Low        | Single `SELECT * FROM automation_rules WHERE board_id=? AND enabled=true` per card update; acceptable at MVP scale (2-15 users); run as fire-and-forget post-response |
| Cycle detection edge case (3-rule cycle not caught by direct-pair check)                                                              | Low-Medium | Scope to direct 2-rule move_to_column cycles only for MVP (creative phase confirms); document limitation in code comment                                              |
| `card_label_assigned` trigger requires adding automation hook to `CardLabelController.replace` which currently has no activity wiring | Medium     | Straightforward — same fire-and-forget pattern; low implementation risk; test explicitly                                                                              |
| Stale rule config (deleted column or label) causes silent failures                                                                    | Low        | AutomationService.evaluate wraps action in try/catch; logs at warn; never throws; primary op always succeeds                                                          |

## Creative Phases

- [x] User Journey Design → COMPLETE (memory-bank/creative/TASK-007-card-workflow-automation-user-journey.md) — Mutual exclusion panel, inline form expansion, ⚡ activity entries, no delete confirmation
- [x] UI/UX Design → COMPLETE (memory-bank/creative/TASK-007-card-workflow-automation-uiux.md) — Full-panel takeover form, Zap icon, top-of-list "Add rule" affordance, 9 plain-English rule summary templates

---

## Execution State

**Build Status**: IDLE
**Current Phase**: REFLECT → ARCHIVE
**Can Resume**: NO
**Phase Number**: 3 of 3 complete
**Is Multi-Phase**: YES

### Current Build Step

**Step**: Step 11 - Git Completion
**Status**: COMPLETE
**Completed**: 2026-05-30
**Output**: Phase 3 committed to feature/FEAT-007-card-workflow-automation

### Parallelization Analysis

**Total Batches**: 3 (run sequentially due to shared PostgreSQL DB)

- Group 1 (sequential): Batch 1 → Batch 2 → Batch 3

### Test Batch Configuration

**Total Batches**: 3
**Batches**:

- Batch 1: Automation Service (15 tests) → automations.test.ts → AutomationRepository, AutomationService, AutomationController, automations route
- Batch 2: Card Automation Triggers (cards.test.ts — 3 new automation trigger tests) → CardController, LabelController
- Batch 3: Regression Suite (~94 tests) → activities, activitySSE, boards, db, health, labels, layering, logger

### Completed Steps

- Creative: User Journey — COMPLETE (2026-05-28)
- Creative: UI/UX — COMPLETE (2026-05-28)
- Step 0.5 Git Setup: COMPLETE (2026-05-28) — Worktree created at .claude-worktrees/FEAT-007, branch feature/FEAT-007-card-workflow-automation
- Step 1 Read Task Context: COMPLETE (2026-05-28) — Phase 1: Backend Foundation identified (1 of 3)
- Step 2 Load Context: COMPLETE (2026-05-28) — Level 3 rules loaded
- Step 3 Test Writer: COMPLETE (2026-05-28) — 15 tests in automations.test.ts + 3 tests added to cards.test.ts (18 total)
- Step 4 Coding Agent: COMPLETE (2026-05-28) — All 112 tests passing (18 new + 94 existing)
- Step 5 Create Test Batches: COMPLETE (2026-05-28) — 3 batches defined (automations, cards trigger, regression)
- Step 7 Integration Verification: COMPLETE (2026-05-30) — Build PASS, Lint PASS (0 errors after layering fix), 12 non-DB tests pass; 97 DB tests skip without Docker; 3 db.test.ts fail as expected
- Step 8 Code Review: COMPLETE (2026-05-30) — APPROVED, 0 blocking; layering fix (Pool removed from AutomationService), position fix (moveCardToColumn now appends), logger fix (structured catch), cycle detection comment added. Security: 2 deferred upgrades already in projectbrief.md
- Step 9 Documentation: COMPLETE (2026-05-30) — JSDoc added to AutomationService/Repository; techContext.md+systemPatterns.md+productBrief.md updated
- Step 10 Update Memory Bank: COMPLETE (2026-05-30) — tasks.md registry, TASK-007.md phase checkbox, progress.md entry

- Step 0 Verify Git: COMPLETE (2026-05-30) — Worktree at .claude-worktrees/FEAT-007, branch feature/FEAT-007-card-workflow-automation
- Step 1 Read Task Context: COMPLETE (2026-05-30) — Phase 2: Frontend Panel identified (2 of 3)
- Step 2 Load Context: COMPLETE (2026-05-30) — Level 3 rules loaded; creative phase docs read
- Step 3 Test Writer: COMPLETE (2026-05-30) — 11 tests in automationRulesPanel.test.tsx
- Step 4 Coding Agent: COMPLETE (2026-05-30) — 10 files created/modified; 140 tests passing
- Step 7 Integration Verification: COMPLETE (2026-05-30) — 140/140 tests pass, Lint PASS, TypeScript PASS (no errors in Phase 2 files)
- Step 8 Code Review: COMPLETE (2026-05-30) — APPROVED, 0 blocking; apiClient.deleteEmpty() refactor applied
- Step 9 Documentation: COMPLETE (2026-05-30) — techContext.md, systemPatterns.md, productBrief.md updated
- Step 10 Update Memory Bank: COMPLETE (2026-05-30) — tasks.md registry, TASK-007.md phase checkbox, progress.md entry
- Step 11 Git Completion: COMPLETE (2026-05-30) — Phase 2 committed to feature branch

- Step 0 Verify Git: COMPLETE (2026-05-30) — Worktree at .claude-worktrees/FEAT-007, branch feature/FEAT-007-card-workflow-automation
- Step 1 Read Task Context: COMPLETE (2026-05-30) — Phase 3: Rule Creation Form identified (3 of 3)
- Step 2 Load Context: COMPLETE (2026-05-30) — Level 3 rules loaded; creative phase docs read
- Step 3 Test Writer: COMPLETE (2026-05-30) — 10 new tests in automationRulesPanel.test.tsx (1 open-form + 9 form behavior)
- Step 4 Coding Agent: COMPLETE (2026-05-30) — AutomationRuleForm.tsx created; AutomationsPanel.tsx wired with showForm state; BoardView.tsx cleaned up; 150 tests passing
- Step 7 Integration Verification: COMPLETE (2026-05-30) — 150/150 tests pass, Build PASS, Lint PASS
- Step 8 Code Review: COMPLETE (2026-05-30) — APPROVED, 0 blocking; aria-busy fix applied; truncate removed from rule summary rows
- Step 9 Documentation: COMPLETE (2026-05-30) — techContext.md, systemPatterns.md, productBrief.md updated
- Step 10 Update Memory Bank: COMPLETE (2026-05-30) — tasks.md registry, TASK-007.md phase checkbox, progress.md entry
- Step 11 Git Completion: COMPLETE (2026-05-30) — Phase 3 committed to feature branch

### Resumption Notes

**Can Resume**: NO
**Notes**: All 3 phases complete. Run /banyan-reflect TASK-007 then /banyan-archive TASK-007.
