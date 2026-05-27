# User Journey Design: Card Labels

**Created**: 2026-05-27
**Status**: DECIDED
**Decision Type**: User Journey
**Task**: TASK-006 (Level 3, FEAT-006)
**Resolves**: Q1 (label picker interaction pattern), Q2 (label management entry point)

## Journey Overview

**Feature**: Card Labels — board-scoped color-coded labels (name + color + optional emoji icon) with three integrated sub-journeys: (a) **create / manage** labels on a board, (b) **assign / remove** labels on individual cards from the card detail modal, and (c) **filter** the board by label.

**Primary Persona**: Team Member — individual contributor (dev, designer, PM) running sprint planning, organizing cards by type / priority / area.

**Journey Type**: Synchronous (all three sub-journeys)
- Label create / delete: synchronous REST round-trip < 200ms p95, optimistic cache update
- Label assign / remove: synchronous, optimistic UI rollback on failure (mirrors `useUpdateCard`)
- Board filter: synchronous, client-side, < 50ms (reuses existing `filterCards` utility)

**Orchestration Pattern**:
- Label assignment: **Popover / Dropdown** (Q1 decision — see Decision section)
- Label management: **Inline in the same popover, with progressive disclosure** (Q2 decision — single surface for both pick and manage)
- Filtering: **No change** — existing `FiltersDropdown` already handles label chips; only the data source for `allLabels` changes (from inferred-from-cards to fetched-from-API)

### Success Statement
> During sprint planning, a Team Member opens a card, clicks "Labels", types a new label name, picks a color and an optional emoji from a curated palette, and clicks "Create" — the new label appears immediately, they toggle it onto the card, close the modal, and see the labelled card on the board within one second. They then click the board's Filters button, toggle the same label chip, and the board narrows to only the cards they care about.

---

## Persona Context

### Primary User: Team Member
- **Who**: Individual contributor (developer, designer, PM) — from `productBrief.md` Key Personas table
- **Goal**: Organize cards by type ("Bug", "Feature", "Tech-Debt") or priority ("P0", "P1") during sprint planning so the team can scan a board and immediately understand what each card represents.
- **Context**: Desktop browser (Chrome / Firefox / Safari / Edge 120+), on a board with 5–100+ cards. Sprint planning happens once every 1–2 weeks; the rest of the time they only assign or remove existing labels on individual cards.
- **Proficiency**: Comfortable with Trello / Linear-style label pickers. Expects to be able to create a label inline (Trello-style) without leaving the card they're working on. Keyboard-first: Tab / Enter / Space / Escape.

### Secondary User: Team Lead
- **Who**: Engineering or product lead — same persona table
- **Different needs**: Uses the **filter** sub-journey far more than the **management** sub-journey. Wants to view "only Bugs" or "only P0s" at a glance. Creates the initial board taxonomy once during setup; rarely creates labels after.
- **Journey delta**: Spends most time in `FiltersDropdown`, not in the card modal label picker. Same UI surface.

### Tertiary User: Freelancer / Solo Builder
- **Who**: Solo operator on a single board
- **Different needs**: Creates labels ad-hoc as new client work types emerge. Volume is low; total label count per board stays small (< 10).

---

## Journey Map

### Entry Points

| Entry | Context | User Intent |
|-------|---------|-------------|
| "Labels" section in `CardDetailModal` | Card detail modal opened from any `CardTile` | "Add or remove labels on this card" |
| "+ Add labels" trigger inside that section (when card has 0 labels) | Same | "Start picking labels on a brand-new card" |
| "Create new label" inline option at the bottom of the label picker popover | Inside the open picker | "I need a label that doesn't exist yet" |
| "Edit" pencil icon next to each label inside the picker popover | Inside the open picker | "Rename or recolor an existing label" |
| Label filter chips in `FiltersDropdown` | `BoardHeader` → "Filters" button | "Show me only cards with this label" |

### State Diagram — Sub-Journey A: Assign a Label to a Card

```
[Entry: User opens CardDetailModal and clicks "Labels" section trigger]
    │
    ▼
[Picker Open: Popover appears anchored to the Labels section]
    │   - Lists all board labels with a checkbox state per row (assigned = checked)
    │   - Each row shows: checkbox, color swatch, optional emoji, name, edit pencil
    │   - "Create new label" trigger at the bottom
    │   - Focus auto-placed on the first label row (or "Create new label" if zero labels)
    │
    ├──[Escape / click outside / Tab past last item] → [Exit: Picker closes, focus returns to Labels section trigger]
    │
    ▼
[Toggle: User clicks a label row (or presses Space when focused)]
    │   - Optimistic update: row checkbox flips immediately
    │   - Optimistic update: label badge appears / disappears in the modal's Labels display row
    │   - Optimistic update: label badge appears / disappears on the underlying CardTile
    │   - Network: PUT /api/cards/:cardId/labels with the new labelIds set
    │
    ├──[HTTP 4xx/5xx or network error] → [Rollback: Optimistic state reverts; toast.error("Failed to update labels")]
    │
    ▼
[Persisted: Checkbox stays toggled; user may toggle more labels in the same popover]
```

### State Diagram — Sub-Journey B: Create a New Label (Inline)

