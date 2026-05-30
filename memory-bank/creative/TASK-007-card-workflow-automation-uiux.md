# UI/UX Decision: Card Workflow Automation Panel and Rule Creation Form

**Created**: 2026-05-28
**Status**: DECIDED
**Decision Type**: UI/UX

---

## User Context

### Target Users

- **Primary**: Team Lead — wants to reduce manual housekeeping on the board. Creates rules to automate repetitive transitions (e.g., "when a card moves to Done, assign the Shipped label"). Uses automations weekly when setting up or refining team process.
- **Secondary**: Team Member — benefits passively from automations: labels and column moves happen without manual steps. Rarely creates rules; may inspect the panel to understand why a card was auto-labelled.

### User Goals

1. Define a trigger/action rule quickly without leaving the board view.
2. See at a glance what automations are active on the board.
3. Delete rules that are no longer needed without disrupting the board workflow.

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Create first automation | Team Lead | Reduce repetitive labelling after column moves | Weekly (setup) |
| Review existing rules | Team Lead / Team Member | Understand why a card was auto-labelled or moved | Occasionally |
| Delete stale rule | Team Lead | Remove outdated automation that fires incorrectly | Occasionally |
| See empty state | New user | Understand the feature exists and get started | Once per board |

### Constraints

- **Devices**: Desktop (≥1024px) primary. Tablet (768–1023px) supported. Mobile is post-MVP and out of scope.
- **Accessibility**: WCAG 2.1 AA (best-effort). Keyboard navigation required. Focus management required for all open/close transitions. Error messages must be associated with inputs via `aria-describedby`. Screen reader compatibility is post-MVP but markup must not regress.
- **Existing Patterns**:
  - Panel must follow `ActivityFeedPanel` structure: `<aside>` with `w-80 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden`
  - Board header button must follow the Activity button pattern: `bg-nav-hover text-text-secondary hover:bg-border` (inactive), `bg-primary text-primary-foreground` (active), `aria-pressed`
  - Lucide React icons only (16px / `h-4 w-4` in header context, `h-3.5 w-3.5` in board header button context)
  - Form inputs must match CardDetailModal field styling: `rounded-md border border-border px-3 py-2 text-sm`
  - Inline field errors: `text-xs text-red-500`, form-level errors: `text-sm text-red-600`
  - Save button: `bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50`

---

## User Flow

### Flow Diagram

```
[Board View]
     |
     v
[Click "Automations" button in BoardHeader]
     |
     v
[AutomationsPanel opens as right-side aside (w-80)]
     |
     +--[No rules exist]---> [Empty State shown]
     |                             |
     |                             v
     |                       [Click "Add rule" (primary button)]
     |                             |
     +--[Rules exist]-----> [Rule list shown]
                                   |
                         [Click "+ Add rule" link/button]
                                   |
                                   v
                      [Rule creation form appears]
                       (inline full-panel takeover)
                                   |
                        [Select trigger type]
                                   |
                        [Select trigger config (conditional)]
                                   |
                        [Select action type]
                                   |
                        [Select action config (conditional)]
                                   |
                            [Click "Save rule"]
                                   |
               +---------[Validation error?]----------+
               |                                       |
             [Yes]                                   [No]
               |                                       |
        [Show inline errors]                  [POST to API]
        [Stay on form]                               |
                                         +----[isPending]----+
                                         |                   |
                                  [Button disabled]   [On success]
                                  [Spinner shown]          |
                                                   [Return to rule list]
                                                   [New rule appears]
```

### Flow Description

1. **Entry**: User clicks the "Automations" button in BoardHeader (right side of header, beside Activity button).
2. **Panel opens**: AutomationsPanel slides in as a right-side `<aside>` — identical position and structure to ActivityFeedPanel. The board area narrows as the panel occupies `w-80`.
3. **Empty state or rule list**: If no rules exist, the empty state is shown with a prominent primary "Add rule" button. If rules exist, the rule list is shown with a smaller "+ Add rule" button near the top.
4. **Form entry**: Clicking "Add rule" replaces the panel body with the rule creation form (full-panel takeover). The panel header changes to show "New rule" title and a "← Back" or × close action.
5. **Form completion**: User fills in all four selects (trigger type, trigger config, action type, action config — some are conditional on the type selection). Clicks "Save rule".
6. **Validation**: If any required field is missing, inline errors appear below each select. Form does not submit.
7. **Save flight**: Button becomes disabled with a spinner. On success, form closes and the rule list re-renders with the new rule.
8. **Delete**: User clicks × on a rule row. The × is replaced by a spinner. On success, the row is removed.
9. **Exit**: User clicks × in the panel header (or presses Escape) to close the panel.

