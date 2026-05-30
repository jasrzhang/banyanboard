# User Journey Design: Card Workflow Automation

**Created**: 2026-05-28
**Status**: DECIDED
**Decision Type**: User Journey
**Task**: TASK-007 (FEAT-007)

## Journey Overview

**Feature**: Inline per-board trigger/action rules that automate repetitive card state transitions (move to column, label assigned, due date set → assign label, move to column, notify).
**Primary Persona**: Team Lead (engineering or product lead) — reduces manual housekeeping on the board.
**Journey Type**: Hybrid — Synchronous (rule create/delete is form → 2xx → UI update) with asynchronous fire-and-forget rule execution (trigger fires post-response, surfaces on next board re-fetch).
**Orchestration Pattern**: **Dashboard + Detail in a side panel** — the Automations panel is a persistent "browse rules" surface; rule creation uses **Progressive Disclosure** via an inline expanded form within the panel header area (not a separate modal).

### Success Statement
> Team Lead clicks "Automations" in the board header, clicks "+ Add rule", picks a trigger and an action from two pairs of dropdowns, clicks "Save rule", and immediately sees the rule listed in plain English — so the next time anyone moves a matching card, the action fires automatically and the board reflects it without a refresh.

## Persona Context

### Primary User
- **Who**: Team Lead — engineering or product lead managing a small team's Kanban board
- **Goal**: Stop manually relabeling/moving cards every time a teammate finishes work; reduce daily-standup busywork; keep the board's data hygiene high without nagging the team
- **Context**: Mid-week board grooming session, or a one-off "let me set this up while I'm thinking about it" moment after observing the same manual cleanup three times in a row
- **Proficiency**: Comfortable with Kanban tooling (Linear, Trello, Jira). Has a clear mental model of "if this, then that" from IFTTT, Zapier, or GitHub Actions. Expects discoverable UI in the board header — not a separate "settings" page

### Secondary Users
- **Who**: Team Member (individual contributor) — does not create rules but lives inside their effects daily
- **Different needs**: Must be able to **see** that an automation fired on their card (clear marker in the Activity feed) and must not be surprised by silent state changes. Their journey is "I moved a card → I notice a label appeared → I look at Activity → I see ⚡ automation entry → I understand"

### Tertiary User
- **Who**: Self-hoster / DevOps — operates the deployment
- **Different needs**: Not in this journey. They notice automations only via log lines (`RULE_EXECUTION_FAILED` warnings) — out of scope here.

## Journey Map

### Entry Points
| Entry | Context | User Intent |
|-------|---------|-------------|
| **"Automations" button in BoardHeader** | Always visible on the board's top-right control row, between "Activity" and "New Card" | Open the panel to view existing rules, add a new rule, or delete a rule |
| **(Indirect) Activity Feed ⚡ entry** | A `automation_triggered` entry in the Activity panel — clicking it does **not** navigate anywhere in MVP | Awareness only — confirms an automation fired |

There is **no** dedicated route, no settings page, and no keyboard shortcut in MVP. The button in the header is the only entry point.

### State Diagram

```
[Entry: User clicks "Automations" button in BoardHeader]
    │
    │ (aria-pressed flips true; Activity panel auto-closes if open — see Decision 1)
    ▼
[Panel Open: Automations <aside w-80>]
    │
    ├─── empty rules? ─── yes ──▶ [Empty State: heading + sub-text + "+ Add rule" CTA]
    │                              │
    └─── no ──▶ [Rule List: rows, each "When X → Do Y" with × button + "+ Add rule" at TOP of list]
                                   │
                                   ▼
                       [User clicks "+ Add rule"]
                                   │
                                   ▼
                   [Inline Form Expand: trigger select + trigger config + action select + action config + Save/Cancel]
                                   │
                                   ├──[Cancel] ──▶ Form collapses, list/empty state restored
                                   │
                                   ├──[Invalid submit] ──▶ Inline field errors (no network); form stays open
                                   │
                                   ▼
                       [POST /api/boards/:id/automations]
                                   │
                                   ├──[5xx error] ──▶ toast.error; form stays open with selections preserved
                                   ├──[422 circular] ──▶ inline form-level error; selections preserved
                                   │
                                   ▼
                       [201 Created]
                                   │
                                   ▼
                       [Form collapses; new row appears at top of list; toast.success "Automation rule saved"]
                                   │
                                   ▼ (background, async — possibly weeks later)
                       [SOMEONE moves/labels a matching card]
                                   │
                                   ▼
                       [PATCH /api/cards/:id returns 200; fire-and-forget rule eval fires action]
                                   │
                                   ▼
                       [TanStack Query invalidates ['board', boardId]; board re-fetches]
                                   │
                                   ▼
                       [Board UI re-renders with action applied (label chip / new column); ⚡ entry appears in Activity feed]
                                   │
                                   ▼
                       [Success: Automation has paid off — value delivered]

[Rule Deletion path:]
[User clicks × on a rule row in panel]
    │
    ▼
[× replaced by inline spinner; row stays in list — pessimistic UI]
    │
    ├──[DELETE returns 204] ──▶ row removed from list (no toast — quiet success)
    │
    └──[DELETE fails] ──▶ spinner reverts to ×; row stays; toast.error "Failed to delete rule"
```

### Step-by-Step Journey

#### Step 1: Discover & Open
- **System**: Frontend (`BoardHeader.tsx`, `BoardView.tsx`)
- **User Sees**: Top-right of the board header now shows four controls in order: Search | Filters | Activity | **Automations** | New Card. The Automations button uses the same inactive-pill styling as Activity (`bg-nav-hover text-text-secondary hover:bg-border`) and a lightning-bolt icon (⚡-style SVG, `h-3.5 w-3.5`) followed by the label "Automations"
- **User Actions**: Click the button (mouse), or `Tab` to it and press `Enter`/`Space` (keyboard)
- **Feedback**: Button gains `aria-pressed="true"` and switches to `bg-primary text-primary-foreground` active styling. A `w-80` `<aside aria-label="Automations">` slides in to the right of the kanban columns (instant conditional render — no animation, matching `ActivityFeedPanel`). If the Activity panel was open, it closes simultaneously (see **Decision 1: mutual exclusion**)
- **Transitions**: Opens to either Step 2a (empty state) or Step 2b (rule list)
- **Data Flow**: `useAutomationRules(boardId)` starts; query key `['automations', boardId]`. While in-flight, panel body shows a centered spinner with `<span className="sr-only">Loading rules…</span>`