```
[Entry: User clicks "Create new label" at the bottom of the open picker]
    │
    ▼
[Form: The "Create new label" row expands inline within the popover]
    │   - Text input for name (autoFocus)
    │   - 12-swatch preset color grid (default = first swatch)
    │   - Optional emoji text input (single char)
    │   - "Create" button (disabled until name has ≥ 1 non-whitespace char)
    │   - "Cancel" button collapses the form back to the trigger
    │
    ├──[Cancel / Escape] → [Picker Open: form collapses, picker stays open]
    │
    ▼
[Submit: User clicks Create (or presses Enter in the name input)]
    │   - Form disabled during request
    │   - Network: POST /api/boards/:boardId/labels { name, color, icon? }
    │
    ├──[HTTP 409 (duplicate name)] → [InlineError: "A label with this name already exists" under the name input;
    │                                  form re-enabled with input intact; name input refocused]
    │
    ├──[HTTP 4xx/5xx / network] → [InlineError: "Failed to create label. Please try again."; form re-enabled]
    │
    ▼
[Success: HTTP 201 — TanStack Query cache for ['labels', boardId] updated]
    │   - New label appears as the bottom row of the picker list (already checked = auto-assigned to this card)
    │   - Optimistic PUT /api/cards/:cardId/labels fires with the new label id appended
    │   - "Create new label" trigger returns; user can create another or close
    │   - The new label appears in the Filters dropdown next time it opens
```

### State Diagram — Sub-Journey C: Edit / Delete an Existing Label

```
[Entry: User clicks the edit pencil next to a label row in the picker]
    │
    ▼
[Edit Form: The row expands inline (replaces the row in place)]
    │   - Name input pre-filled
    │   - Color grid with current color pre-selected
    │   - Optional emoji input pre-filled
    │   - "Save" / "Cancel" / "Delete" buttons
    │
    ├──[Cancel / Escape] → [Picker Open: row collapses back]
    │
    ├──[Save]
    │       ▼
    │   PATCH /api/boards/:boardId/labels/:labelId → row collapses with updated label;
    │   all CardTiles and the Filters dropdown re-render via TanStack Query invalidation
    │
    ├──[Delete]
    │       ▼
    │   [Confirm: window.confirm("Delete label 'X'? It will be removed from all cards.")]
    │       │
    │       ├──[Cancel] → [Edit Form: stays open]
    │       │
    │       ▼
    │   DELETE /api/boards/:boardId/labels/:labelId → CASCADE removes card_labels rows;
    │   row disappears from picker; badges disappear from all CardTiles; chip disappears from Filters dropdown
```

### State Diagram — Sub-Journey D: Filter the Board by Label

(No new states — fully covered by existing `FiltersDropdown` infrastructure. Only the data source changes.)

```
[Entry: User clicks "Filters" button in BoardHeader]
    │
    ▼
[Filter Panel Open: FiltersDropdown renders label chips from useLabels(boardId)]
    │   (was: derived from card.labels via BoardView.allLabels useMemo)
    │   (now: fetched from GET /api/boards/:boardId/labels — includes labels with zero assigned cards)
    │
    ▼
[Toggle: User clicks a label chip → activeLabelIds state updates → filterCards re-runs → board re-renders]
```

---

## Step-by-Step Journey (Happy Path — Sprint Planning Scenario)

#### Step 1: Open the card
- **System**: React Router → `CardDetailModal`
- **User Sees**: Card detail modal opens over the board with title / description / due-date / labels sections
- **User Actions**: Reads existing labels (if any) in the Labels section
- **Feedback**: Section is always visible; if no labels assigned, shows "No labels" with a "+ Add labels" trigger; if labels exist, shows badges with an "Edit" affordance next to them
- **Transitions**: User clicks "+ Add labels" or the existing labels area to open the picker
- **Data Flow**: `useBoard(boardId)` already provides `card.labels` from the board fetch

#### Step 2: Open the label picker
- **System**: `LabelPicker` (new component, popover anchored to the Labels section)
- **User Sees**: Floating panel below the Labels section showing all board labels as checkboxed rows, each with color swatch / optional emoji / name / edit pencil. "Create new label" trigger at the bottom.
- **User Actions**: Tab through rows, Space to toggle, click edit pencil to edit, click "Create new label" to create
- **Feedback**: Focus ring on focused row; aria-checked reflects assignment; assigned rows display checkbox + label color background tint (matching the badge color)
- **Transitions**: Click outside / Escape closes picker; clicking a row toggles assignment; clicking "Create new label" expands the inline form
- **Data Flow**: `useLabels(boardId)` (TanStack Query) returns full list

#### Step 3: Create a new label (when the right label doesn't exist)
- **System**: Inline form inside the picker
- **User Sees**: Name input (autoFocused), 12-swatch color grid (curated palette including the 4 seed colors `#be123c`, `#047857`, `#0369a1`, `#6d28d9`), optional emoji input, Create / Cancel buttons
- **User Actions**: Type name → pick color → optionally type emoji → click Create (or press Enter)
- **Feedback**:
  - Name input shows validation error if empty / whitespace-only on submit
  - On HTTP 409 (duplicate name): inline error "A label with this name already exists"
  - On success: new row slides in at the bottom of the list with checkbox pre-checked, and the optimistic assignment PUT fires
- **Transitions**: Success → form collapses, picker remains open; Cancel → form collapses, picker remains open
- **Data Flow**: POST `/api/boards/:boardId/labels` → invalidates `['labels', boardId]` and `['board', boardId]` queries; optimistic PUT `/api/cards/:cardId/labels` appends new labelId

#### Step 4: Toggle existing labels
- **User Sees**: Each label row's checkbox flips immediately on click; badge appears / disappears in real time in the modal's Labels display strip AND on the underlying CardTile (visible via the modal backdrop or after close)
- **User Actions**: Click any number of label rows; can toggle multiple in succession
- **Feedback**: Optimistic UI; toast.error on network failure with automatic rollback (mirrors `useUpdateCard` pattern)
- **Data Flow**: One PUT `/api/cards/:cardId/labels` per toggle with full `labelIds` array (Option A from Q4 — replace-all)

#### Step 5: Close picker, close modal
- **User Sees**: Modal closes via Escape / X / backdrop click → board re-renders with updated card label badges
- **Value Delivered**: Card is now visually categorized; team scanning the board sees its type / priority at a glance
- **Next Actions**: Open another card and repeat; OR click Filters to view only matching cards

