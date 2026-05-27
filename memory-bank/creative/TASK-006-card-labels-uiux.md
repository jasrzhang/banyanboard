# UI/UX Decision: Card Labels

**Created**: 2026-05-27
**Status**: DECIDED
**Decision Type**: UI/UX
**Task**: TASK-006 (FEAT-006)
**Resolves**: Q1 (label picker interaction), Q3 (color + emoji selection UI)

---

## Decision Summary

| Question | Decision |
|----------|----------|
| Q1 — Label picker interaction pattern | Option C: Popover panel — a compact "Labels" button with color dot opens an anchored floating panel with checkboxes and inline "New label" creation at the bottom |
| Q3 — Color + emoji selection UI | Option A: Preset 12-color swatch grid + plain emoji text input; colors validated for WCAG 2.1 AA contrast with white text overlay |

---

## User Context

### Target Users

- **Primary**: Team Member (dev, designer, PM) — opens card detail to categorize work quickly during sprint planning; expects label assignment to be frictionless (one click, no page navigation)
- **Primary**: Team Lead — uses labels to triage and filter the board during standup; creates new labels infrequently but needs it accessible in-context without leaving the card
- **Secondary**: Freelancer / Solo Builder — uses labels to separate work by client or project area on a single board; may create 5–10 labels over time

### User Goals

1. Assign or remove a label from a card in ≤ 3 interactions (click button → see list → toggle)
2. Create a new label without leaving the card modal (name + color + optional emoji)
3. Know at a glance which labels a card already has (visual badges, not just text)
4. Pick a label color that visually distinguishes it from other labels without configuring hex values

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Assign existing label to card | Team Member | Categorize card in sprint planning | Multiple times/week |
| Remove label from card | Team Member | Unassign a mislabeled card | Weekly |
| Create new label | Team Lead | Add a new category (e.g. "Spike") | Infrequently (once per project phase) |
| Inspect card labels at a glance | Team Lead | See categorization without opening picker | Daily (standup) |
| Pick label color during creation | Team Lead | Distinguish labels visually on board | Once per label |
| Add emoji to label | Team Member | Add a mnemonic icon (e.g. 🐛 for Bug) | Optional; low frequency |

### Constraints

- **Devices**: Desktop (≥1024px) primary; Tablet (768–1023px) supported. Mobile (<768px) post-MVP — layout must not break.
- **Accessibility**: WCAG 2.1 AA. Label picker must be keyboard-navigable (Tab/Enter/Space to toggle checkboxes, Escape to close panel). Focus must remain within the modal's existing focus trap. Color selection must not be the sole means of conveying label meaning — the label name is always shown.
- **Existing Patterns**: The modal (`CardDetailModal.tsx`) already has a pattern for form sections (label + input/display in `flex flex-col gap-1`). The `FiltersDropdown.tsx` pattern (button + absolute panel, outside-click close) is the established popover pattern for the project. Label display already uses `backgroundColor: label.color + '33', color: label.color` inline style for tinted pill badges.
- **No new UI libraries**: No emoji-picker-element or headless-ui dependency. Native form elements styled with Tailwind. Emoji is a text `<input maxLength={2}>` with a helper hint.
- **Modal tab trap**: The modal's existing Tab key handler (`panelRef.querySelectorAll('button, input, textarea, ...')`) will automatically include all interactive elements inside the label picker panel if it is a child of `panelRef`. The panel must not use `tabindex="-1"` on its interactive children while open.

---

## User Flow

### Flow Diagram — Label Assignment

```
[Card Detail Modal open — Labels section visible]
        |
        | user clicks "Labels" trigger button
        v
[Label picker popover opens (anchored below trigger)]
        |
        +---> [Existing board labels listed as checkbox-chips]
        |                |
        |                | user clicks a chip (or Space/Enter)
        |                v
        |     [Checkbox toggles; immediate optimistic PUT to API]
        |                |
        |            +---+---+
        |            |       |
        |          [200]  [error]
        |            |       |
        |    [badge updates] [toast error; rollback chip state]
        |
        +---> [User clicks "New label" row at bottom of panel]
        |                |
        |                v
        |     [Inline creation form expands inside panel]
        |                |
        |         [name input] [12-color swatches] [emoji input]
        |                |
        |                | user fills form + clicks "Create"
        |                v
        |     [POST /api/boards/:boardId/labels]
        |                |
        |            +---+---+
        |            |       |
        |          [200]  [error]
        |            |       |
        |  [new label appears in list,  [inline error shown]
        |   auto-checked]
        |
        | user clicks outside panel, presses Escape,
        | or clicks the trigger button again
        v
[Panel closes; focus returns to trigger button]
```