### Error States

| Error | Cause | User Recovery |
|-------|-------|---------------|
| Trigger type not selected | User clicks Save without selecting trigger | `Select a trigger type` shown below trigger select (`text-xs text-red-500`) |
| Trigger column not selected | `card_moved_to_column` chosen, column not picked | `Select a column to watch` below column select |
| Trigger label not selected | `card_label_assigned` chosen, label not picked | `Select a label to watch` below label select |
| Action type not selected | User clicks Save without selecting action | `Select an action type` below action select |
| Action label not selected | `assign_label` action chosen, label not picked | `Select a label to apply` below label select |
| Action column not selected | `move_to_column` action chosen, column not picked | `Select a column to move to` below column select |
| Circular rule | Trigger column == action column (move loop) | `This rule would create a circular automation loop` below Save (`text-sm text-red-600`) |
| Save failed (network) | POST returns 5xx or network error | Generic `Failed to save rule. Please try again.` below Save (`text-sm text-red-600`) |
| Delete failed | DELETE returns error | Toast notification: "Failed to delete rule. Please try again." |

---

## Options Explored

### Option 1: Inline Expansion Within Panel

- **Approach**: Clicking "Add rule" inserts a form section below the rule list (or replaces the empty state) within the existing panel scroll area. The panel itself does not change structure — the form is just another section in the scrollable body. Consistent with the LabelPickerSection inline create form pattern.
- **Wireframe/Layout**:
  ```
  ┌────────────────────────────┐
  │ Automations            [×] │  ← panel header
  ├────────────────────────────┤
  │ When card moves to         │  ← rule row 1
  │ Done → Assign Shipped  [×] │
  ├────────────────────────────┤
  │ ─ New rule ──────────────  │  ← inline form section
  │                            │
  │ Trigger type:              │
  │ [Select trigger ▾]         │
  │                            │
  │ Trigger column:            │
  │ [Select column  ▾]         │
  │                            │
  │ Action type:               │
  │ [Select action  ▾]         │
  │                            │
  │ Action label:              │
  │ [Select label   ▾]         │
  │                            │
  │ [Cancel]      [Save rule]  │
  └────────────────────────────┘
  ```
- **User Flow**: User clicks "+ Add rule" → form section appears below rule list (or replaces empty state). User fills selects and clicks Save. On success form collapses; on cancel form collapses.
- **Pros**:
  - Context-preserving: existing rules remain visible while creating a new one
  - Consistent with `LabelPickerSection` inline create pattern
  - No z-index or overlay concerns
- **Cons**:
  - The panel is `w-80` (320px). With `px-4` padding, the usable width is ~280px. Four `<select>` elements with labels and conditional second selects makes this extremely cramped — selects will truncate option text heavily
  - Rule list is obscured by the form when scrolled down, reducing the "see what you have" benefit
  - At 320px, two-row layouts per field pair still feel cramped for dropdown options like long column names ("Ready for QA", "Waiting for review")
  - Poor visual hierarchy — the form "bleeds" into the list without a clear boundary
- **Usability**: Medium — functionally correct but spatially uncomfortable at w-80
- **Accessibility**: High — no focus trap complexities; standard in-page form
- **Implementation Complexity**: Low

---

### Option 2: Modal Dialog Overlay

- **Approach**: Clicking "Add rule" opens a centered modal dialog (same as `CardDetailModal`), overlaying the board. The AutomationsPanel may remain visible beneath the overlay backdrop. The modal provides ample width (~480–512px) for the four selects with full option text visible.
- **Wireframe/Layout**:
  ```
  ╔══════════════════════════════════════╗
  ║  New Automation Rule            [×]  ║
  ╠══════════════════════════════════════╣
  ║                                      ║
  ║  Trigger                             ║
  ║  ┌──────────────────────────────┐    ║
  ║  │ Card moves to column      ▾  │    ║
  ║  └──────────────────────────────┘    ║
  ║  ┌──────────────────────────────┐    ║
  ║  │ Select column…            ▾  │    ║
  ║  └──────────────────────────────┘    ║
  ║                                      ║
  ║  Action                              ║
  ║  ┌──────────────────────────────┐    ║
  ║  │ Assign label              ▾  │    ║
  ║  └──────────────────────────────┘    ║
  ║  ┌──────────────────────────────┐    ║
  ║  │ Select label…             ▾  │    ║
  ║  └──────────────────────────────┘    ║
  ║                                      ║
  ║  [text-sm text-red-600 error]        ║
  ╠══════════════════════════════════════╣
  ║         [Cancel]   [Save rule]       ║
  ╚══════════════════════════════════════╝
  ```