#### Step 6 (optional, Team Lead scenario): Filter the board
- **System**: `BoardHeader` → `FiltersDropdown` → `BoardView.filteredColumns`
- **User Sees**: Filters button shows badge count; opens dropdown; sees label chips for ALL board labels (including the newly-created one, even if it isn't on any card yet)
- **User Actions**: Click label chips to toggle filter
- **Feedback**: Board columns re-render instantly; cards without matching labels disappear; empty-column messaging already present
- **Data Flow**: `BoardView` swaps `allLabels` from `useMemo` over card data → `useLabels(boardId)` from API

---

## Distributed System Flow

```
[CardDetailModal]              [Express Backend]               [PostgreSQL]
       │                              │                              │
       │ GET /api/boards/:id/labels   │                              │
       │ ───────────────────────────▶ │                              │
       │                              │ SELECT * FROM labels         │
       │                              │   WHERE board_id = ?         │
       │                              │ ───────────────────────────▶ │
       │ ◀─────────────────────────── │ ◀─────────────────────────── │
       │                              │                              │
       │ POST /api/boards/:id/labels  │                              │
       │ { name, color, icon? }       │                              │
       │ ───────────────────────────▶ │ INSERT INTO labels ...       │
       │                              │   (UNIQUE board_id,name)     │
       │                              │ ───────────────────────────▶ │
       │ ◀── 201 { label } / 409 ─── │ ◀─────────────────────────── │
       │                              │                              │
       │ PUT /api/cards/:cardId/labels│                              │
       │ { labelIds: [...] }          │                              │
       │ ───────────────────────────▶ │ DELETE FROM card_labels      │
       │                              │   WHERE card_id = ?          │
       │                              │ INSERT INTO card_labels ...  │
       │                              │   (transactional)            │
       │                              │ ───────────────────────────▶ │
       │ ◀── 200 { card.labels } ──── │ ◀─────────────────────────── │
       │                              │                              │
       │ (TanStack Query invalidates ['labels', boardId]              │
       │  and ['board', boardId]; CardTile and FiltersDropdown        │
       │  re-render with the new state)                               │
```

### Responsibility Matrix

| Step | Owner | State Storage | Failure Handling |
|------|-------|---------------|------------------|
| Open picker | Frontend (popover state) | Local component state | N/A — UI only |
| Toggle label | Frontend → API | TanStack Query cache + DB `card_labels` | Optimistic rollback on error; `toast.error` |
| Create label | Frontend → API | TanStack Query cache + DB `labels` | Inline error on 409 / 5xx; form preserves input |
| Edit / delete label | Frontend → API | TanStack Query cache + DB `labels` (CASCADE to `card_labels`) | Confirm dialog before delete; rollback on error |
| Filter board | Frontend only | Local component state in `BoardView` | N/A — client-side only |

---

## Error Handling

### Error States

| Error Type | When | User Sees | Recovery |
|------------|------|-----------|----------|
| Duplicate label name | Create form submit; backend returns 409 | Inline error under name input: "A label with this name already exists" | Edit the name, resubmit; form keeps color + emoji selections |
| Empty / whitespace name | Create form submit (client-side) | Inline error: "Label name is required" | Type a name; client blocks submit |
| Network error on label create | POST fails | Inline error: "Failed to create label. Please try again." | Click Create again; input preserved |
| Network error on label assign | PUT fails | `toast.error("Failed to update labels")`; checkbox + badge rollback to previous state | Toggle again (optimistic retry) |
| Network error on label delete | DELETE fails | `toast.error("Failed to delete label")`; label row reappears in picker | User retries delete |
| Network error on label edit | PATCH fails | `toast.error("Failed to update label")`; edit form remains open with user's changes | Click Save again |

### Partial Failure
- **Scenario**: User toggles 3 labels rapidly; some PUT requests succeed and some fail
- **User Experience**: Since each toggle is its own request, each toggle independently optimistic-rolls-back on failure. The final state matches the server.
- **Recovery**: `onSettled` invalidates `['board', boardId]` and re-fetches the authoritative state.

---

## Options Explored

### Option 1: Inline Checkbox List in Modal Body (Q1-A + Q2-A)
- **Orchestration**: Labels rendered as a fixed checklist directly in the modal body, between Description and Due Date. "Create label" button at the bottom of the list opens a sibling form inside the modal.
- **Flow Summary**: All labels visible at once; no popover; no separate management surface.
- **Wireframe**:
  ```
  ┌──────────────────────────────────┐
  │ Title:        [____________]     │
  │ Description:  [____________]     │
  │ Labels:                          │
  │   [✓] 🔥 Bug          [edit]     │
  │   [ ]    Feature      [edit]     │
  │   [ ] ✅ Done         [edit]     │
  │   [+ Create new label]           │
  │ Due Date:     [____________]     │
  └──────────────────────────────────┘
  ```
- **Pros**:
  - No popover focus-management complexity
  - Discoverability is highest — labels always visible without a click
  - Simple keyboard nav (just Tab through the modal)
  - Mobile-friendly (no floating layer to position)
- **Cons**:
  - **Crowds the modal**: With 10+ labels the modal becomes long and pushes Due Date below the fold; sprint planning teams often have 10–15 labels
  - Edit / delete affordances per row clutter the layout
  - "Create label" form inline disrupts the modal's visual hierarchy when expanded
  - Looks unlike Trello / Linear which set user expectations
- **Best For**: Boards with very few labels (< 5)
- **Friction Points**: Modal scroll fatigue; visual noise during heavy edit sessions

### Option 2: Popover Picker + Inline Create/Edit (Q1-B + Q2-A) **[CHOSEN]**
- **Orchestration**: Compact "Labels" trigger (showing assigned labels as badges + an "Edit labels" button or "+ Add labels" if empty) opens a popover. Popover contains the full label list + inline create / edit forms. No separate management page.
- **Flow Summary**: Single surface for pick + create + edit + delete. Trello-style.
- **Wireframe**:
  ```
  ┌──────────────────────────────────┐
  │ Title:        [____________]     │
  │ Description:  [____________]     │
  │ Labels:  [🔥 Bug] [+ Add labels] │ ◀── click "+ Add labels"
  │ Due Date:     [____________]     │
  └────────────┬─────────────────────┘
               │
               ▼
       ┌──────────────────────────┐
       │ Labels                   │
       │ ┌──────────────────────┐ │
       │ │[✓] 🔥 Bug      [✎] │ │
       │ │[ ]    Feature  [✎] │ │
       │ │[ ] ✅ Done     [✎] │ │
       │ └──────────────────────┘ │
       │ ─────────────────────── │
       │ [+ Create new label]    │
       └──────────────────────────┘
  ```
- **Pros**:
  - Modal stays compact regardless of label count
  - Matches Trello / Linear mental model (Team Members already know it)
  - Single surface for assign + manage — no context-switch to a separate settings page
  - "Create label" auto-assigns to the current card (the most common workflow during sprint planning)
  - Inline edit / delete keeps the management workflow close to where users encounter labels
- **Cons**:
  - Requires popover focus-management (escape to close, focus trap optional, click-outside to dismiss) — but `FiltersDropdown` already establishes this pattern in the codebase
  - Slightly less discoverable than always-visible checklist (mitigated by clear "+ Add labels" / "Edit labels" trigger copy)
- **Best For**: All persona scenarios; scales from 3 to 50+ labels per board without modal bloat
- **Friction Points**: First-time users may not immediately discover the edit pencil (mitigated by `aria-label="Edit label"` and tooltip)

### Option 3: Toggle Chips in Modal + Separate Management Panel (Q1-C + Q2-B)
- **Orchestration**: Modal shows existing assigned labels as clickable chips (toggle off to unassign); unassigned labels are NOT shown in the modal. To assign a new label, user must navigate to a separate "Manage Labels" panel from the board header.
- **Flow Summary**: Card modal is read-mostly; all label work happens in a separate panel.
- **Wireframe**:
  ```
  Card Modal:                  Board Header → Manage Labels:
  ┌─────────────────────┐      ┌──────────────────────────┐
  │ Labels: [🔥 Bug ×]  │      │ Board Labels             │
  │         [+ More ▾]──┼─────▶│ ┌──────────────────────┐ │
  └─────────────────────┘      │ │ 🔥 Bug      Edit Del │ │
                               │ │    Feature  Edit Del │ │
                               │ │ ✅ Done     Edit Del │ │
                               │ └──────────────────────┘ │
                               │ [+ Create new label]    │
                               └──────────────────────────┘
  ```
- **Pros**:
  - Cleanest card modal — assigned labels only, no checklist clutter
  - Dedicated management space scales to large label libraries
  - Clear separation of "use" vs "manage" mental models
- **Cons**:
  - **Heavy context switch**: User must close the card, open the board panel, create the label, navigate back to the card, reopen the picker — kills the sprint-planning flow
  - Two new UI surfaces to build (picker + panel) vs one (popover)
  - Doesn't match Trello / Linear mental model
  - "+ More" trigger on the modal is ambiguous (more what? a picker? a settings page?)
- **Best For**: Enterprise tools with central admin governance of taxonomy (not BanyanBoard's "small team, self-serve" positioning per productBrief)
- **Friction Points**: Round-trip between card and panel breaks flow during sprint planning

### Option 4: Toggle Chips in Modal + Inline Create at Picker Bottom (Q1-C + Q2-A hybrid)
- **Orchestration**: Modal shows all board labels as toggle chips (assigned chips highlighted, unassigned chips grayed). "+ Create" chip at the end of the row opens an inline form.
- **Flow Summary**: Like Option 1 but with chips instead of a checklist.
- **Wireframe**:
  ```
  ┌──────────────────────────────────────┐
  │ Labels: [🔥 Bug] [Feature] [✅ Done] │
  │         [+ Create]                   │
  └──────────────────────────────────────┘
  ```
- **Pros**:
  - Compact horizontal layout
  - Single click toggles assignment
  - No popover focus management
- **Cons**:
  - **No edit / delete affordance** without growing each chip (right-click menu or hover-X is poor a11y)
  - Color-only chip differentiation makes it hard to scan when many labels exist
  - With 15+ labels the chip row wraps and dominates the modal
  - "+ Create" inline form expanding mid-row breaks the chip flow
- **Best For**: Filter UIs (which is why `FilterChip` exists today for `FiltersDropdown`), not assignment + management workflows
- **Friction Points**: Edit / delete operations have nowhere natural to live

---

## Evaluation Matrix

| Criterion | Option 1 (Checklist) | Option 2 (Popover) | Option 3 (Chips + Panel) | Option 4 (Chips Inline) |
|-----------|----------------------|--------------------|--------------------------|-------------------------|
| Discoverability | **H** (always visible) | M (one click reveal) | L (panel buried) | H (always visible) |
| Learnability | M (novel layout) | **H** (Trello model) | L (two surfaces) | M (chips for assign is unusual) |
| Efficiency — sprint planning | L (modal scroll) | **H** (one popover, no nav) | L (round-trip required) | M (no edit / delete inline) |
| Efficiency — daily toggle | M (works fine) | **H** (popover or skip — chips visible) | M (still need to open modal) | H (one click) |
| Error Prevention | M | **H** (focused surface) | M | L (mis-click toggles) |
| Error Recovery | H | **H** | M | M |
| Consistency with existing patterns | M | **H** (matches `FiltersDropdown` popover) | L (new surface type) | M (FilterChip pattern is for filters, not assignment) |
| Accessibility | H (no focus mgmt) | **H** (FiltersDropdown precedent) | M (extra navigation) | M (hover-only affordances) |
| Modal layout impact | L (bloats modal) | **H** (compact) | **H** (compact) | M (chip row wraps) |
| Scales to 20+ labels | L | **H** | H | L |

**Legend**: H = High (best), M = Medium, L = Low (worst)

---

## Decision

**Chosen**: **Option 2 — Popover Picker with Inline Create / Edit / Delete**

This resolves the two design questions as:
- **Q1 (label picker interaction)**: **B — Popover / dropdown**
- **Q2 (label management entry point)**: **A — Inline within the card-modal label picker** (no separate board-settings panel)

### Rationale

1. **Sprint-planning flow integrity**: The Team Member's primary scenario is creating and assigning labels during sprint planning while looking at a specific card. Option 2 keeps that entire workflow within the card modal — no navigation to a separate panel, no losing the card context. Option 3's round-trip would break this flow.

2. **Mental model match**: Team Members already use Trello / Linear, both of which use the popover-with-inline-create pattern. Picking the same pattern minimizes learning curve and matches productBrief's positioning ("simple, focused Kanban for small teams who want to track work without the complexity of Jira").

3. **Modal stays compact**: Option 2 keeps the card detail modal at the same vertical footprint regardless of how many labels exist on the board. Option 1's inline checklist would push Due Date below the fold for any board with 10+ labels, and sprint-planning boards routinely have that many.

4. **Reuses an existing pattern**: The `FiltersDropdown` component (`frontend/src/components/filters/FiltersDropdown.tsx`) already establishes the project's popover pattern: trigger button, click-outside dismiss, Escape close, panel anchored to trigger. The new `LabelPicker` follows the same conventions — minimal new architecture, consistent UX, low implementation cost.

5. **Avoids a second UI surface**: Option 3 requires building both a picker AND a management panel — two components, two routes (or one route + a slide-in), two sets of tests. For a Level 3 feature with a 4-phase roadmap, the simpler single-surface approach is more appropriate. The productBrief explicitly calls out "simplicity over cleverness" and "no per-seat pricing" — there's no admin-vs-user separation that would justify a dedicated label-management page.

6. **Optimistic-create-then-assign is the killer move**: When a user clicks "Create new label" from inside a card picker, the new label is automatically assigned to the card they're working on. This is what makes Trello's flow feel fast. Option 3 cannot do this without a confusing "create then go back and assign" choreography.

### Trade-offs Accepted

| Trade-off | Why acceptable |
|-----------|----------------|
| Edit / delete affordances live inside the same picker (not a dedicated admin page) | Acceptable for BanyanBoard's small-team scope. Power-user requests for bulk label management are explicitly out of scope per the productBrief's MVP gate. |
| Popover focus management is harder than inline | Mitigated by reusing the `FiltersDropdown` patterns (`mousedown` outside-click, `keydown` Escape). The existing modal `Tab` trap (lines 61–78 of `CardDetailModal.tsx`) needs to be updated to NOT trap focus into the popover when it's open (popover focus is its own scope). |
| First-time users may not immediately notice the edit pencil | Mitigated by clear `aria-label="Edit label"` plus a 24×24px touch target. Acceptable because edit is a less-frequent operation than assign. |
| Filter source change (Q4-adjacent but resolved here): `BoardView.allLabels` must switch from inferred to fetched | Required for AC-ENTRY-2 to pass. Trivial change: replace `useMemo` over card data with `useLabels(boardId)` call. |

---

## Implementation Guidelines

### Frontend Requirements

1. **New component**: `frontend/src/components/card/LabelPicker.tsx` — popover anchored to the modal's Labels section
   - Props: `cardId`, `boardId`, `assignedLabelIds: string[]`, `onToggle(labelId)`, `onClose()`
   - Internal state: `inlineFormMode: 'closed' | 'create' | { mode: 'edit', labelId: string }`
   - Reuses `FiltersDropdown`'s click-outside + Escape patterns
2. **New component**: `frontend/src/components/card/LabelForm.tsx` — inline form for create + edit (one form, two modes)
   - Props: `mode: 'create' | 'edit'`, `initialValues?: { name, color, icon }`, `onSubmit`, `onCancel`, `onDelete?` (edit mode only)
   - 12-swatch curated color palette as a constant (locked-in: includes the 4 seed colors `#be123c`, `#047857`, `#0369a1`, `#6d28d9` + 8 more selected for WCAG AA contrast against white text)
   - Emoji single-character text input (Q3 Option A — defer emoji picker to a future task)
3. **Modal updates**: `CardDetailModal.tsx` Labels section becomes interactive
   - Display row shows assigned label badges + "Edit labels" / "+ Add labels" trigger button
   - Trigger opens `LabelPicker` popover anchored below the section
   - Focus trap must coexist with popover (popover renders in its own focus scope; Escape closes popover first, then modal)
4. **New hooks** (TanStack Query, all under `frontend/src/hooks/`):
   - `useLabels(boardId)` — `GET /api/boards/:boardId/labels`
   - `useCreateLabel(boardId)` — `POST`, optimistic insert, rollback on error, surfaces 409 to caller for inline error display
   - `useUpdateLabel(boardId)` — `PATCH`, optimistic update, rollback
   - `useDeleteLabel(boardId)` — `DELETE`, optimistic remove, rollback, invalidates `['board', boardId]` to clear badges
   - `useAssignLabels(boardId, cardId)` — `PUT` with full `labelIds` array (Q4 Option A), optimistic update, mirrors `useUpdateCard.ts`
5. **BoardView change**: Replace the `allLabels` `useMemo` (lines 144–157 of `BoardView.tsx`) with `const { data: allLabels = [] } = useLabels(boardId);`
6. **Filter source fix**: Verified — `FiltersDropdown` already accepts `labels: Label[]`; no internal change needed

### Backend Requirements

1. `LabelRepository`, `LabelService`, `LabelController` following the existing Repository → Service → Controller pattern (mirror `CardRepository.ts`, `CardService.ts`, `CardController.ts`)
2. Endpoints:
   - `GET /api/boards/:boardId/labels` — returns all board labels (newest first or alphabetical — Architecture creative to decide)
   - `POST /api/boards/:boardId/labels` — Zod validation (name 1–50 chars, color hex, icon optional 1–4 chars); returns 201 or 409 on UNIQUE violation
   - `PATCH /api/boards/:boardId/labels/:labelId` — partial update; same Zod
   - `DELETE /api/boards/:boardId/labels/:labelId` — CASCADE handles `card_labels`
   - `PUT /api/cards/:cardId/labels` — body `{ labelIds: string[] }`; replaces the full label set transactionally (Q4 Option A — Architecture creative confirms)
3. Migration: `ALTER TABLE labels ADD COLUMN icon VARCHAR(10) NULL;` — new file under `backend/migrations/`

### Integration Points

| System | Interface | Data Exchanged |
|--------|-----------|----------------|
| `CardDetailModal` → `LabelPicker` | React props + callbacks | `assignedLabelIds`, `onToggle`, `onClose` |
| `LabelPicker` → `useLabels` | TanStack Query | Full label list for `boardId` |
| `LabelPicker` → `useAssignLabels` | TanStack Query mutation | `{ cardId, labelIds: string[] }` |
| `LabelForm` → `useCreateLabel` / `useUpdateLabel` | TanStack Query mutation | `{ name, color, icon? }`; surface 409 error |
| `BoardView` → `useLabels` | TanStack Query | Replaces `allLabels` derivation |
| `useLabels` mutations | TanStack Query invalidation | Invalidates `['labels', boardId]` AND `['board', boardId]` so CardTile badges refresh |

---

## Acceptance Criteria (MANDATORY)

### AC-ENTRY-1: User can find and toggle labels on a card
**Priority**: MUST

**Given** the user is viewing a board and clicks any card tile
**When** the card detail modal opens (route `/boards/:boardId/cards/:cardId`)
**Then** they see a "Labels" section in the modal that:
  - Shows currently assigned label badges (or "No labels" empty state)
  - Has an "Edit labels" trigger button (or "+ Add labels" when empty) with `aria-label` and visible focus indicator
  - Clicking the trigger opens the `LabelPicker` popover anchored below the section

**Verification**:
- [ ] E2E: Open card modal, verify Labels section is present
- [ ] E2E: Verify trigger button is keyboard-focusable
- [ ] E2E: Click trigger → popover opens
- [ ] A11y: Trigger button has correct `aria-expanded` and `aria-controls`

### AC-ENTRY-2: User can access board label filter with ALL board labels
**Priority**: MUST

**Given** the user is on the board view AND at least one label has been created on the board (whether assigned to a card or not)
**When** they click the "Filters" button in `BoardHeader`
**Then** the `FiltersDropdown` panel shows a label chip for EVERY label defined on the board — including labels that exist on the board but are not yet assigned to any card

**Verification**:
- [ ] E2E: Create a new label (do not assign to any card); open Filters dropdown; verify chip appears
- [ ] Integration: `BoardView` sources `allLabels` from `useLabels(boardId)` (NOT derived from card data)

### AC-HAPPY-1: User creates a new label and it is auto-assigned to the current card
**Priority**: MUST

**Given** the user has the `LabelPicker` open on a card
**When** they:
  1. Click "Create new label"
  2. Enter a label name (1–50 characters, e.g. "Bug")
  3. Pick a color from the 12-swatch curated palette
  4. Optionally type a single emoji character
  5. Click Create (or press Enter in the name input)
**Then**:
  - The label is persisted to the `labels` table with `board_id`, `name`, `color`, optional `icon`
  - The label appears as a new row at the bottom of the picker, with its checkbox PRE-CHECKED
  - The card's `card_labels` row is created automatically (optimistic PUT fires)
  - The label badge appears on the card's CardTile within 200ms (optimistic update)
  - The label chip appears in the Filters dropdown next time it opens

**Verification**:
- [ ] E2E: Full create flow from picker → new label visible on card tile and in Filters
- [ ] Integration: `labels` row inserted, `card_labels` row inserted, both committed
- [ ] E2E: Enter-key submission works on the name input

### AC-HAPPY-2: User assigns an existing label to a card
**Priority**: MUST

**Given** the user has the `LabelPicker` open AND at least one unassigned label exists
**When** they click an unchecked label row (or press Space when focused on it)
**Then**:
  - The row's checkbox flips to checked immediately (optimistic)
  - The label badge appears in the modal's Labels display strip immediately
  - The label badge appears on the underlying CardTile immediately
  - A PUT `/api/cards/:cardId/labels` request fires with the new full `labelIds` array
  - On HTTP 200, the optimistic state is confirmed; on error, all three UI updates roll back AND `toast.error("Failed to update labels")` appears

**Verification**:
- [ ] E2E: Toggle label, verify badge appears on tile within 200ms
- [ ] E2E (with mocked 500): Toggle label, verify rollback + toast

### AC-HAPPY-3: User removes a label from a card
**Priority**: MUST

**Given** a card has one or more labels assigned AND the `LabelPicker` is open
**When** the user clicks a checked label row (or presses Space when focused)
**Then**:
  - The row's checkbox flips to unchecked immediately
  - The badge disappears from the modal's Labels display strip and the CardTile
  - PUT `/api/cards/:cardId/labels` fires with the reduced `labelIds` array
  - On error, rollback + `toast.error`

**Verification**:
- [ ] E2E: Uncheck a label, verify badge disappears from tile within 200ms
- [ ] E2E (with mocked 500): Verify rollback

### AC-HAPPY-4: User filters the board by label
**Priority**: MUST

**Given** labels exist on the board AND some are assigned to cards
**When** the user opens the Filters dropdown and toggles one or more label chips
**Then**:
  - Only cards with at least one matching label remain visible (OR logic, reuses existing `filterCards` util)
  - The Filters button shows an active count badge (already implemented)
  - Filtering applies in < 50ms (client-side)

**Verification**:
- [ ] E2E: Toggle 1 chip → verify only matching cards visible
- [ ] E2E: Toggle 2 chips → verify OR logic (cards with EITHER label visible)

### AC-HAPPY-5: User edits an existing label (rename / recolor / change emoji)
**Priority**: SHOULD

**Given** the `LabelPicker` is open
**When** the user clicks the edit pencil on a label row, modifies any field, and clicks Save
**Then**:
  - PATCH `/api/boards/:boardId/labels/:labelId` fires with the changed fields
  - On success: the row collapses with updated label; ALL CardTiles that have this label re-render with the new name / color / emoji; the Filters dropdown chip re-renders
  - On error: edit form stays open with user's changes; `toast.error("Failed to update label")`

**Verification**:
- [ ] E2E: Edit a label name, verify all card tiles update
- [ ] E2E: Edit a label color, verify badge color updates everywhere

### AC-HAPPY-6: User deletes a label from the board
**Priority**: SHOULD

**Given** the `LabelPicker` is open AND the user clicks the edit pencil on a label row
**When** they click Delete AND confirm the `window.confirm("Delete label 'X'? It will be removed from all cards.")` dialog
**Then**:
  - DELETE `/api/boards/:boardId/labels/:labelId` fires
  - CASCADE removes all `card_labels` rows for that label
  - The label row disappears from the picker
  - The label badge disappears from every CardTile that had it assigned
  - The label chip disappears from the Filters dropdown
  - On error: `toast.error("Failed to delete label")` and the row reappears

**Verification**:
- [ ] E2E: Delete a label assigned to multiple cards; verify removal everywhere
- [ ] E2E: Cancel the confirm dialog; verify nothing changes

### AC-ERROR-1: User attempts to create a duplicate label name
**Priority**: MUST

**Given** the user is creating a label in the inline form AND a label with the same name already exists on the board
**When** they submit the create form
**Then**:
  - Backend returns 409 Conflict (enforced by `UNIQUE (board_id, name)` constraint)
  - The form remains open with the user's color + emoji selections preserved
  - The name input shows an inline error: "A label with this name already exists"
  - Focus returns to the name input
  - No toast (the inline error is the recovery affordance)

**Verification**:
- [ ] E2E: Submit duplicate name → verify 409 → verify inline error → verify form intact

### AC-ERROR-2: User attempts to create a label with empty / whitespace name
**Priority**: MUST

**Given** the user is in the inline create form
**When** they click Create with an empty or whitespace-only name
**Then**:
  - Client-side validation blocks submission (no network request fires)
  - The name input shows an error state: "Label name is required"
  - The Create button remains disabled until a non-whitespace character is typed

**Verification**:
- [ ] Component: Submit empty name → assert no fetch call made, error visible

### AC-ERROR-3: Label assignment fails due to network error
**Priority**: MUST

**Given** the user toggles a label in the `LabelPicker`
**When** the PUT API call fails (network error or 5xx)
**Then**:
  - The checkbox state rolls back to its previous value (consistent with `useUpdateCard.ts` `onError` pattern)
  - The badge state on the modal and CardTile rolls back
  - A `toast.error("Failed to update labels")` appears (using `sonner`, already imported in `CardDetailModal.tsx`)
  - User can retry by toggling again

**Verification**:
- [ ] E2E (mocked 500): Toggle label → verify all 3 surfaces roll back → verify toast

### AC-NAV-1: Picker closes correctly on outside click, Escape, and modal close
**Priority**: MUST

**Given** the `LabelPicker` is open
**When** the user:
  - (a) Clicks outside the picker (but inside the modal)
  - (b) Presses Escape
  - (c) Closes the parent modal
**Then**:
  - (a) Picker closes; modal stays open; focus returns to the "Edit labels" / "+ Add labels" trigger
  - (b) Picker closes (modal stays open); focus returns to trigger. A SECOND Escape closes the modal.
  - (c) Both close cleanly; no orphaned popover

**Verification**:
- [ ] E2E: Each of (a), (b), (c) scenarios
- [ ] A11y: Focus management correct in each case

### AC-A11Y-1: Picker is fully keyboard-navigable
**Priority**: MUST

**Given** the `LabelPicker` is open
**When** the user navigates using only the keyboard
**Then**:
  - Tab moves between label rows, edit pencils, "Create new label" trigger
  - Space toggles the focused label row
  - Enter on a row opens nothing (toggles); Enter on edit pencil opens edit form; Enter on "Create new label" opens create form
  - Escape closes the picker (or, if a form is open, collapses the form first)
  - All interactive elements have visible focus indicators (reuses existing `focus:ring-2 focus:ring-primary` pattern)
  - Each label row has `role="checkbox"` and `aria-checked` reflecting assignment

**Verification**:
- [ ] E2E: Full keyboard journey from picker open to label assigned and picker closed
- [ ] A11y audit (axe-core): No critical violations on the open picker

### AC-INTEGRATION-1: API endpoints persist real data
**Priority**: MUST

**Given** the user creates a label "Bug" with color `#be123c` and emoji `🔥`
**When** the POST request completes
**Then**:
  - A row exists in `labels` table with `board_id = current board`, `name = 'Bug'`, `color = '#be123c'`, `icon = '🔥'`
  - The row has a non-null `id` (uuid)
  - Subsequent GET returns this row

**Anti-stub verification**:
- [ ] POST then GET — assert returned label matches submitted values exactly
- [ ] POST a different name — assert the GET response changes
- [ ] No placeholder text in response

---

## Test Scenarios (Derived from Acceptance Criteria)

### Happy Path Tests
1. AC-ENTRY-1: Labels section + picker trigger exists in card modal
2. AC-ENTRY-2: Filters dropdown shows ALL board labels (including unassigned)
3. AC-HAPPY-1: Create new label inline, auto-assigned to current card
4. AC-HAPPY-2: Assign existing label, optimistic badge on tile
5. AC-HAPPY-3: Remove label, optimistic disappearance
6. AC-HAPPY-4: Board filter by label (OR logic)
7. AC-HAPPY-5: Edit label, all CardTiles refresh
8. AC-HAPPY-6: Delete label, removal everywhere + CASCADE

### Error Scenario Tests
1. AC-ERROR-1: Duplicate name → 409 → inline error → form intact
2. AC-ERROR-2: Empty name → client-side block → error visible
3. AC-ERROR-3: Assign network failure → rollback + toast

### Edge Case Tests
1. AC-NAV-1: Outside click / Escape / parent modal close
2. AC-A11Y-1: Full keyboard navigation of picker

### Integration Tests
1. AC-INTEGRATION-1: POST then GET returns real persisted data

---

## Accessibility Checklist

- [ ] Picker trigger has `aria-expanded`, `aria-controls`, `aria-label="Edit labels"` / `"Add labels"`
- [ ] Each label row has `role="checkbox"` + `aria-checked` + visible focus ring
- [ ] Edit pencil has `aria-label="Edit label {name}"`
- [ ] "Create new label" trigger has visible label (not icon-only)
- [ ] Inline create / edit form: name input has `<label>` association, error has `aria-live="polite"`, color swatches have `aria-label="{color-name}"` and `aria-pressed` for selection
- [ ] Emoji input has visible label "Optional icon" and helper text "Single emoji character"
- [ ] Color is never the sole means of conveying label meaning — name is always shown next to the color swatch
- [ ] All 12 curated colors meet WCAG 2.1 AA contrast against white label text AND against the modal background tint (`color + '33'`)
- [ ] Tab order: picker trigger → first label row → its edit pencil → next label row → ... → "Create new label" trigger
- [ ] Escape key behavior: collapses open inline form first, then on second Escape closes picker, then on third Escape closes parent modal
- [ ] Picker reuses the `FiltersDropdown` mousedown + keydown outside-dismiss pattern for consistency

---

## Analytics & Observability

### Key Metrics
| Metric | Purpose | Target |
|--------|---------|--------|
| Time to create + assign first label | Sprint-planning efficiency | < 15 seconds |
| Picker open → toggle complete (existing label) | Daily-use efficiency | < 3 seconds |
| Filter chip toggle → board re-render | UX responsiveness | < 50ms (client-side) |
| Label CRUD API p95 latency | NFR adherence | < 200ms |
| Optimistic-rollback rate | Network reliability indicator | < 1% |

### Instrumentation Points (post-MVP; logged via existing pino logger)
- `label.created`: `{ boardId, labelId, name, color, hasIcon }`
- `label.assigned`: `{ boardId, cardId, labelId, totalLabelsOnCard }`
- `label.removed`: `{ boardId, cardId, labelId }`
- `label.filter_applied`: `{ boardId, activeLabelIds: string[] }`
- All emitted from the backend after-response, fire-and-forget — matches existing activity event pattern documented in `systemPatterns.md`. (Domain activity events for labels are explicitly OUT of scope per task spec; instrumentation here is for telemetry only.)

---

## Validation Checklist

- [x] Journey delivers stated value (sprint planning + daily-use both work)
- [x] All personas can complete journey (Team Member, Team Lead, Freelancer)
- [x] Errors are recoverable (409 → edit name; network → optimistic rollback)
- [x] Async states are clear (synchronous + optimistic; rollback on failure)
- [x] Consistent with existing patterns (popover matches `FiltersDropdown`; optimistic update matches `useUpdateCard`; CardTile rendering unchanged)
- [x] Accessible per WCAG 2.1 AA (keyboard, focus management, contrast, ARIA)
- [x] Testable with defined scenarios (10 happy / 3 error / 2 edge / 1 integration)

---

## Next Steps

1. **UI/UX Creative phase** (separate doc): Visual design of `LabelPicker` popover and `LabelForm`; finalize the 12-swatch palette with WCAG-verified hex values; resolve Q3 (emoji input — confirm "single character text input" vs picker)
2. **Architecture Creative phase** (separate doc): Confirm Q4 (PUT replace-all vs individual POST/DELETE — recommend PUT replace-all to match this journey's optimistic model and simplify the `useAssignLabels` hook); design `LabelService` business logic (board-scope enforcement, duplicate-name detection, CASCADE delete behavior); finalize REST endpoint shapes
3. **Phase 1 build** (backend): Migration for `icon` column; `LabelRepository`, `LabelService`, `LabelController`; routes; tests
4. **Phase 2 build** (backend): `PUT /api/cards/:cardId/labels` endpoint and tests
5. **Phase 3 build** (frontend): `LabelPicker`, `LabelForm`, hooks; modal integration; component + integration tests
6. **Phase 4 build** (frontend): `BoardView.allLabels` swap to `useLabels`; accessibility pass; E2E tests for the AC scenarios above