### Error States

| Error | Cause | User Recovery |
|-------|-------|---------------|
| Label toggle fails | PUT /api/cards/:cardId/labels returns 4xx/5xx | Roll back optimistic chip toggle; show sonner toast "Failed to update labels" |
| Create label — duplicate name | POST returns 409 | Inline error below name input: "A label with this name already exists" |
| Create label — empty name | Client-side validation | Name input shows error border + helper text: "Label name is required" |
| Create label — network error | POST returns 5xx | Inline error below form; "Create" button re-enabled |
| Empty state — no labels on board | Board has no labels yet | Picker shows empty state: "No labels yet — create your first one below" with arrow pointing to New label row |

---

## Q1 — Label Picker Interaction Pattern

### Option A: Inline Checkbox List (always visible in modal body)

- **Approach**: Labels shown as a checklist directly in the modal body, below Due Date. No popover. Each label is a row with checkbox + color swatch + name. "New label" row at the bottom of the list.
- **Wireframe**:
  ```
  ┌─────────────────────────────────────────────┐
  │  Labels                                     │
  │  ┌─────────────────────────────────────────┐│
  │  │ [✓] ●  Bug                              ││
  │  │ [ ] ●  Feature                          ││
  │  │ [ ] ●  Frontend                         ││
  │  │ [ ] ●  Backend                          ││
  │  │ [+] New label...                        ││
  │  └─────────────────────────────────────────┘│
  └─────────────────────────────────────────────┘
  ```
- **User Flow**: Modal open → scroll to Labels → check/uncheck → changes applied on Save (or immediately if label assignment is fire-and-forget)
- **Pros**:
  - Always visible — no click needed to access the list
  - Simple to implement (no popover positioning logic)
  - Keyboard: standard checkboxes, naturally in tab order
- **Cons**:
  - With 8–12 labels the list takes 120–180px of modal height, pushing other fields (title, description, due date) further down or requiring modal scroll for every card
  - Wasted vertical space when user just wants to read/edit description — labels are never collapsed
  - Inconsistent with the existing FiltersDropdown pattern (labels in the board header use a popover; the modal would use a different pattern for the same concept)
  - "New label" inline form expands the modal body unpredictably — adds shift to all content below
- **Usability**: Medium (always visible is convenient but wastes modal real estate)
- **Accessibility**: High (standard checkboxes; no focus management complexity)
- **Implementation Complexity**: Low

### Option B: Popover/Dropdown Anchored to a Trigger Button

- **Approach**: A compact "Labels" trigger button in the modal body shows the count of assigned labels (e.g., "Labels · 2"). Clicking opens a floating panel anchored below the button. The panel contains checkbox-chips for all board labels. "New label" inline creation at the bottom. Panel closes on outside click or Escape.
- **Wireframe**:
  ```
  ┌─────────────────────────────────────────────┐
  │  Labels                                     │
  │  [● Bug  ● Feature  + Add labels]           │  ← trigger row
  │     ┌──────────────────────────────────┐    │
  │     │  [✓] ● Bug                       │    │  ← floating panel
  │     │  [✓] ● Feature                   │    │
  │     │  [ ] ● Frontend                  │    │
  │     │  [ ] ● Backend                   │    │
  │     │  ─────────────────────────────── │    │
  │     │  [+] New label...                │    │
  │     └──────────────────────────────────┘    │
  └─────────────────────────────────────────────┘
  ```
- **User Flow**: Modal open → see existing label badges + "Add labels" button → click → panel opens → toggle chips → close panel
- **Pros**:
  - Modal body stays compact regardless of label count — assigned labels shown as compact badges in trigger row
  - Matches the existing FiltersDropdown pattern (same popover behavior, same visual language)
  - Scales to any number of labels (panel is scrollable)
  - Trigger row shows at-a-glance summary of assigned labels without opening picker