- **User Flow**: User clicks "Add rule" in panel → modal opens over board → user completes form → Save or Cancel closes modal → user returns to panel.
- **Pros**:
  - Ample width (~480px) — no option truncation; long column/label names fully visible
  - Familiar pattern: matches CardDetailModal in the existing codebase
  - Clear visual affordance: modal clearly means "you are creating something"
- **Cons**:
  - Context break: the rule list in the panel is hidden behind the backdrop. User cannot see existing rules while creating a new one
  - Two modal layers if CardDetailModal is already open would be problematic (modal-on-modal is an anti-pattern); this constraint applies here
  - Introduces `createPortal` + focus trap overhead — more implementation than inline
  - Violates a principle of the panel-based UX: panels are meant to stay on screen; a modal partially breaks the "panel stays" metaphor
- **Usability**: High for form completion (width), Medium for workflow (context break)
- **Accessibility**: High — standard modal pattern with focus trap
- **Implementation Complexity**: Medium

---

### Option 3: Full-Panel Takeover (Form Replaces Panel Body)

- **Approach**: Clicking "Add rule" replaces the panel body content with the rule creation form — the `<aside>` wrapper, header, and close button remain, but the panel title changes to "New rule" and a back arrow appears. On Save or Cancel, the panel body reverts to the rule list. This is a single-level panel navigation similar to the `LabelPickerSection` "New label" sub-view or a settings drawer sub-page.
- **Wireframe/Layout (rule list view)**:
  ```
  ┌────────────────────────────┐
  │ ⚡ Automations         [×] │  ← aside header, × closes panel
  ├────────────────────────────┤
  │ [+ Add rule]               │  ← small button, top of body
  ├────────────────────────────┤
  │                            │
  │ When card moves to Done    │
  │ → Assign label: Shipped [×]│
  │                            │
  │ When label Bug assigned    │
  │ → Move to: In Progress  [×]│
  │                            │
  └────────────────────────────┘
  ```
- **Wireframe/Layout (form view — full-panel takeover)**:
  ```
  ┌────────────────────────────┐
  │ ← New rule             [×] │  ← ← is "back to list"; × closes panel
  ├────────────────────────────┤
  │                            │
  │ TRIGGER                    │  ← section label, text-xs uppercase
  │                            │
  │ When…                      │
  │ ┌──────────────────────┐   │
  │ │ Card moves to column▾│   │
  │ └──────────────────────┘   │
  │                            │
  │ Column                     │
  │ ┌──────────────────────┐   │
  │ │ Select column…      ▾│   │
  │ └──────────────────────┘   │
  │ [error: text-xs red-500]   │
  │                            │
  │ ACTION                     │
  │                            │
  │ Then…                      │
  │ ┌──────────────────────┐   │
  │ │ Assign label        ▾│   │
  │ └──────────────────────┘   │
  │                            │
  │ Label                      │
  │ ┌──────────────────────┐   │
  │ │ Select label…       ▾│   │
  │ └──────────────────────┘   │
  │ [error: text-xs red-500]   │
  │                            │
  │ [form-level error red-600] │
  │                            │
  ├────────────────────────────┤
  │ [Cancel]    [Save rule]    │
  └────────────────────────────┘
  ```