#### Step 2a: Empty State (first-time experience)
- **System**: Frontend (`AutomationRulesPanel.tsx`)
- **User Sees**: Panel header reads "Automations" with a × close button (mirrors ActivityFeedPanel header exactly). Below the header, a vertically-centered empty state:
  - Heading (large, bold): **"Automate repetitive transitions."**
  - Sub-text (smaller, secondary): **"When a card moves to Done, apply the Shipped label — automatically."**
  - Primary CTA button: **"+ Add rule"** (same `bg-primary text-primary-foreground` style as `CardDetailModal` save button)
- **User Actions**: Click "+ Add rule" → Step 3. Or click × / press Escape → panel closes
- **Feedback**: Hover state on the button (`hover:bg-primary-hover`)
- **Transitions**: → Step 3 (form expand)
- **Data Flow**: No additional fetch; query has resolved with `[]`

#### Step 2b: Rule List (returning experience)
- **System**: Frontend (`AutomationRulesPanel.tsx`)
- **User Sees**: Panel header. Immediately below: a sticky **"+ Add rule"** button (full-width, secondary style — `bg-surface-card border border-border hover:bg-nav-hover text-sm py-2`). Below that, a scrollable `<ol>` of rule rows, ordered by `created_at ASC` (oldest first). Each row contains:
  - Plain-English summary in two lines:
    - Line 1 (medium weight): `When card moves to Done`
    - Line 2 (medium weight): `→ Apply label Shipped`
  - On the right: a × button (text icon, `text-text-secondary hover:text-text-primary`) for deletion. No edit affordance (out of scope for MVP)
- **User Actions**: Click "+ Add rule" → Step 3. Click × on any row → Step 6 (delete). Click × in panel header / Escape → close panel
- **Feedback**: Row hover slightly tints `bg-nav-hover` for affordance
- **Transitions**: → Step 3 (add) or Step 6 (delete)
- **Data Flow**: Rule rows hydrate from cache; labels and columns referenced in summaries are resolved by `useBoard` + `useLabels` (already loaded) — no extra fetch