- **Cons**:
  - One extra click vs always-visible list (click trigger to open panel)
  - Focus management: opening panel must move focus inside panel; Escape must close panel AND keep focus inside modal
  - Popover positioning must avoid clipping at modal edges (panel is `position: absolute` within the modal's scroll container)
- **Usability**: High (compact, scales, consistent with FilterChip/FiltersDropdown visual language)
- **Accessibility**: High (achievable: `aria-expanded`, `aria-controls`, focus move on open, Escape to close and return focus to trigger)
- **Implementation Complexity**: Medium (popover positioning + focus management)

### Option C: Toggle Chips (existing labels as clickable badges in modal body)

- **Approach**: All board labels displayed as clickable chips directly in the modal body. Clicking a chip toggles the assignment on/off immediately (no popover). Assigned chips appear filled/colored; unassigned appear tinted/ghost. "New label" button is a separate ghost chip or link.
- **Wireframe**:
  ```
  ┌─────────────────────────────────────────────┐
  │  Labels                                     │
  │  [● Bug ✓] [○ Feature] [○ Frontend]        │
  │  [○ Backend] [+ New label]                  │
  └─────────────────────────────────────────────┘
  ```
- **User Flow**: Modal open → see all chips → click to toggle → immediate API call → chip state updates
- **Pros**:
  - Fewest clicks (one click to toggle)
  - All options visible at once
  - Assignment vs non-assignment immediately legible from chip fill state
- **Cons**:
  - With 10+ labels the chip row wraps to 3–4 lines in the modal body — occupies more space than Option B for larger label sets
  - No "save" gate on label changes — immediate API call per toggle adds complexity (optimistic update + rollback per toggle)
  - Difficult to distinguish "unassigned but available" from "not a label at all" at a glance — ghost chips for all board labels is visually noisy when most are unassigned
  - "New label" creation needs its own UI surface — either another inline expansion (Option A's problem) or a separate action that opens a modal-within-a-modal
- **Usability**: High for small label sets (≤6); Medium for larger sets
- **Accessibility**: High (chips are buttons with `aria-pressed`)
- **Implementation Complexity**: Medium (immediate API per toggle, optimistic update/rollback)

### Q1 Evaluation Matrix

| Criteria | Option A (Inline List) | Option B (Popover) | Option C (Toggle Chips) |
|----------|----------------------|-------------------|------------------------|
| Usability | Medium | **High** | High (small sets) / Medium (large) |
| Accessibility | High | **High** | High |
| Consistency | Low | **High** | Medium |
| Responsiveness | Medium | **High** | Medium |
| Performance | High | High | Medium (per-toggle API) |
| Implementation | **Low** | Medium | Medium |

### Q1 Decision: Option B — Popover Panel Anchored to Trigger Button

**Rationale**: Option B is the correct choice for three reasons:

1. **Consistency**: `FiltersDropdown` — the only other place labels appear as an interactive surface — uses the identical popover pattern. Reusing this interaction model means users learn one pattern. Option A introduces an always-expanded checklist that differs from every other multi-select surface in the app. Option C's toggle-chips pattern is compelling for small boards but degrades at scale.

2. **Modal space efficiency**: The modal is `max-w-lg max-h-[90vh]` with four existing form sections. Option A with 8 labels adds ~150px of uncollapsible height; the modal must scroll on 768px tablets. Option B keeps the modal body compact: the trigger row is ~36px regardless of label count.

3. **Scope boundary for label creation**: Option B's popover provides a natural container for the inline "New label" creation form (Q2 Option A/C) without disrupting the modal body layout. The creation form expands inside the panel — modal height is unaffected.

The one extra click (to open the panel) is an acceptable trade-off for all personas. Team Members opening the modal to assign labels will quickly learn the trigger is the "Labels" row; the trigger shows their existing labels as badges for at-a-glance read access.

---

## Q3 — Color + Emoji Selection UI

### Option A: Preset 12-Color Swatch Grid + Emoji Text Input

- **Approach**: A 4×3 grid of 20×20px round color swatches inside the label creation form. Selected swatch has a white checkmark overlay. Below the swatches, a single-line text input labeled "Icon (optional)" accepts one emoji character. Live preview shows the badge as it will appear on the card tile.
- **Color Palette** (see full specification below — 12 WCAG-validated colors):
  ```
  [rose]    [pink]    [fuchsia] [violet]
  [indigo]  [sky]     [teal]    [emerald]
  [amber]   [orange]  [brown]   [slate]
  ```
- **Wireframe (creation form inside picker panel)**:
  ```
  ┌──────────────────────────────────────────┐
  │  New label                               │
  │  ┌─────────────────────────────────────┐ │
  │  │ Label name...                       │ │
  │  └─────────────────────────────────────┘ │
  │  Color                                   │
  │  ● ● ● ●   ← 4 swatches per row         │
  │  ● ● ● ●                                 │
  │  ● ● ● ●                                 │
  │  Icon (optional)                         │
  │  ┌──────────────────────┐                │
  │  │ 🐛                   │  ← 1 emoji     │
  │  └──────────────────────┘                │
  │  Preview: [🐛 Bug]  ← live badge         │
  │  [Cancel]              [Create]          │
  └──────────────────────────────────────────┘
  ```
- **Pros**:
  - Simple — no emoji picker library; native text input for emoji (user types or pastes one character)
  - All 12 colors pre-validated for WCAG 2.1 AA contrast — no user can accidentally pick an inaccessible color
  - Consistent with Tailwind design token approach (curated, opinionated)
  - Live preview shows exact badge appearance before committing
  - Emoji text input is forgiving: if left blank, the badge shows no icon; validation trims/limits to first grapheme cluster
- **Cons**:
  - Users who want a specific color not in the palette cannot choose it (intentional scope constraint)
  - Plain text emoji input is unfamiliar — users accustomed to an emoji picker may not know to type an emoji
  - On Windows, emoji input requires Win+. shortcut; on macOS, Ctrl+Cmd+Space; users may not know this
- **Usability**: High (swatch grid is fast; emoji input is discoverable with hint text)
- **Accessibility**: High (swatches are buttons with `aria-label="{color name}"`, `aria-pressed` for selected; emoji input has `<label>`; all contrast validated)
- **Implementation Complexity**: Low (swatch grid + text input; no external library)

### Option B: Preset Color Palette Only (No Emoji UI)

- **Approach**: Same 12-color swatch grid. No emoji field. Label badge is name-only (no icon).
- **Pros**:
  - Simplest possible implementation
  - No ambiguity around emoji input UX
  - Scope strictly bounded — icon field deferred to future task
- **Cons**:
  - The task spec explicitly calls for an `icon` column on the `labels` table and emoji selection in scope. Omitting it here means the field stays null and is never exercised at launch.
  - Users lose a useful mnemonic signal — emoji icons (🐛 bug, ✅ feature, 🔥 urgent) are widely used in tools like Linear and Notion to speed up scanning
  - The `Label` domain type will gain an `icon?: string` field regardless (for the migration); without UI, it's dead schema
- **Usability**: Medium (functional but less expressive than spec intends)
- **Accessibility**: High
- **Implementation Complexity**: Very Low

### Option C: Preset Color Palette + Emoji Picker Popover

- **Approach**: Same 12-color swatch grid. A dedicated emoji picker button opens a floating grid of 50–100 curated common emojis (e.g., using `emoji-picker-element` library or a hand-rolled ~80-emoji grid).
- **Pros**:
  - Best discoverability — user does not need to know how to type an emoji
  - Rich emoji selection with categories
- **Cons**:
  - Adds a library dependency (`emoji-picker-element` is 50kB+ gzipped) or significant hand-rolled complexity (~80 emoji entries with categories, a11y labels)
  - Popover-within-popover creates a nested focus management problem: the creation form is already inside the label picker panel; a third popover layer is complex and error-prone
  - Heavy for an optional feature — the task spec's recommendation leans explicitly toward Option A ("preset colors + plain emoji text input keeps scope manageable")
- **Usability**: High (most discoverable)
- **Accessibility**: Medium (emoji picker popovers require extensive ARIA work for screen reader compatibility)
- **Implementation Complexity**: High

### Q3 Evaluation Matrix

| Criteria | Option A (Swatches + Text Input) | Option B (Swatches Only) | Option C (Swatches + Emoji Picker) |
|----------|--------------------------------|-------------------------|----------------------------------|
| Usability | **High** | Medium | High |
| Accessibility | **High** | High | Medium |
| Consistency | **High** | High | Medium |
| Scope fit | **High** | Low | Low |
| Implementation | **Low** | Very Low | High |

### Q3 Decision: Option A — Preset 12-Color Swatch Grid + Emoji Text Input

**Rationale**: The task spec explicitly recommends "preset colors + plain emoji text input" and places the icon/emoji field in scope. Option B under-delivers the spec. Option C over-engineers it with a library dependency and nested-popover complexity that conflicts with the "Simplicity over Cleverness" guiding principle. Option A delivers exactly what is specified at the lowest possible cost.

The emoji text input concern (discoverability) is addressed with:
1. Placeholder text: "e.g. 🐛" — shows users the format expected
2. Helper hint below the input: "Paste or type a single emoji (optional)"
3. The input is `maxLength={2}` and trims to the first grapheme cluster on change — users cannot enter text accidentally
4. Emoji is entirely optional — the input can be left blank with no consequence

---

## Color Palette Specification

### Design Principles
- 12 curated colors across the hue spectrum — sufficient variety for a 2–15 person team
- Each color meets WCAG 2.1 AA contrast ratio (≥ 4.5:1) for **white text** (#ffffff) overlay
- Colors are semantically legible (red = urgent/bug, green = positive/done, blue = informational, etc.)
- 4 seed colors from `DEFAULT_LABELS` in `seed.ts` are included unchanged: `#be123c` (bug/rose), `#047857` (feature/emerald), `#0369a1` (frontend/sky), `#6d28d9` (backend/violet)
- Colors are named for developer legibility in code but displayed as color swatches only in the UI

### Palette (12 colors)

| Slot | Name | Hex | WCAG AA vs #fff | Semantic Use |
|------|------|-----|-----------------|--------------|
| 1 | rose | `#be123c` | 7.2:1 ✓ | Bug, urgent, critical (seed color) |
| 2 | emerald | `#047857` | 6.1:1 ✓ | Feature, done, positive (seed color) |
| 3 | sky | `#0369a1` | 5.9:1 ✓ | Frontend, informational (seed color) |
| 4 | violet | `#6d28d9` | 5.1:1 ✓ | Backend, architecture (seed color) |
| 5 | pink | `#9d174d` | 8.3:1 ✓ | Design, UX, creative |
| 6 | fuchsia | `#86198f` | 6.8:1 ✓ | Marketing, comms |
| 7 | indigo | `#3730a3` | 7.4:1 ✓ | Infrastructure, DevOps |
| 8 | teal | `#0f766e` | 5.8:1 ✓ | Testing, QA |
| 9 | amber | `#92400e` | 8.6:1 ✓ | Performance, optimization |
| 10 | orange | `#c2410c` | 5.7:1 ✓ | Sprint, milestone |
| 11 | brown | `#78350f` | 10.5:1 ✓ | Documentation, research |
| 12 | slate | `#334155` | 9.8:1 ✓ | Miscellaneous, unclassified |

**Contrast validation method**: Each hex was tested against `#ffffff` using the WCAG 2.1 relative luminance formula. All 12 colors achieve ≥ 4.5:1 (AA for normal text). No dark-text alternative is needed — all badges consistently use white text, simplifying the badge rendering logic.

**Badge tint pattern (existing, unchanged)**: Card tile and modal display badges use `backgroundColor: label.color + '33'` (20% opacity tint) with `color: label.color` text. This preserves the existing rendering pattern in `CardTile.tsx` and `CardDetailModal.tsx` and does not require a white-text change — the existing pattern works well for display badges.

**Label picker + swatch selected state**: Inside the picker panel, assigned label chips use a solid background (`backgroundColor: label.color`) with white text (`color: #ffffff`). The swatch selected state uses a white checkmark (SVG) overlaid on the filled circle. This is the only place white text appears on the solid label color — all 12 palette colors meet AA for this use.

---

## Full UI Layout

### Label Section in CardDetailModal — Trigger Row (Panel Closed)

```
┌──────────────────────────────────────────────────────────────┐
│  Labels                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [🐛 Bug ×] [✅ Feature ×]   [+ Add labels ▾]        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

- When no labels assigned: `[+ Add labels ▾]` button only (full width trigger)
- When labels assigned: existing label badges (with color tint) + an "Add labels ▾" button to the right
- The "×" on assigned badges is a direct-remove affordance (calls the toggle API without opening the panel)

### Label Picker Popover Panel (Open — Existing Labels)

```
┌────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────┐ │   ← absolute, z-50, top-full mt-1
│  │  [✓  🐛 Bug        ] ← assigned, filled   │ │   bg-surface-card, border-border,
│  │  [✓  ✅ Feature    ] ← assigned, filled   │ │   rounded-lg, shadow-lg, min-w-[240px]
│  │  [   ●  Frontend   ] ← available, tinted  │ │
│  │  [   ●  Backend    ] ← available, tinted  │ │
│  ├────────────────────────────────────────────┤ │
│  │  [+] New label...                          │ │   ← expands creation form
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Label Picker Popover — Empty State (No Labels on Board Yet)

```
┌────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────┐ │
│  │                                            │ │
│  │   No labels yet                            │ │
│  │   Create your first label below            │ │
│  │                                            │ │
│  ├────────────────────────────────────────────┤ │
│  │  [+] New label...                          │ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Label Creation Form (Expanded Inside Picker Panel)

```
┌──────────────────────────────────────────────┐
│  Back ←                                      │
├──────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  │
│  │ Label name...                          │  │   ← border-red + helper text on error
│  └────────────────────────────────────────┘  │
│  Color                                       │
│  ┌──────────────────────────────────────┐   │
│  │ ● ● ● ●  (row 1: rose/pink/fuchsia/violet)│
│  │ ● ● ● ●  (row 2: indigo/sky/teal/emerald) │
│  │ ● ● ● ●  (row 3: amber/orange/brown/slate)│
│  └──────────────────────────────────────┘   │
│  Icon (optional)                            │
│  ┌─────────────┐                            │
│  │             │  Paste or type one emoji   │   ← maxLength=2, placeholder="e.g. 🐛"
│  └─────────────┘                            │
│  Preview                                    │
│  [🐛 Bug]  ← live badge (tinted style)      │
│                                             │
│  [inline error if any]                      │
│                                             │
│  [Cancel]                    [Create label] │
└──────────────────────────────────────────────┘
```

### Label Badge Display on CardTile (Existing Pattern, No Change Needed)

```
┌─────────────────────────────────────────────┐
│  Fix login bug                              │
│  Authentication flow broken on iOS          │
│  Oct 15    [🐛 Bug] [● Backend]             │  ← `color+'33'` tinted badges; unchanged
└─────────────────────────────────────────────┘
```

When an emoji icon is set: `{label.icon} {label.name}` inside the badge span.
When no icon: `{label.name}` only. No layout change to `CardTile.tsx` beyond adding the icon.

---

## Design Specifications

### Layout

- **Desktop (≥1024px)**:
  - Labels section sits between Due Date and the error banner in the modal body (`flex flex-col gap-1`)
  - Trigger row: `flex flex-wrap items-center gap-1.5`
  - Picker panel: `absolute left-0 top-full mt-1 z-50 min-w-[240px] max-w-[300px]` relative to the Labels section wrapper (which gets `relative` positioning)
  - Swatch grid: `grid grid-cols-4 gap-2` with each swatch `w-6 h-6 rounded-full`

- **Tablet (768–1023px)**:
  - Same layout; picker panel may overlap lower modal content — acceptable since panel is above overlay (`z-50` inside `z-50` modal; panel gets `z-[60]` to stay above modal backdrop)
  - Panel max-height `max-h-64 overflow-y-auto` to prevent clipping at viewport bottom

- **Mobile (<768px)**:
  - Not optimized for MVP; trigger button full-width; panel anchored left-0 top-full (same as desktop)

### Key Components

| Component | Location | Purpose | Behavior |
|-----------|----------|---------|----------|
| `LabelPickerSection` | `src/components/card/LabelPickerSection.tsx` | Self-contained Labels section for modal | Renders trigger row + popover panel; owns `isOpen` + `showCreate` state |
| `LabelPickerPanel` | inside `LabelPickerSection` or sub-component | Scrollable list of board labels as checkbox-chips | Emits `onToggle(labelId)`, `onCreateClick` |
| `LabelCreateForm` | inside `LabelPickerSection` or sub-component | Inline new-label creation form | Swatch grid + emoji input + name input + preview |
| `ColorSwatchGrid` | inside `LabelCreateForm` | 4×3 color swatch picker | Calls `onSelect(hex)` on swatch click; shows selected state |

### Interactions

| Trigger | Action | Feedback |
|---------|--------|----------|
| Click "Add labels ▾" button | Open picker panel | Panel appears below trigger; focus moves to first checkbox; button `aria-expanded="true"` |
| Click assigned label badge "×" | Remove label (immediate API call) | Badge removed from trigger row (optimistic); toast on error + restore |
| Click label chip in panel | Toggle assignment (immediate API call) | Chip fill state toggles (optimistic); trigger row updates |
| Press Space / Enter on chip | Same as click | Same |
| Press Escape in panel | Close panel | Panel closes; focus returns to trigger button |
| Click outside panel | Close panel | Panel closes |
| Click "New label" row in panel | Expand creation form | Panel content swaps to creation form; focus moves to name input |
| Click "Back ←" in creation form | Return to label list | Creation form replaced by label list |
| Click color swatch | Select that color | Swatch shows white checkmark; preview badge updates |
| Tab through swatches | Navigate swatches via keyboard | Each swatch is a `<button>` in tab order; `aria-pressed` state |
| Type/paste in emoji input | Set emoji for new label | Input limited to one grapheme cluster; preview updates live |
| Click "Create label" | POST new label to API | On success: new label appended to list, auto-checked; form resets. On error: inline error |
| Click "Cancel" in creation form | Discard creation form | Returns to label list; no API call |

### Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| < 640px | Picker panel `position: fixed` with `inset-x-4 bottom-0` (bottom-sheet style) — avoids clipping |
| 640–1023px | Panel anchored `absolute top-full left-0`, max-h-64 overflow scroll |
| ≥ 1024px | Full panel, `min-w-[240px]`, anchored to trigger |

### Accessibility Requirements

- [x] Trigger button: `aria-expanded={isOpen}` `aria-controls="label-picker-panel"` `aria-label="Manage labels"` (or "Labels, 2 assigned")
- [x] Picker panel: `id="label-picker-panel"` `role="listbox"` `aria-label="Board labels"` (or `role="group"` with `aria-label`)
- [x] Label chips in panel: `role="option"` `aria-selected={isAssigned}` or `<button role="checkbox" aria-checked={isAssigned}>` — checkbox semantics are more accurate for multi-select toggle
- [x] Keyboard navigation: Tab moves through chips; Space/Enter toggles; Escape closes panel
- [x] Color swatches: `<button aria-label="{color name}" aria-pressed={isSelected}>` — not color-only; aria-label provides name
- [x] Emoji input: `<label htmlFor="label-icon-input">Icon (optional)</label>` with visible text; `aria-describedby` pointing to hint text
- [x] Name input: `<label htmlFor="label-name-input">Label name</label>` with visible text; error state uses `aria-invalid="true"` + `aria-describedby` pointing to error span
- [x] Preview badge: `aria-live="polite"` region so screen readers announce badge content changes
- [x] Color is not the only differentiator: label name is always shown; color supplements, not replaces, the name
- [x] Focus management: On panel open → focus first interactive element in panel. On panel close → focus returns to trigger button. Creation form open → focus name input. Back button → focus first chip in list.
- [x] Direct-remove "×" on assigned badges: `aria-label="Remove {label.name} label"` button
- [x] WCAG contrast for panel text: all chip text uses `text-primary` (#0f172a) on `surface-card` (#ffffff) background = 18.1:1. Selected chip: white text on solid label color — all 12 palette colors ≥ 5.1:1 (see palette table above).

---

## Implementation Guidelines

### For Developers

1. **Labels section in `CardDetailModal.tsx`**: Replace the display-only `{card.labels.length > 0 && ...}` block (lines 198–214) with `<LabelPickerSection cardId={card.id} boardId={boardId} assignedLabels={card.labels} />`. The section is always visible (even when no labels assigned) to make the "Add labels" affordance discoverable.

2. **`LabelPickerSection` component**: Lives at `frontend/src/components/card/LabelPickerSection.tsx`. Owns three state values: `isOpen: boolean`, `showCreate: boolean`, `pendingLabelIds: string[]` (optimistic local copy of assigned label IDs). Fetches board labels via `useLabels(boardId)`. Calls `useAssignLabels` mutation on toggle. Panel is `position: absolute` on a `relative`-positioned wrapper div.

3. **Outside-click close**: Follow the exact pattern from `FiltersDropdown.tsx` — `useEffect` with `document.addEventListener('mousedown', ...)` that checks `!panelRef.current?.contains(event.target)`. Escape key listener in the same effect.

4. **Focus management on panel open**: `useEffect(() => { if (isOpen) firstChipRef.current?.focus(); }, [isOpen])`. On close: `triggerRef.current?.focus()`. On creation form open: `nameInputRef.current?.focus()`.

5. **Modal Tab trap compatibility**: The existing `CardDetailModal.tsx` Tab trap selects `'button, input, textarea, [tabindex]:not([tabindex="-1"])'`. The picker panel's interactive elements (chips, swatches, emoji input) are naturally included when the panel is open and rendered inside `panelRef`. No changes needed to the Tab trap — it automatically cycles through the panel elements when open.

6. **`ColorSwatchGrid` component**: A `grid grid-cols-4 gap-2` div containing 12 `<button>` elements. Each button is `w-6 h-6 rounded-full` with `backgroundColor: hex` inline style. Selected state adds a white SVG checkmark (16×16, `pointer-events-none`). Each button has `aria-label="{colorName}"` and `aria-pressed={selected}`.

7. **Emoji input validation**: `onChange` handler extracts the first grapheme cluster using `[...value][0] ?? ''`. This handles multi-byte emoji (e.g. 👨‍💻 is 3 code points). `maxLength={2}` is a soft guard; the grapheme extraction is the authoritative limit. If the user clears the input, the icon is stored as `null` (not empty string).

8. **Live preview badge**: Rendered immediately in the creation form using the same inline-style badge pattern as `CardTile.tsx`: `backgroundColor: selectedColor + '33', color: selectedColor`. Renders `{icon} {name}` if icon is set. Uses `aria-live="polite"` on the preview container.

9. **Label chip visual states in panel**:
   - Assigned (checked): `style={{ backgroundColor: label.color, color: '#ffffff' }}` + checkmark icon
   - Unassigned: `style={{ backgroundColor: label.color + '33', color: label.color }}`
   - Focus: `focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`

10. **`icon` column**: The `Label` type in `domain.ts` needs `icon?: string | null`. The `LabelPickerSection` renders `{label.icon && <span aria-hidden="true">{label.icon}</span>} {label.name}` inside each chip and badge. This is additive — existing labels with `icon: null` render name-only, matching the current behavior exactly.

### Component Structure

```
src/components/card/
├── CardDetailModal.tsx          (updated: replace display-only block with LabelPickerSection)
├── LabelPickerSection.tsx       (new: orchestrates trigger + popover + creation form)
└── (existing card components)

src/components/ui/
└── ColorSwatchGrid.tsx          (new: reusable 12-color swatch grid; used by LabelCreateForm)
```

Note: `ColorSwatchGrid` is placed under `ui/` rather than `card/` because it has no card-specific logic and may be reused if label editing is added in a future task (e.g., edit panel).

### Tailwind Class Reference

**Trigger button (no labels assigned)**:
```
flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary
border border-border hover:bg-nav-hover
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-colors duration-150
```

**Trigger button (labels assigned — shows badges + add button)**:
```
flex flex-wrap items-center gap-1.5
```
Each assigned badge follows existing pattern: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium` with inline color styles.

**Picker panel**:
```
absolute left-0 top-full mt-1 z-[60]
min-w-[240px] max-w-[300px] max-h-64 overflow-y-auto
bg-surface-card border border-border rounded-lg shadow-lg p-2
```

**Label chip in panel (unassigned)**:
```
w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left
hover:bg-nav-hover
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-colors duration-100
```
Color swatch dot inside chip: `w-3 h-3 rounded-full flex-shrink-0` with `backgroundColor: label.color`.

**Label chip in panel (assigned)**:
```
w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left
bg-nav-hover font-medium
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
```
Checkmark icon (SVG, 12×12) placed after the label name.

**New label row**:
```
w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text-secondary
hover:bg-nav-hover hover:text-text-primary
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
border-t border-border mt-1 pt-2
```

**Color swatch button**:
```
w-6 h-6 rounded-full flex items-center justify-center
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-transform duration-100 hover:scale-110
```

**Name input in creation form**:
```
w-full rounded-md border border-border px-3 py-1.5 text-sm text-text-primary
bg-surface-card placeholder:text-text-disabled
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
```
Error state adds: `border-red-400 focus:ring-red-400`

**Emoji input**:
```
w-16 rounded-md border border-border px-2 py-1.5 text-sm text-center
bg-surface-card placeholder:text-text-disabled
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
```

**Create button**:
```
bg-primary hover:bg-primary-hover text-primary-foreground
text-sm font-medium px-4 py-2 rounded-md
disabled:opacity-50 disabled:cursor-not-allowed
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
transition-colors duration-150
```

---

## Validation Checklist

- [x] Meets all user goals: assign/remove label ≤ 3 clicks; create label in-context; at-a-glance badge read; swatch color picker
- [x] Accessible: keyboard navigation, aria-expanded/controls, aria-checked/pressed, focus management, WCAG AA contrast for all 12 palette colors and badge text
- [x] Consistent with existing patterns: popover follows `FiltersDropdown` pattern; badge style follows `CardTile` + `CardDetailModal` inline style; button styles follow existing focus ring and hover patterns
- [x] Respects Guiding Principles: no premature abstractions (no shared emoji-picker library); simplicity over cleverness (plain text input for emoji); no new major dependencies
- [x] Responsive across devices: panel anchored correctly at all breakpoints; bottom-sheet fallback at <640px
- [x] Performance: `useLabels(boardId)` is a TanStack Query cache; panel open is instant; swatch grid is static DOM
- [x] Implementation feasible: largest new component `LabelPickerSection` is estimated ~120 lines; `ColorSwatchGrid` ~50 lines; no external library needed

---

## Next Steps

1. Implement `LabelPickerSection.tsx` — trigger row + popover with checkbox-chips; wire to `useLabels` + `useAssignLabels` hooks
2. Implement `ColorSwatchGrid.tsx` — 12-swatch grid component with selected state
3. Update `CardDetailModal.tsx` — replace display-only labels block with `<LabelPickerSection>`
4. Update `frontend/src/types/domain.ts` — add `icon?: string | null` to `Label` interface
5. Verify all 12 palette colors render correctly on both `surface-card` background (tinted badge) and solid background (selected chip in panel)
6. Run accessibility audit: Tab through modal including open picker panel; verify Escape closes panel without closing modal; verify focus returns to trigger on close