- **User Flow**: User clicks "+ Add rule" → panel body transitions to form (← back arrow, × close available). User fills selects → clicks "Save rule" or "← Back" / "Cancel". On success, panel body reverts to rule list with new rule visible.
- **Pros**:
  - Uses the full panel width for the form: 280px effective content area (320 - 2×20px padding). Selects are still ~240px wide — sufficient for most column/label names with overflow ellipsis on native select
  - No z-index / modal complexity; single `<aside>` stays in DOM
  - Follows established single-panel navigation patterns (iOS Settings, Notion sidebar sub-views, LabelPickerSection's showCreate sub-view)
  - The back arrow clearly signals "you can return to the list"
  - No context break to the board itself — board remains fully visible
  - Consistent with LabelPickerSection's show/hide sub-view logic (same local `showForm` boolean)
- **Cons**:
  - Rule list not visible while filling out the form (cannot compare to existing rules)
  - The back/cancel distinction (← back in header vs Cancel button in footer) may confuse: both do the same thing. Clarified by making both identical in behavior (discard form, return to list) and labelling the footer button "Cancel" which is universally understood
  - At w-80, long column/label option text (e.g., "Waiting for Stakeholder Review") will be truncated in the native `<select>` — mitigated by using custom dropdown components if needed, or truncation is acceptable since the full value is always shown in the rule summary after save
- **Usability**: High — focused, uncluttered form; clear navigation cues
- **Accessibility**: High — no overlay/portal complexity; focus moves to form top on open; Back/Cancel both restore focus to "Add rule" button
- **Implementation Complexity**: Low-Medium (identical to LabelPickerSection's showCreate pattern)

---

### Option 4: Popover Anchored to "Add Rule" Button

- **Approach**: Clicking "Add rule" opens a floating popover positioned below or beside the trigger button, overlapping the panel content. The form appears in a constrained floating card (~280–300px wide).
- **Wireframe/Layout**:
  ```
  ┌────────────────────────────┐
  │ Automations            [×] │
  ├────────────────────────────┤
  │ [+ Add rule]               │
  │  ┌──────────────────────┐  │
  │  │ Trigger type:        │  │ ← popover overlaps rule list
  │  │ [Select trigger   ▾] │  │
  │  │ Action type:         │  │
  │  │ [Select action    ▾] │  │
  │  │ [Cancel] [Save rule] │  │
  │  └──────────────────────┘  │
  │ (rule rows beneath popover)│
  └────────────────────────────┘
  ```
- **User Flow**: Click "Add rule" → popover appears → fill form → Save/Cancel closes popover.
- **Pros**:
  - Contextually lightweight — does not replace the panel
- **Cons**:
  - Popover overlaps rule list, obscuring context (same downside as inline without the clean boundary)
  - At 320px panel width, the popover would be ~280px wide, leaving only a 20px gutter — practically fullscreen within the panel, indistinguishable from inline
  - z-index and outside-click dismissal complexity — more implementation than full-panel takeover
  - Confusing: the form overlapping the list creates visual clutter, not clarity
  - Popovers used in codebase (LabelPickerSection) are for lists/pickers, not multi-field forms
- **Usability**: Low-Medium — visually cluttered
- **Accessibility**: Medium — requires focus trap within floating element
- **Implementation Complexity**: Medium-High

---

## Evaluation Matrix

| Criteria | Option 1: Inline | Option 2: Modal | Option 3: Full-Panel Takeover | Option 4: Popover |
|----------|-----------------|-----------------|-------------------------------|-------------------|
| Usability | Medium | Medium-High | **High** | Low-Medium |
| Accessibility | High | High | **High** | Medium |
| Consistency with patterns | High | Medium | **High** | Low |
| Width / space adequacy | Low (cramped at 280px) | High (480px) | Medium (240px selects, adequate) | Low |
| Context preservation | Medium | Low | Medium | Low |
| Performance | High | Medium | **High** | Medium |
| Implementation complexity | Low | Medium | **Low-Medium** | Medium-High |

---

## Decision

**Chosen**: Option 3 — Full-Panel Takeover

### Rationale

The full-panel takeover is the right design for this context because:

1. **Space adequacy**: The form needs four selects, each with a label and conditional second select. At w-80 (320px), with `px-4` padding giving ~280px usable width, a full-panel takeover provides clean vertical stacking. Each `<select>` element is ~240px wide — sufficient for option text that is within reasonable bounds. This is materially better than trying to fit the form alongside the rule list (Option 1, ~280px but with competing content) or into a cramped popover (Option 4).

2. **Pattern consistency**: This is the exact same `showCreate` / `showList` local state toggle used in `LabelPickerSection`. The panel body renders either `<RuleList>` or `<RuleForm>` based on a single boolean. The back arrow and footer Cancel both reset this state — identical to how `LabelPickerSection`'s "New label" sub-view returns to the label list. This is the most internally consistent choice.

3. **No overlay complexity**: Unlike Option 2 (modal), this requires no `createPortal`, no focus trap utilities, and no z-index conflicts. The `<aside>` stays exactly where it is.

4. **Board remains visible**: Unlike Option 2 (modal with backdrop), the board is fully visible while the form is open. Users can glance at column names and labels on the board while selecting them in the form.

5. **Team Lead persona alignment**: The Team Lead uses automations during setup sessions, not in rapid-fire succession. The full-panel takeover's slightly longer interaction (back arrow to return) is acceptable because automation creation is a deliberate, infrequent action — not a quick gesture that demands micro-efficiency.

### Trade-offs Accepted

- **Rule list not visible during form**: When the form is open, the user cannot see other existing rules. Acceptable because: (a) creating a new rule is a deliberate task where the user typically already knows what rules exist; (b) the rule list re-displays immediately on Cancel/Save, so inspection is one step away. The circular rule validation error (`This rule would create a circular automation loop`) provides a safety net for the most common cross-rule conflict.
- **Select option truncation on long names**: Native `<select>` elements at ~240px width may truncate very long column/label names. Acceptable for MVP because: (a) most team column names are short (To Do, In Progress, Done, Review); (b) the rule summary text in the list view shows the full resolved name post-save; (c) native `<select>` opens a full OS-level picker that shows complete text.

---

## Design Specifications

### Layout

- **Desktop (≥1024px)**: AutomationsPanel as right-side `<aside>` — `w-80 flex-shrink-0 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden`. Board area shrinks to accommodate (same as ActivityFeedPanel).
- **Tablet (768–1023px)**: Same panel structure; board scrolls horizontally. Panel may overlap the rightmost column at narrow tablet widths — acceptable (same behavior as Activity panel).
- **Mobile (<768px)**: Post-MVP; not in scope.

### Automations Button in BoardHeader

**Icon**: `ZapIcon` (Lucide React) — the lightning bolt. It is universally associated with automations, integrations, and workflow actions (Zapier uses it as its logo; most "automation" affordances in Linear, Notion, and Trello use lightning or ⚡). It is distinctly different from the ActivityIcon (clock/watch) in the same header.

**Exact Lucide icon name**: `Zap` (import as `import { Zap } from 'lucide-react'`)

**Button markup pattern** (mirrors Activity button exactly):
```
<button
  type="button"
  aria-pressed={automationsOpen}
  aria-label="Toggle automations"
  onClick={onAutomationsToggle}
  className={`px-2.5 py-1 rounded-md text-xs font-medium ... flex items-center gap-1 ${
    automationsOpen
      ? 'bg-primary text-primary-foreground'
      : 'bg-nav-hover text-text-secondary hover:bg-border'
  }`}
>
  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
  Automations
</button>
```

### Empty State

**Exact copy** (per spec):
- Icon: `Zap` from Lucide React, `h-8 w-8 text-text-disabled` (matching ActivityFeedPanel's clock icon style)
- Heading: "Automate repetitive transitions." — `text-sm font-medium text-text-secondary`
- Sub-text: "When a card moves to Done, apply the Shipped label — automatically." — `text-xs text-text-disabled`
- CTA button: "Add rule" — `bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md`

### Rule List View

**Header** (panel header, when showing list):
```
┌────────────────────────────────────────┐
│ ⚡ Automations                     [×] │
└────────────────────────────────────────┘
```
- Title: `text-sm font-semibold text-text-primary`
- Close button: same as ActivityFeedPanel close

**"+ Add rule" affordance placement**: Always visible at the top of the panel body, above the rule list. A compact button: `text-xs text-primary hover:underline flex items-center gap-1`. The "+ Add rule" call-to-action is also the only action in the empty state (as a primary button). When rules exist, it appears as a small text button pinned to the top of the scroll area (not primary — primary is reserved for the empty state CTA).

Rationale: Always-visible "Add rule" at the top means users never have to scroll to the bottom to find it. The text-link style (not primary button) prevents visual competition with the rule rows when rules exist.

### Rule Row Design

**Layout**: Two-line wrapping text left, delete button right.

```
┌─────────────────────────────────────┐
│ When card moves to Done             │
│ → Assign label: Shipped         [×] │
└─────────────────────────────────────┘
```

- Rule text: wrapping two-line format (not truncated single-line). The summary can be 50–60 characters long ("When label Bug assigned → Move to: In Progress"); truncation at w-80 would hide important context.
- Text style: `text-xs text-text-primary` for the full summary on one or two lines
- Delete button [×]: `text-text-disabled hover:text-red-500 focus:ring-red-400` — muted until hovered to avoid visual noise
- During DELETE isPending: × replaced by a `h-3 w-3 animate-spin` spinner with `<span className="sr-only">Deleting…</span>`
- Row padding: `px-4 py-2.5` with `border-b border-border` separator between rows
- Row hover: `hover:bg-nav-hover` to indicate interactivity

### Plain-English Rule Summary Templates

All 9 trigger+action combinations:

| Trigger | Action | Template |
|---------|--------|----------|
| card_moved_to_column | assign_label | `When card moves to {ColumnName} → Assign label: {LabelName}` |
| card_moved_to_column | move_to_column | `When card moves to {ColumnName} → Move to: {TargetColumnName}` |
| card_moved_to_column | notify | `When card moves to {ColumnName} → Notify team` |
| card_label_assigned | assign_label | `When label {LabelName} assigned → Assign label: {TargetLabelName}` |
| card_label_assigned | move_to_column | `When label {LabelName} assigned → Move to: {ColumnName}` |
| card_label_assigned | notify | `When label {LabelName} assigned → Notify team` |
| card_due_date_set | assign_label | `When due date set → Assign label: {LabelName}` |
| card_due_date_set | move_to_column | `When due date set → Move to: {ColumnName}` |
| card_due_date_set | notify | `When due date set → Notify team` |

Notes:
- `{ColumnName}`, `{LabelName}`, `{TargetColumnName}`, `{TargetLabelName}` are resolved from the stored IDs at render time using the board's columns/labels data.
- If a referenced column or label is deleted, fall back to: `(deleted)` in place of the name, styled `text-text-disabled italic`.
- The `→` separator (Unicode right arrow) provides clear trigger/action visual separation without requiring two separate lines.

### Rule Creation Form — Full-Panel Takeover Layout

**Panel header in form view**:
```
┌────────────────────────────────────────┐
│ ← New rule                         [×] │
└────────────────────────────────────────┘
```
- `←` Back link: `text-sm text-text-secondary hover:text-text-primary flex items-center gap-1` — clicking returns to list (discards form state)
- Title: `text-sm font-semibold text-text-primary`
- `[×]`: closes the entire AutomationsPanel (same behavior as panel-level close)

**Form body** (scrollable, `flex flex-col gap-4 px-4 py-3`):

```
TRIGGER
────────────────

When…
[Select trigger type  ▾]   ← text-sm select, full width
[error text if any]

Column  ← only shown if trigger is card_moved_to_column
[Select a column to watch ▾]
[error text if any]

Label   ← only shown if trigger is card_label_assigned
[Select a label to watch  ▾]
[error text if any]

ACTION
────────────────

Then…
[Select action type  ▾]    ← full width
[error text if any]

Label   ← only shown if action is assign_label
[Select a label to apply  ▾]
[error text if any]

Column  ← only shown if action is move_to_column
[Select a column to move to ▾]
[error text if any]

[form-level error if circular loop]
```

**Section labels** (`TRIGGER`, `ACTION`): `text-xs font-semibold text-text-secondary uppercase tracking-wide`

**Field labels** (`When…`, `Then…`, `Column`, `Label`): `text-xs font-medium text-text-secondary`

**Select elements**: `w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`

**Trigger type select options**:
- `""` → "Select trigger…" (disabled placeholder)
- `card_moved_to_column` → "Card moves to column"
- `card_label_assigned` → "Label assigned to card"
- `card_due_date_set` → "Due date set on card"

**Action type select options**:
- `""` → "Select action…" (disabled placeholder)
- `assign_label` → "Assign label"
- `move_to_column` → "Move card to column"
- `notify` → "Notify team"

**Footer** (sticky at panel bottom, `border-t border-border px-4 py-3 flex items-center justify-between shrink-0`):
```
[Cancel]           [Save rule]
```
- Cancel: `text-sm text-text-secondary hover:text-text-primary px-4 py-2 rounded-md hover:bg-nav-hover`
- Save rule: `bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed`
- During POST isPending: Save button shows "Saving…" + disabled, with `aria-busy="true"`

### Key Components

| Component | Purpose | Behavior |
|-----------|---------|----------|
| `AutomationsPanel` | Root `<aside>` container | Mirrors `ActivityFeedPanel`; renders `RuleList` or `RuleForm` based on `showForm` boolean |
| `RuleList` | Lists existing rules + empty state | Fetches rules via `useAutomationRules(boardId)`; shows empty state or rule rows |
| `RuleRow` | Single rule row with delete | Shows plain-English summary, delete × with spinner during DELETE flight |
| `RuleForm` | Rule creation form | Controlled form with 4 selects (2 conditional); full-panel-takeover view |
| `useAutomationRules` | TanStack Query hook | `GET /api/boards/:id/automations` |
| `useCreateRule` | TanStack mutation | `POST /api/boards/:id/automations` |
| `useDeleteRule` | TanStack mutation | `DELETE /api/boards/:id/automations/:ruleId` |

### Interactions

| Trigger | Action | Feedback |
|---------|--------|----------|
| Click "Automations" in BoardHeader | Panel opens (or closes if already open) | Button switches to `bg-primary text-primary-foreground`; board area narrows |
| Click "+ Add rule" (in list) or "Add rule" (empty state) | `showForm = true`; form view replaces list | Panel header updates to "← New rule [×]" |
| Click "← Back" or "Cancel" in form | `showForm = false`; form state discarded | Panel header reverts to "Automations [×]"; rule list re-displays |
| Click `[×]` in panel header (form view) | Entire panel closes | `automationsOpen = false`; board widens; Automations button reverts to inactive |
| Select trigger type | Conditional second select appears/disappears | Smooth render change; previously selected config value is cleared |
| Click "Save rule" with missing fields | Inline validation errors appear | Focus moves to first erring field |
| Click "Save rule" with valid fields | POST fires; button shows spinner | On success: `showForm = false`; rule list re-fetches and shows new rule |
| Click × on a rule row | DELETE fires; × becomes spinner | On success: row removed. On failure: toast error |
| Press Escape | Panel closes (same as Escape in ActivityFeedPanel) | Board widens; button reverts |

### Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| < 640px | Post-MVP; not in scope |
| 640–1023px (tablet) | Panel is same structure; board columns may be partially obscured — acceptable, same as Activity panel |
| ≥ 1024px (desktop) | Full layout; panel + board side by side |

### Accessibility Requirements

- [x] Keyboard navigation: all buttons and selects are keyboard-reachable; Tab order follows visual order within the panel
- [x] Screen reader: `<aside aria-label="Automations">` on the panel; `<h2>` for panel title; form section has `role="form"` or is wrapped in `<form>` element
- [x] Error messages: each select has `aria-describedby` pointing to the error `<span>` ID when an error is present; `aria-invalid="true"` on invalid selects
- [x] Loading states: rule list loading spinner has `<span className="sr-only">Loading rules…</span>`; Save button has `aria-busy="true"` during POST; delete spinner has `<span className="sr-only">Deleting…</span>`
- [x] Color contrast: `text-red-500` / `text-red-600` on white background meets WCAG AA for error text; primary button `bg-primary text-primary-foreground` meets contrast requirements
- [x] Focus management: when `showForm` becomes `true`, focus moves to the first select in the form; when form closes (Cancel/Back/success), focus returns to the "+ Add rule" button
- [x] Focus indicators: `focus:ring-2 focus:ring-primary` on all interactive elements
- [x] Escape key: closes panel (consistent with ActivityFeedPanel)

---

## Implementation Guidelines

### For Developers

1. **Follow ActivityFeedPanel exactly** for the `<aside>` wrapper: `flex-shrink-0 w-80 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden`. The AutomationsPanel is a sibling to ActivityFeedPanel in the board layout — both cannot be open simultaneously (same pattern as Activity; the BoardHeader `automationsOpen` boolean is mutually exclusive with `activityOpen`).

2. **Use local `showForm` boolean** (not a route change or modal state) to switch between list and form views — identical to `LabelPickerSection`'s `showCreate` state. The panel `<aside>` structure never unmounts; only its body children swap.

3. **Conditional selects**: Render the trigger config select (column or label) and action config select (label or column) only when the parent type select has a value that requires a config. When the trigger type changes, reset the trigger config value to `""`. Same for action type → action config.

4. **Plain-English summaries**: Implement a pure function `ruleToString(rule, columns, labels): string` that maps a rule object to the template strings defined above. Use this in both `RuleRow` and any future notification/audit contexts.

5. **Delete button spinner**: Use a `deletingRuleId: string | null` state in `RuleList`. When a DELETE mutation fires for a given rule ID, set `deletingRuleId = ruleId`; on settle, set back to `null`. The `RuleRow` receives an `isDeleting` boolean prop.

6. **Validation is client-side first**: Validate all required fields before calling `useCreateRule`. Do not rely on server-side 400 responses for the primary validation UX. Form-level circular rule check (`triggerColumnId === actionColumnId` when both are `card_moved_to_column` + `move_to_column`) is also done client-side as a pre-submit guard, but the server should also enforce it.

7. **BoardHeader integration**: Add `automationsOpen: boolean` and `onAutomationsToggle: () => void` props to `BoardHeader`, mirroring the existing `activityOpen` / `onActivityToggle` props. The two panels are mutually exclusive: opening one closes the other.

### Component Structure

```
frontend/src/components/automation/
├── AutomationsPanel.tsx          ← aside wrapper; showForm state; routes to RuleList or RuleForm
├── RuleList.tsx                  ← list view; empty state; "+ Add rule" button; renders RuleRow[]
├── RuleRow.tsx                   ← single rule row; ruleToString(); delete × with spinner
├── RuleForm.tsx                  ← rule creation form; 4 selects (2 conditional); validation
├── ruleToString.ts               ← pure function: rule + columns + labels → summary string
├── useAutomationRules.ts         ← TanStack Query: GET /api/boards/:id/automations
├── useCreateRule.ts              ← TanStack mutation: POST /api/boards/:id/automations
├── useDeleteRule.ts              ← TanStack mutation: DELETE /api/boards/:id/automations/:ruleId
└── AutomationsPanel.test.tsx     ← component tests
```

### Recommended Libraries/Patterns

- **Lucide React `Zap` icon**: Already a dependency (other Lucide icons used in codebase). Use `<Zap className="h-3.5 w-3.5" aria-hidden="true" />` in the BoardHeader button.
- **TanStack Query**: Same pattern as `useLabels` / `useCreateLabel` / `useReplaceCardLabels`. No new state management library needed.
- **Native `<select>`**: Sufficient for MVP. Column/label option text truncation at ~240px is acceptable. Custom dropdown upgrade is post-MVP.
- **`sonner` toast**: Already used in CardDetailModal (`toast.success`). Use `toast.error("Failed to delete rule. Please try again.")` for delete failures.

---

## Validation Checklist

- [x] Meets all user goals: create rules, view rules, delete rules, understand empty state
- [x] Accessible per WCAG 2.1 AA: keyboard nav, focus management, aria attributes, error association
- [x] Consistent with existing patterns: ActivityFeedPanel aside structure, BoardHeader button style, LabelPickerSection sub-view pattern, CardDetailModal button and error styles
- [x] Respects Guiding Principles: simplicity over cleverness; no premature abstractions; optimistic-ready (rule appears immediately after save); clean component boundaries
- [x] Responsive across devices: desktop and tablet supported; mobile deferred to post-MVP
- [x] Performance acceptable: TanStack Query caching; no new libraries; no heavy re-renders
- [x] Implementation feasible: low-medium complexity; follows established in-codebase patterns exactly

---

## Next Steps

1. **Build Phase 1**: Implement `AutomationsPanel` + `RuleList` (empty state + rule rows from API) + BoardHeader button integration (with `Zap` icon). Verify panel open/close, `aria-pressed`, and Escape key behavior.
2. **Build Phase 2**: Implement `RuleForm` (full-panel takeover, 4 selects with conditional rendering, validation, POST mutation, spinner states). Verify all 9 trigger+action combos, all error messages, and focus management.
3. **Build Phase 3**: Backend API (`GET /POST /DELETE /api/boards/:id/automations`), automation trigger execution (domain event hooks on card_moved, label_assigned, due_date_set), circular rule guard.
4. **UAT**: Walk the "create automation → trigger it by moving a card → verify label applied" happy path; verify empty state copy; verify delete with spinner; verify keyboard navigation end-to-end.