#### Step 3: Add Rule — Form Expand (Progressive Disclosure)
- **System**: Frontend (`AutomationRulesPanel.tsx` — inline expansion, not a modal)
- **User Sees**: The "+ Add rule" button collapses; in its place, a **vertical** inline form fills the panel body (still inside the `w-80` panel — vertical stack chosen because horizontal pairs of dropdowns don't fit at 320px). Form fields:
  1. **"When..."** section header (small caps `text-xs uppercase tracking-wide text-text-disabled`)
  2. **Trigger type** `<select>`: "Choose…", "A card moves to a column", "A label is assigned to a card", "A due date is set on a card"
  3. **Trigger config** (conditional): if trigger = moves-to-column, show **"Column"** `<select>` populated from `board.columns`. If trigger = label-assigned, show **"Label"** `<select>` populated from `useLabels(boardId)`. If trigger = due-date-set, no additional config (entire-board scope)
  4. **"Then..."** section header
  5. **Action type** `<select>`: "Choose…", "Apply a label", "Move to a column", "Add a note to Activity feed"
  6. **Action config** (conditional): if action = apply-label, show **"Label"** `<select>`. If action = move-to-column, show **"Column"** `<select>`. If action = notify, no config
  7. Form-level error region (initially empty, used for 422 `CIRCULAR_RULE_DETECTED`)
  8. Buttons row: **"Save rule"** (primary) + **"Cancel"** (text button on the left)
- **User Actions**: Make selections; tab between fields with proper focus management; click "Save rule" or "Cancel"; press Escape to cancel (closes form, not the whole panel — match modal convention)
- **Feedback**: Conditional fields appear smoothly on trigger/action type change (re-render). Required-field hints appear only on submit (no nagging-as-you-type). Invalid submit shows red inline errors below each missing field with `text-xs text-red-500`
- **Transitions**: Cancel → Step 2 restore. Valid submit → Step 4. Invalid submit → stays on Step 3 with errors
- **Data Flow**: Form-local React state (uncontrolled or `useState`); no global state. Trigger config and action config dropdowns read from already-cached board + labels queries — no new fetch

#### Step 4: Save Rule — Server Round-Trip
- **System**: Frontend → API (`POST /api/boards/:boardId/automations`) → AutomationService → AutomationRepository → PostgreSQL
- **User Sees**: "Save rule" button becomes `disabled`, label replaced by a spinner (same pattern as `CardDetailModal` save). Form fields remain visible but no second submit possible. The rest of the panel and board are interactive (non-blocking)
- **User Actions**: Wait. Can press Escape to attempt cancel, but the request is in flight — Cancel button is also disabled during pending state
- **Feedback**: Spinner on Save button
- **Transitions**:
  - **201 Created** → Step 5 (success)
  - **422 `CIRCULAR_RULE_DETECTED`** → stays on Step 3, inline form-level error displays "This rule would create a circular automation loop" below the Save button (`text-sm text-red-600`); selections preserved; user adjusts and re-submits
  - **400 validation** → should not happen (client-side validation gates this), but if it does, toast.error and form stays open
  - **5xx / network** → toast.error "Failed to save rule. Please try again.", form stays open with selections preserved (no reset)
- **Data Flow**: Mutation via `useCreateAutomationRule`; on success `invalidate(['automations', boardId])` so list re-renders with the new row

#### Step 5: Save Success
- **System**: Frontend (`AutomationRulesPanel.tsx`)
- **User Sees**: Form collapses. The rule list reappears with the new rule at the top (or at its `created_at ASC` position — for a fresh save, that's the most recent, which is the bottom; design choice: **scroll the list to bring the new row into view** and gently flash its background `bg-emerald-50 transition-colors duration-700` for 1.5s to confirm). A toast in the bottom-right corner reads **"Automation rule saved"** (exact string), styled `toast.success` (matching `CardDetailModal` patterns)
- **User Actions**: Can click "+ Add rule" again to create another. Or click × on any row to delete. Or close panel
- **Value Delivered**: Rule is **active** immediately — the next matching event on any card will fire it
- **Next Actions**: User typically tests the rule by manually moving a card or assigning a label. This is implicit, not prompted — no "test rule" affordance in MVP

#### Step 6: Delete Rule
- **System**: Frontend → API (`DELETE /api/boards/:boardId/automations/:ruleId`)
- **User Sees**: User clicks × on a rule row. **No confirmation dialog** (per Decision 4 below). The × instantly becomes an inline spinner (same SVG-spin pattern as ActivityFeedPanel "Reconnecting…"). The rule row stays in place (pessimistic — not optimistic — because the action is destructive and we want certainty)
- **User Actions**: Wait. Cannot click × again (already disabled / spinner)
- **Feedback**: Spinner visible on that row only — other rows fully interactive
- **Transitions**:
  - **204 No Content** → row fades out (1 frame) and is removed. **No toast on success** (quiet success — matches AC-HAPPY-4)
  - **Error (4xx/5xx/network)** → spinner reverts to ×, row stays, toast.error **"Failed to delete rule"** (exact string per AC-ERROR-4)
- **Data Flow**: Mutation via `useDeleteAutomationRule`; on success `invalidate(['automations', boardId])`

#### Step 7: Rule Fires — Async Effect (the payoff)
- **System**: Backend (`CardController.updateCard` / `CardLabelController.replace`) → fire-and-forget `automationService.evaluateCardMoved(...)` or `evaluateLabelAssigned(...)` → action executor → DB writes → `activityEmitter.emit('automation_triggered', ...)`
- **User Sees** (Team Member who triggered it, OR Team Lead watching):
  - Their card mutation returns 200 immediately
  - On the next TanStack Query re-fetch of `['board', boardId]` (triggered by the mutation's `onSettled`), the board re-renders **with the automation applied**: e.g., a label chip appears on the just-moved card, or the card hops to a new column
  - If they have the Activity panel open (or open it later), they see a new entry at the top: **`⚡ Fix login bug — label Shipped applied (automated)`** — see Decision 3 below for exact format
- **User Actions**: None required — the automation is observed, not interacted with. The user can open Activity to confirm the trigger fired (introspection path)
- **Feedback**: The board state change IS the feedback. The Activity entry is the audit trail
- **Transitions**: Journey complete; user resumes whatever they were doing
- **Data Flow**: All async, fire-and-forget on backend. Frontend learns of the change only via re-fetch. **No websocket, no SSE for automation effects** (out of scope; AC-ASYNC-3 documents this is acceptable for MVP)

## Async Handling

### Operation Lifecycle
| Phase | Duration | User Experience |
|-------|----------|-----------------|
| Rule create (sync) | < 200ms typical | Save button spinner; form locked; immediate success/error feedback |
| Rule delete (sync) | < 200ms typical | × replaced by spinner; row stays in flight; row removed on 204 |
| Rule fire (async) | < 200ms after card op (localhost) | Card op returns 200 immediately; board re-fetch ~50-200ms later shows automation effect |
| Activity entry from rule fire | < 200ms after action executes | New ⚡ row appears in Activity feed if panel open (or next time it's opened) |

### Progress Communication
- **Rule creation/deletion**: Synchronous — direct request → response → UI update
- **Rule firing**: Asynchronous, polling-via-react-query — TanStack Query invalidation in card mutation's `onSettled` triggers re-fetch, which surfaces the automation effect
- **Method**: HTTP request/response for CRUD; **no real-time push** for rule fires (out of scope per task spec)
- **Frequency**: One re-fetch per card operation. If a user is on the board and never interacts (e.g., watching another team member's actions), they will not see automation effects until they do something. **This is an acceptable trade-off for MVP** — the Activity feed (which already polls) gives a 30s-ish view into automation activity
- **Persistence**: Activity feed is the persistent record. The `automation_rules` table is the source of truth for which rules exist. Action effects (labels, column changes) are persisted on the cards themselves

## Distributed System Flow

### System Boundaries
```
[React Frontend]
   │
   │ HTTP POST /api/boards/:id/automations    HTTP DELETE /api/boards/:id/automations/:id
   │ HTTP GET  /api/boards/:id/automations    HTTP PATCH /api/cards/:id (triggers eval)
   ▼
[Express Backend]
   │   AutomationController → AutomationService → AutomationRepository → PostgreSQL
   │   CardController → CardService → CardRepository → PostgreSQL
   │                  └── (fire-and-forget) automationService.evaluateCardMoved(...)
   │                                                │
   │                                                ▼
   │                            AutomationService.evaluateCardMoved
   │                                                │
   │                                                ├─ Action: apply label → LabelRepository.attach → DB
   │                                                ├─ Action: move column → CardRepository.update → DB
   │                                                └─ Action: notify → activityEmitter.emit('automation_triggered')
   │                                                                       │
   │                                                                       ▼
   │                                                       ActivityService.recordEvent (DB write + SSE broadcast)
   │
   │ (Activity SSE — already wired) ──────────────────────────────────────▶
   ▼
[React Frontend] ◀── (Activity panel receives ⚡ entry via SSE)
                ◀── (Board re-fetch on mutation onSettled — shows action effect)
```

### Responsibility Matrix
| Step | Owner | State Storage | Failure Handling |
|------|-------|---------------|------------------|
| 1. Open panel | Frontend | React state (`automationsOpen`); ref to button for focus restore | N/A |
| 2. List rules | API → DB | `automation_rules` table | Query error → panel-level error region; retry via TanStack |
| 3. Create rule (form) | Frontend | React form state (local) | Validation errors inline |
| 4. POST rule | API → DB (atomic INSERT) | Same table | 422 cycle → inline; 5xx → toast.error + form preserved |
| 5. List re-renders | Frontend | TanStack cache | Invalidation triggers refetch |
| 6. DELETE rule | API → DB (atomic DELETE) | Same table | 4xx/5xx → spinner reverts; toast.error |
| 7. Rule fire | Backend (fire-and-forget post-response) | Card / labels / activity tables | Try/catch; logs `RULE_EXECUTION_FAILED` at `warn`; never throws; user-invisible |
| 8. Effect visible | Frontend (TanStack Query refetch on card op `onSettled`) | TanStack cache | If re-fetch races eval, effect appears on next interaction — acceptable per AC-ASYNC-3 |

## Error Handling

### Error States
| Error Type | When | User Sees | Recovery |
|------------|------|-----------|----------|
| **Validation (client)** | Save clicked with missing fields | Inline `text-xs text-red-500` below each missing field with exact message from AC-ERROR-1 | Fill the missing fields; click Save again |
| **Circular rule (422)** | POST returns 422 `CIRCULAR_RULE_DETECTED` | Form-level inline error "This rule would create a circular automation loop" (`text-sm text-red-600`) below Save button; selections preserved | Change a trigger or action selection; resubmit. Or cancel and rethink the rule pair |
| **Server error (5xx) / network** | POST fails | `toast.error('Failed to save rule. Please try again.')`; form stays open with all selections | Retry by clicking Save again. Or cancel |
| **Delete fails** | DELETE non-204 | Spinner reverts to ×; row stays; `toast.error('Failed to delete rule')` | Try × again |
| **Stale rule reference** | Rule fires but referenced label/column was deleted | **User sees nothing** — automation silently skipped. Logged at `warn` server-side | None needed; user can manually delete the dead rule if they notice it in the list |
| **List query fails** | Panel open, GET fails | Inline error region inside panel body: "Couldn't load rules. Retry" with a Retry link | Click Retry → refetch |

### Partial Failure
- **Scenario A — One rule of three fires successfully, two fail with stale references**
  - **User Experience**: Card op returns 200. Board re-fetch shows only the action from the working rule. Activity feed gets one ⚡ entry. The two failed rules log warnings but are invisible to the user
  - **Recovery**: No prompted recovery. Team Lead may notice "I thought Rule X should have fired" → opens panel → sees the rule exists but doesn't realize its target column was renamed/deleted. Acceptable for MVP; could add a "broken rule" badge post-MVP
- **Scenario B — Action chain pseudo-collision: Rule A moves card to column Done; Rule B (trigger: card_moved_to_column Done) then applies label Shipped**
  - **User Experience**: This is **expected cascading behavior** and works correctly — moving card to Done fires Rule A (no-op in this case if already in Done), and the original move also matches Rule B's trigger so the label gets applied. Both effects visible on next re-fetch
  - **Note**: For MVP we don't re-trigger on automation-applied moves (to avoid infinite loops). Only **user-initiated** card events trigger evaluation. This is implicit in the backend design — rule evaluator is called from controllers, not from action executors

## Options Explored

### Option 1: Mutually Exclusive Panels + Inline Form Expand (CHOSEN)
- **Orchestration**: Dashboard + Detail (panel = browse) with Progressive Disclosure (form expands inline within panel)
- **Flow Summary**: Opening the Automations panel auto-closes the Activity panel (and vice versa). Inside the Automations panel, "+ Add rule" expands a vertical form in-place; Save collapses it back to the list
- **Wireframe**:
  ```
  ┌───────────────────────────────────────────────────────────────┐
  │  Board Name        🔍  Filters   [Activity] [⚡ Automations*] [+ New Card]
  ├───────────────────────────────────────────────────────────────┤
  │  Kanban columns flex-1                       │ Automations  × │
  │  ┌──────┐ ┌──────┐ ┌──────┐                  │────────────────│
  │  │To Do │ │ WIP  │ │ Done │                  │ [+ Add rule  ] │
  │  │      │ │      │ │      │                  │────────────────│
  │  │ Card │ │ Card │ │ Card │                  │ When card      │
  │  │ Card │ │      │ │      │                  │  moves to Done │
  │  │      │ │      │ │      │                  │  → Apply       │
  │  └──────┘ └──────┘ └──────┘                  │     label      │
  │                                              │     Shipped × │
  │                                              │────────────────│
  │                                              │ When label     │
  │                                              │  Bug assigned  │
  │                                              │  → Move to     │
  │                                              │     Triage  × │
  └───────────────────────────────────────────────────────────────┘
                                          w-80 (320px) right panel
  ```
  **With form expanded:**
  ```
  │ Automations            × │
  │──────────────────────────│
  │ WHEN                     │
  │ [A card moves to ▾]      │
  │ [Done                ▾]  │
  │                          │
  │ THEN                     │
  │ [Apply a label       ▾]  │
  │ [Shipped             ▾]  │
  │                          │
  │      [Cancel] [Save rule]│
  │──────────────────────────│
  │ (existing rules below)   │
  ```
- **Pros**:
  - Matches existing `activityOpen` pattern exactly — minimum new code
  - Mutual exclusion avoids the "narrow board area" problem on 1024px viewports (both panels open = `1024 - 80 - 80 - 320 - 320 = 224px` of board area — unusable)
  - Inline form keeps user in context; no modal context-switch; no z-index war with future overlays
  - "Add rule" button always at top of list (with empty state replacing it when no rules) — single source of "create new"
  - No confirmation dialog on delete — fast workflow, with toast.error recovery on rare failure
- **Cons**:
  - Cannot view Activity and Automations side-by-side — if a user wants to see "did my rule fire? let me check Activity" they must toggle between panels. **Mitigation**: the board re-fetch already shows the effect; Activity is a confirmation step, not a primary workflow
  - Vertical form in `w-80` is somewhat tall (~360px when both conditional configs visible) — may push existing rule list below the fold. **Mitigation**: scroll within panel body
- **Best For**: Team Leads who set up rules in bursts then go back to actual work. Discoverable, low-friction, consistent
- **Friction Points**:
  - First-time user might not immediately grasp the "trigger → action" mental model — empty state copy mitigates this with a concrete example
  - Auto-closing the Activity panel might surprise users who had it open intentionally. **Mitigation**: this is a minor delight loss for a major layout win

### Option 2: Single Right Panel with Tabs (Activity | Automations)
- **Orchestration**: Tabbed dashboard in one shared `w-80` panel
- **Flow Summary**: One right panel; user toggles via two header buttons OR a top tab strip ("Activity / Automations"). Rule creation still uses inline form expand within the Automations tab
- **Wireframe**:
  ```
  │ [Activity | Automations]× │   ← tab strip in panel header
  │─────────────────────────  │
  │ (selected tab content)    │
  ```
- **Pros**:
  - Solves coexistence elegantly — only one panel ever, no width contention
  - Tab pattern is familiar from Linear, Notion
  - State of each tab preserved (form-in-progress doesn't get blown away by switching to Activity)
- **Cons**:
  - **Breaks the existing BoardHeader button pattern** — the "Activity" button currently lives in the header. Either we move it into the panel as a tab (regression in discoverability for Activity), or we keep both header buttons AND tabs (visual redundancy)
  - Adds a new UI pattern (tabbed panel) not used elsewhere in the app — inconsistent with established patterns
  - More implementation surface area: tab state, focus management between tabs, ARIA roles for tab list
- **Best For**: Apps where right-panel real estate is the dominant pattern (Notion, Figma). **Doesn't fit** an app where the panel is a side feature
- **Friction Points**: Migration cost — existing users of Activity panel encounter a different shape. Discoverability loss for "Automations" if buried inside an already-niche Activity panel

### Option 3: Independent Coexisting Panels (Both Open at Once)
- **Orchestration**: Dashboard + Detail (two parallel panels)
- **Flow Summary**: Activity and Automations panels are fully independent; opening one does NOT close the other; both can coexist
- **Wireframe**:
  ```
  ┌────────────────────┬─────────┬────────────┬────────────┐
  │ Sidebar    Board   │  Cols   │  Activity  │ Automations│
  │             cols   │ filt'd  │   w-80     │    w-80    │
  └────────────────────┴─────────┴────────────┴────────────┘
        ~224px usable kanban area at 1024px (unusable)
  ```
- **Pros**:
  - Maximum user freedom — they decide what to see
  - No surprise auto-close behavior
  - Easy to implement (literally remove the mutual exclusion)
- **Cons**:
  - **Breaks the kanban experience at 1024px viewport** (our smallest supported desktop width per productBrief.md "Desktop ≥1024px")
  - Forces a horizontal scroll inside the columns area, defeating the purpose of having two panels visible
  - No mobile fallback — though mobile is post-MVP, the desktop minimum is a hard constraint
- **Best For**: 1440px+ ultrawide users. **Doesn't fit** the MVP user base
- **Friction Points**: Severe layout breakage on the supported minimum viewport

### Option 4: Rule Creation in a Modal Dialog (instead of inline expand)
- **Orchestration**: Modal/Dialog for create flow, panel for list
- **Flow Summary**: Panel shows list. "+ Add rule" opens a centered `<dialog>` modal (like `CardDetailModal`) with horizontal layout (more breathing room)
- **Wireframe**:
  ```
  ┌────── New automation rule ──────────────────────────┐
  │                                                     │
  │  When a card...                                     │
  │  [Moves to a column ▾] [Done ▾]                     │
  │                                                     │
  │  Then automatically...                              │
  │  [Apply a label    ▾] [Shipped ▾]                   │
  │                                                     │
  │                          [Cancel]   [Save rule]     │
  └─────────────────────────────────────────────────────┘
  ```
- **Pros**:
  - More horizontal real estate for the form — labels and selects side-by-side feels less cramped
  - Modal pattern already established (`CardDetailModal`)
  - Strong focus trap (modals natively block underlying interaction)
- **Cons**:
  - **Loses panel context** — the modal hides the existing rule list, so users creating their second rule can't reference the first for inspiration
  - Two competing overlays (panel + modal) feels heavy for a simple two-dropdown form
  - Modal close conventions (Escape, click-outside) collide with panel close conventions
  - More cognitive context-switches per rule
- **Best For**: Forms with > 5 fields or destructive confirmations. Overkill for trigger + config + action + config (4 fields)
- **Friction Points**: Users creating multiple rules in a row context-switch back and forth between modal and panel

## Evaluation Matrix

| Criterion | Option 1 (Mutex + Inline) **CHOSEN** | Option 2 (Tabs) | Option 3 (Coexist) | Option 4 (Modal) |
|-----------|-----|------|----|-----|
| Discoverability | **H** | M | H | H |
| Learnability | **H** (familiar Activity pattern) | M (new tab pattern) | H | H |
| Efficiency | **H** (one click → form) | M (two clicks: open + tab) | H | M (extra modal step) |
| Error Prevention | M | M | M | M |
| Error Recovery | **H** (inline errors stay in context) | H | H | M (modal hides rule list during cycle error) |
| Consistency | **H** (mirrors Activity pattern) | L (new tabs UI) | H | M (mixes panel + modal) |
| Accessibility | **H** (single focus context) | M (tab role complexity) | H | M (modal + panel focus contention) |
| Layout safety @1024px | **H** | H | **L (fails)** | H |
| Implementation simplicity | **H** | L | H | M |

## Decision

**Chosen**: **Option 1 — Mutually Exclusive Panels + Inline Form Expand (Progressive Disclosure)**

### Rationale

1. **Layout safety**: At 1024px (our defined minimum desktop width per productBrief.md), allowing both panels to coexist crushes the kanban area to ~224px — unusable. Mutual exclusion is the only option that preserves the primary work surface
2. **Pattern consistency**: `BoardHeader` already has an `activityOpen` toggle button + conditional `<ActivityFeedPanel>` render in `BoardView`. Adding an `automationsOpen` toggle that mirrors this is the path of least resistance for users AND developers
3. **Inline form keeps users in flow**: The Team Lead persona sets up rules in short bursts (often after observing the pain). An inline expansion keeps the rule list visible during creation (peripherally — above the form), letting them reference existing rules without context-switching
4. **No modal proliferation**: We already have `CardDetailModal`. Adding another modal for a 4-field form is overkill and creates focus-management complexity
5. **Delete without confirmation is acceptable** because (a) the action is reversible by re-creating the rule, (b) the spinner provides a brief moment to reconsider, (c) toast.error provides recovery feedback if something goes wrong. A confirmation dialog would slow down the "I made this rule by mistake, kill it" flow

### Trade-offs Accepted

- **Activity and Automations panels cannot be viewed simultaneously**: Acceptable because Activity is primarily a confirmation/audit surface for automation effects, not a parallel workflow. Users who want to verify "did my rule fire?" can toggle between the two — and the board itself shows the effect (label appears, card moves), so Activity is supplementary
- **Vertical form may push rule list below the fold inside the panel**: Acceptable because panel body scrolls; users creating their second rule rarely need to see the full list while filling the form
- **No "edit rule" affordance**: Per task scope. Users delete and re-create. If this becomes a real friction (observable in metrics), edit is a post-MVP enhancement

### Decisions on the 5 Open Questions

| # | Question | Decision | Why |
|---|----------|----------|-----|
| 1 | Panel coexistence with Activity panel | **Mutual exclusion** — opening Automations closes Activity (and vice versa) | Layout safety at 1024px is non-negotiable; tabs (Option 2) breaks consistency; coexistence (Option 3) breaks layout |
| 2 | "Add rule" affordance placement | **Top of the list when rules exist; centered in the empty-state body when no rules** | Top placement is conventional for "+ Add" actions (matches LabelPickerSection); empty-state CTA centered for maximum visibility on first run |
| 3 | "Notify" action concrete UX | New event type `automation_triggered`; activity entry rendered as **`⚡ {CardTitle} — {action description} (automated)`** with the ⚡ as a distinct prefix icon. Exact formats per action type below | Existing `ActivityEntry` component already renders by event type; one new type + one new icon is minimal addition. The `(automated)` suffix removes ambiguity for users who skim the feed |
| 4 | Delete confirmation pattern | **No confirmation dialog** — direct × → spinner → success/error toast | Aligns with AC-HAPPY-4; speeds the "kill this rule" flow; toast.error provides recovery for the unlikely failure case; rule is trivially re-creatable |
| 5 | Empty state treatment | **Heading "Automate repetitive transitions." + sub-text concrete example ("When a card moves to Done, apply the Shipped label — automatically.") + prominent "+ Add rule" CTA** | Concrete example > abstract description for the "if this then that" mental model; "—automatically" punchline emphasizes the value prop; centered layout matches `ActivityFeedPanel` empty state |

### Plain-English Activity Feed Format for Automation-Triggered Events

The Activity feed entry for an `automation_triggered` event uses this exact format:

| Action Type | Entry Format (rendered by `ActivityEntry.tsx`) |
|-------------|------|
| `assign_label` | `⚡ {CardTitle} — label {LabelName} applied (automated)` |
| `move_to_column` | `⚡ {CardTitle} — moved to {ColumnName} (automated)` |
| `notify` | `⚡ {CardTitle} — {trigger description, e.g., "moved to Done"}` (no `(automated)` suffix because the notify action IS the automation surfacing itself) |

**Visual treatment:**
- ⚡ icon rendered as an SVG lightning-bolt, 14px, `text-amber-500` (matches "automation" semantic color used in tooling)
- Timestamp on right (same as existing entries)
- No actor avatar (this is system-initiated; no user actor)

**Example concrete entries:**
- `⚡ Fix login bug — label Shipped applied (automated)         2m ago`
- `⚡ Update docs — moved to Done (automated)                   5m ago`
- `⚡ Refactor parser — moved to Done                            8m ago`  (this is a "notify" action that fired because the user manually moved the card; reads naturally as a system-narrated event)

## Implementation Guidelines

### Frontend Requirements

1. **Components**:
   - `frontend/src/components/automation/AutomationRulesPanel.tsx` — main panel component, mirrors `ActivityFeedPanel.tsx` structure (header, body, scrollable list, Escape close handler)
   - `frontend/src/components/automation/AutomationRuleRow.tsx` — single rule row with plain-English summary + × delete button + spinner-on-pending
   - `frontend/src/components/automation/AutomationRuleForm.tsx` — inline form with two `<select>` pairs, conditional rendering on trigger/action type, validation, submit handler
   - `frontend/src/components/automation/AutomationRulesEmptyState.tsx` — copy + CTA

2. **State management**:
   - `BoardView.tsx`: add `automationsOpen` state + `automationsToggleRef` + `closeAutomationsPanel` callback (mirror `activityOpen` pattern)
   - **Mutual exclusion**: when opening Automations, call `setActivityOpen(false)`; when opening Activity, call `setAutomationsOpen(false)`. Implement in BoardView, not in either panel
   - Form state in `AutomationRuleForm`: local `useState` for trigger type, trigger config, action type, action config, validation errors

3. **Key interactions**:
   - Toggle pattern: `setAutomationsOpen(prev => !prev)` with side effect of closing Activity
   - Escape key in panel: closes panel (matches Activity)
   - Escape key in expanded form: collapses form (not the panel) — matches modal convention
   - "+ Add rule" CTA: sets `formOpen` state in the panel; toggles between list view and form view
   - Delete: pessimistic with spinner; toast.error on failure
   - Save: optimistic invalidation; toast.success on 201

4. **Routing & query keys**:
   - No new routes
   - TanStack Query keys: `['automations', boardId]` (list), no per-rule key needed for delete (use mutation)
   - Invalidation on mutate: `['automations', boardId]` (panel list); existing `['board', boardId]` invalidation in card mutations remains untouched (handles automation effect surfacing)

### Backend Requirements

1. **API endpoints** (already specified in TASK-007 plan):
   - `GET /api/boards/:boardId/automations` — list, ordered by `created_at ASC`
   - `POST /api/boards/:boardId/automations` — create; returns 201; 422 on direct cycle; 400 on schema invalid
   - `DELETE /api/boards/:boardId/automations/:ruleId` — 204 on success; 404 on unknown or wrong-board

2. **Async/fire-and-forget**:
   - `CardController.updateCard` adds fire-and-forget `automationService.evaluateCardMoved(...)` after `res.json(card)` (mirrors existing activity event pattern)
   - `CardLabelController.replace` adds fire-and-forget `automationService.evaluateLabelAssigned(...)` per added label
   - `AutomationService.evaluate*` methods wrap action execution in try/catch; on error, log at `warn` with `{ event: "RULE_EXECUTION_FAILED", ruleId, triggerType, reason }`; never throw

3. **State persistence**:
   - `automation_rules` table per TASK-007 plan
   - `activity_events` gets new event type `automation_triggered` with payload `{ ruleId, triggerType, actionType, cardId, cardTitle, ... }` — populated by `activityService.recordEvent` called from the action executor

### Integration Points
| System | Interface | Data Exchanged |
|--------|-----------|----------------|
| Activity Feed | `activityEmitter.emit('automation_triggered', ...)` | rule ID, card ID, card title, action type, applied label/column name; surfaced via existing SSE to ActivityFeedPanel |
| Card update flow | Fire-and-forget call from `CardController.updateCard` | board ID, card ID, from-column-id, to-column-id |
| Card label flow | Fire-and-forget call from `CardLabelController.replace` | board ID, card ID, added label IDs |
| TanStack Query | `invalidateQueries(['board', boardId])` in card mutation `onSettled` | Triggers UI re-render with automation effects visible |

## Acceptance Criteria (MANDATORY)

> **Note**: TASK-007.md already contains the full list of acceptance criteria (AC-ENTRY-1, AC-ENTRY-2, AC-HAPPY-1 through AC-HAPPY-4, AC-ERROR-1 through AC-ERROR-4, AC-EMPTY-1, AC-ASYNC-1 through AC-ASYNC-3). The criteria below are journey-specific clarifications and additions derived from this design.

### AC-JOURNEY-1: Mutual exclusion of Activity and Automations panels
**Priority**: MUST

**Given** the user is on a board with the Activity panel open
**When** the user clicks the "Automations" button in BoardHeader
**Then**:
  - The Activity panel closes (its `<aside>` is removed from the DOM in the same render)
  - The Automations panel opens (its `<aside aria-label="Automations">` renders)
  - Both buttons reflect correct `aria-pressed` states: Activity = `false`, Automations = `true`
  - Focus moves to the Automations panel's close `×` button (or panel body if no focusable element in header)

**And conversely** with Automations open → user clicks "Activity" → Automations closes, Activity opens

**Verification**:
- [ ] E2E: Open Activity → click Automations → assert Activity closed, Automations open
- [ ] E2E: Open Automations → click Activity → assert Automations closed, Activity open
- [ ] E2E: `aria-pressed` attributes match panel visibility

### AC-JOURNEY-2: Inline form expansion within panel (not modal)
**Priority**: MUST

**Given** the Automations panel is open with at least one existing rule
**When** the user clicks "+ Add rule" at the top of the rule list
**Then**:
  - The "+ Add rule" button is replaced by an expanded inline form within the panel body (no `<dialog>` or modal element is rendered)
  - The form contains: "When..." section, trigger type select, conditional trigger config select, "Then..." section, action type select, conditional action config select, Cancel button, Save rule button
  - Existing rule rows remain visible below the form (or accessible via scroll)
  - The panel does NOT close

**Verification**:
- [ ] E2E: Click "+ Add rule" → no `<dialog>` in DOM; form is descendant of `<aside aria-label="Automations">`
- [ ] E2E: Existing rule rows still queryable after form expand
- [ ] E2E: Pressing Escape collapses form, not panel

### AC-JOURNEY-3: Activity feed entry format for automation_triggered events
**Priority**: MUST

**Given** an automation rule fires with action `assign_label` (label name "Shipped") on card "Fix login bug"
**When** the Activity feed is open (or opens after the fire)
**Then**:
  - A new entry appears at the top of the activity log with exact text **`⚡ Fix login bug — label Shipped applied (automated)`**
  - The ⚡ prefix is a rendered SVG lightning-bolt with `text-amber-500` class
  - No avatar is rendered for this entry (system-initiated event)
  - Timestamp appears on the right per existing pattern

**Verification**:
- [ ] E2E: Trigger a rule with assign_label action; assert exact entry text in activity feed
- [ ] E2E: Lightning bolt SVG is present with correct CSS class
- [ ] Integration: `activity_events` table has new row with `event_type = 'automation_triggered'`

**Variant for `move_to_column`**: entry text is `⚡ {CardTitle} — moved to {ColumnName} (automated)`
**Variant for `notify`**: entry text is `⚡ {CardTitle} — {trigger description}` (no `(automated)` suffix because the notify action IS the surfacing)

### AC-JOURNEY-4: Delete without confirmation, pessimistic spinner
**Priority**: MUST

**Given** the user has at least one rule in the Automations panel
**When** the user clicks the `×` button on a rule row
**Then**:
  - **No confirmation dialog appears** (no `<dialog>`, no `confirm()`, no inline "Are you sure?" prompt)
  - The `×` icon is replaced by an inline spinner SVG (same pattern as ActivityFeedPanel reconnecting indicator)
  - The rule row remains in the list during the in-flight DELETE
  - On 204: row is removed; no toast on success
  - On error: spinner reverts to `×`; row stays; `toast.error('Failed to delete rule')` displays

**Verification**:
- [ ] E2E: Click × → no dialog appears
- [ ] E2E: Spinner appears on the row during in-flight
- [ ] E2E: Row removed on success; error toast on failure
- [ ] No `toast.success` call on delete (silent success)

### AC-JOURNEY-5: Empty state copy and CTA
**Priority**: MUST

**Given** the user opens the Automations panel on a board with zero rules
**Then** the panel body shows (exact text):
  - Heading: **`Automate repetitive transitions.`**
  - Sub-text: **`When a card moves to Done, apply the Shipped label — automatically.`**
  - A primary CTA button labeled exactly **`+ Add rule`** (note: literal `+ ` prefix in the label)
  - No `+ Add rule` button at the top of the (empty) list — the CTA in the empty state is the only entry to form creation

**Verification**:
- [ ] E2E: Empty state heading text matches exactly
- [ ] E2E: Sub-text matches exactly
- [ ] E2E: CTA button label matches exactly
- [ ] E2E: Click CTA → form expands

### AC-INTEGRATION-1: Automation actions produce real, input-derived effects (anti-stub)
**Priority**: MUST

**Given** an automation rule: trigger `card_moved_to_column` → column "Done" (id: `col-done-uuid`), action `assign_label` → label "Shipped" (id: `lbl-shipped-uuid`)
**When** a user moves card "Fix login bug" (id: `card-123`) into column "Done"
**Then**:
  - The card with id `card-123` (specifically — not any other card) has label "Shipped" applied (verified via DB row in `card_labels` table)
  - The activity_events table has exactly one new `automation_triggered` row referencing rule and card "Fix login bug"
  - If we move card "Different bug" (id: `card-456`) to the same column, the action fires for that card (not duplicated for card-123)
  - If the rule action label is changed to "Bugfix" and a new card is moved to Done, the new card gets "Bugfix" applied (not "Shipped")

**Anti-stub verification**:
- [ ] Submit real card move; verify card_labels row exists for that specific card_id
- [ ] Submit different card move; verify a different card_labels row created
- [ ] Verify activity_events.metadata jsonb contains the actual card title (not "TODO" or "sample")

---

## Test Scenarios (Derived from Acceptance Criteria)

### Happy Path Tests
1. **AC-ENTRY-1 + AC-ENTRY-2**: Automations button is visible in BoardHeader; clicking opens panel
2. **AC-HAPPY-1**: Create card_moved_to_column → assign_label rule; rule appears in list; toast shown
3. **AC-HAPPY-2**: Move card to trigger column; label applied on next re-fetch; ⚡ entry in activity feed
4. **AC-HAPPY-3**: Create card_label_assigned → move_to_column rule; assign label; card moves on next re-fetch
5. **AC-HAPPY-4**: Delete a rule; row removed; no toast
6. **AC-JOURNEY-1**: Mutual exclusion of panels
7. **AC-JOURNEY-2**: Inline form expansion (not modal)
8. **AC-JOURNEY-3**: Activity feed entry format
9. **AC-JOURNEY-5**: Empty state copy

### Error Scenario Tests
1. **AC-ERROR-1**: Form submitted with missing trigger type; inline error "Select a trigger type"
2. **AC-ERROR-1 (variants)**: Each missing-field variant
3. **AC-ERROR-2**: Stale rule reference fires; primary card op returns 200; warn-level log; no user-visible error
4. **AC-ERROR-3**: Circular rule submission; 422 returned; inline form-level error displayed
5. **AC-ERROR-4**: Delete fails; spinner reverts to ×; toast.error displayed

### Edge Case Tests
1. **AC-ASYNC-1**: Loading state shown while rules query in flight
2. **AC-ASYNC-2**: Save button disabled + spinner during POST; form survives 5xx failure
3. **AC-ASYNC-3**: Automation effect visible after card op re-fetch (no manual page refresh)
4. **AC-JOURNEY-4**: Delete without confirmation
5. **AC-INTEGRATION-1**: Automation produces card-specific effects (anti-stub)

## Accessibility Checklist

- [x] Keyboard navigation: Tab through BoardHeader → Automations button reachable in expected order (after Activity, before New Card)
- [x] `aria-pressed` on Automations button reflects panel state
- [x] `<aside aria-label="Automations">` provides landmark for screen readers
- [x] Escape key closes panel (matching Activity pattern)
- [x] Inside expanded form: Escape collapses form (not panel)
- [x] Focus returns to Automations button when panel closes (via `automationsToggleRef.current?.focus()`)
- [x] All form `<select>` elements have associated `<label>` (visible or sr-only)
- [x] Validation errors have `aria-invalid="true"` and are associated with their inputs via `aria-describedby`
- [x] Inline form-level error region uses `role="alert"` for screen reader announcement
- [x] Delete spinner has `<span className="sr-only">Deleting rule…</span>` for screen reader feedback
- [x] Loading spinner has `<span className="sr-only">Loading rules…</span>`
- [x] Activity feed automation_triggered entries are announced via the existing `aria-live="polite"` on the activity log
- [x] No time limits without extension (none applicable here)
- [x] Color contrast: ⚡ amber-500 icon meets 4.5:1 contrast on `bg-surface-card`
- [x] Focus indicators on all interactive elements (rings already wired via TailwindCSS focus classes)

## Analytics & Observability

### Key Metrics
| Metric | Purpose | Target |
|--------|---------|--------|
| Rules created per board (over board lifetime) | Adoption signal | ≥ 1 rule per active board within first 2 weeks |
| Time to first rule (from board creation) | Onboarding effectiveness | < 5 days median for boards with ≥ 2 users |
| Rule fire rate (fires per day per rule) | Rule usefulness | ≥ 0.5/day = rule is paying off |
| Rule deletion rate within 24h of creation | Rule mis-configuration signal | < 30% (high rate indicates form UX confusion) |
| `RULE_EXECUTION_FAILED` warn-log frequency | Stale-rule signal | < 1% of total rule fires |

### Instrumentation Points
- **`automation_rule_created`** event (frontend analytics, post-MVP): fired on 201; data `{ boardId, triggerType, actionType }` (no label/column IDs to avoid PII drift)
- **`automation_rule_deleted`** event: fired on 204; data `{ boardId, ruleAgeMs }`
- **`automation_triggered`** activity event: persisted to `activity_events` table; payload `{ ruleId, triggerType, actionType, cardId, cardTitle, appliedLabelName?, targetColumnName? }`
- **`RULE_EXECUTION_FAILED`** server log at `warn` level: `{ event, ruleId, triggerType, reason }` — no card IDs, no label names, no column names (per AC-ERROR-2)

**Note**: Frontend analytics events are post-MVP — no analytics SDK is wired in BanyanBoard MVP. The Activity feed entries and server warn logs are the operational visibility for MVP.

## Validation Checklist

- [x] Journey delivers stated value (rules reduce manual board housekeeping)
- [x] Primary persona (Team Lead) can complete journey end-to-end without help text
- [x] Secondary persona (Team Member) understands automation effects via ⚡ Activity entries
- [x] All errors recoverable (validation inline, server errors via toast + form preservation, circular rules via inline form-level error)
- [x] Async states clear (loading spinner, save button spinner, deletion spinner, activity entry on fire)
- [x] Consistent with existing patterns (mirrors ActivityFeedPanel, uses toast.success/error, follows LabelPickerSection inline form precedent, uses CardDetailModal save-button-spinner pattern)
- [x] Accessible per WCAG 2.1 AA best-effort (keyboard, ARIA, focus management, contrast)
- [x] Testable with defined scenarios (37 tests planned per TASK-007 test strategy + journey-specific ACs above)

## Next Steps

1. **UI/UX Design agent** (next creative agent): resolve precise visual treatment of the form (spacing, dropdown widths, section headers, ⚡ icon SVG specifics), Automations button icon SVG, and the rule-row plain-English summary layout (one line vs two lines)
2. **Phase 1 — Backend Foundation** (`/banyan-build`): `automation_rules` table migration, AutomationRepository, AutomationService with cycle detection, AutomationController, routes, schemas, and the fire-and-forget hooks in CardController + CardLabelController
3. **Phase 2 — Frontend Panel**: AutomationRulesPanel + AutomationRuleRow + empty state + BoardView/BoardHeader wiring with **mutual exclusion of Activity panel** + TanStack Query hooks + API client
4. **Phase 3 — Rule Creation Form**: AutomationRuleForm with inline expansion, conditional config dropdowns, validation, mutation, error states, full E2E flow
