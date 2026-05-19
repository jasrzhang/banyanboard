# UI/UX Decision: Card Detail Modal + Search/Filter

**Created**: 2026-05-19
**Status**: DECIDED
**Decision Type**: UI/UX
**Task**: TASK-004 (FEAT-004)
**Resolves**: Q1 through Q5

---

## Decision Summary

| Question | Decision |
|----------|----------|
| Q1 — Modal rendering strategy | Option B: Route-based modal at `/boards/:boardId/cards/:cardId`; rendered as overlay via `<Outlet>` inside `BoardView` |
| Q2 — Inline edit vs read/edit toggle | Option A: All fields immediately editable when modal opens (Linear/Jira pattern) |
| Q3 — Save trigger | Option A: Single "Save" button, disabled when no changes, loading state on submit |
| Q4 — BoardHeader context threading | Option B: Move `BoardHeader` rendering from `AppShell` into `BoardView`; `AppShell` renders a generic top bar for non-board pages |
| Q5 — Label chip placement in BoardHeader | Option C: Single row with "Filters" dropdown button revealing chip panel |

---

## User Context

### Target Users

- **Primary**: Team Member (individual contributor) — wants to quickly view and update a card's details without leaving the board context. Frequently edits titles, descriptions, due dates, and labels.
- **Primary**: Team Lead — needs to inspect card status at a glance, update due dates during standup, and apply labels for triage. Uses search to find cards across a busy board.
- **Secondary**: Freelancer / Solo Builder — manages work on a single board; uses label filters to segment work by client or project area.

### User Goals

1. Open a card, read its full details, and edit any field without navigating to a separate page
2. Close the modal easily (Escape, backdrop click, back button) to return to the board
3. Filter the board by label or due-date status without losing sight of the columns
4. Search by card title to quickly locate a specific card among many
5. Save card edits confidently with clear feedback on success or failure

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Inspect card details | Team Member | Read description and due date | Multiple times daily |
| Edit card title/description | Team Member | Update work details inline | Several times per week |
| Change due date | Team Lead | Re-prioritize during standup | Weekly |
| Add/remove label on card | Team Member | Categorize or tag work | Weekly |
| Filter by label | Team Lead | See only Bug or Design cards | Daily during standup |
| Filter overdue cards | Team Lead | Spot stale work | Weekly |
| Search by title | Team Member | Find a specific card by name | Several times per week |

### Constraints

- **Devices**: Desktop (≥1024px) primary; Tablet (768–1023px) supported. Mobile (<768px) is post-MVP — design must not break at narrow widths but is not optimized for touch.
- **Accessibility**: WCAG 2.1 AA best-effort. Modal must trap focus, respond to Escape, return focus on close. Search input must have a visible label. Filter chips must have accessible names. Color contrast ≥ 4.5:1 for all text.
- **Existing Patterns**: TailwindCSS utility classes only (no component library). Token names from `tailwind.config.ts`: `surface-card`, `surface-page`, `primary`, `primary-hover`, `primary-foreground`, `border`, `border-strong`, `text-primary`, `text-secondary`, `text-disabled`, `nav-hover`, `nav-active`, `nav-activeBg`. Label chip pattern: `backgroundColor: label.color + '33'`, `color: label.color` inline styles. Button pattern: `bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`. Error pattern from `AddCardForm`: stay open on error, show error inline, let user retry.
- **No new dependencies**: No date-picker or rich-text library. Native `<input type="date">` for due date. Plain `<textarea>` for description.
- **Router**: React Router DOM v6 `createBrowserRouter`. Route `/boards/:boardId/cards/:cardId` already registered with `CardDetailPlaceholderPage`. This will be replaced by the real modal.

---

## User Flow

### Flow Diagram — Card Detail Modal

```
[Board View — card grid]
        |
        | user clicks CardTile body button
        v
[Router navigates to /boards/:boardId/cards/:cardId]
        |
        | BoardView renders <Outlet> — modal mounts as overlay
        v
[CardDetailModal opens with focus trap]
        |
        +---> [User reads / edits fields]
        |             |
        |             | Ctrl+S or clicks "Save"
        |             v
        |     [PATCH /api/cards/:id]
        |             |
        |         +---+---+
        |         |       |
        |       [200]   [error]
        |         |       |
        |    [toast OK] [inline error shown]
        |
        +---> [User closes modal]
                      |
              +-------+-------+
              |       |       |
           [Esc]  [backdrop] [browser Back]
              |       |       |
              v       v       v
        [navigate(-1) → board URL restored]
        [modal unmounts; focus returns to card tile]
```

### Flow Diagram — Search/Filter

```
[BoardHeader: board title | search input | [Filters] button | New Card]
        |
        | user types in search input
        v
[appStore.searchQuery updated; BoardView filters cards client-side]
        |
        | user clicks [Filters] button
        v
[filter chip panel drops down below header row]
        |
        | user clicks label chip / Overdue / Due Soon
        v
[appStore.activeFilters toggled; BoardView re-filters]
        |
        | user clicks chip again or "Clear filters" link
        v
[filter removed; all cards shown]
```

### Error States

| Error | Cause | User Recovery |
|-------|-------|---------------|
| Modal fails to load card | `GET /api/cards/:id` 404 or 5xx | Inline error: "Could not load card. Retry or close." with Retry button |
| Save fails | `PATCH /api/cards/:id` 4xx/5xx | Inline error banner below form fields; Save button re-enabled; user can retry |
| Validation error | Empty title on save | Save button disabled when title is empty (client-side guard); no server round-trip needed |
| Search returns no results | Search term matches no card titles | Column shows empty-column state with "No cards match your filter" copy |

---

## Q1 — Modal Rendering Strategy

### Option A: React State-Controlled Overlay (Zustand `selectedCardId`)

- **Approach**: `selectedCardId` added to `appStore`. `BoardView` renders modal when `selectedCardId !== null`. `CardTile` click sets `selectedCardId` instead of navigating. No URL change.
- **Wireframe**:
  ```
  ┌─────────────────────────────────────┐
  │ BoardView (backdrop dimmed)          │
  │  ┌──────────────────────────────┐   │
  │  │ CardDetailModal (z-50)       │   │
  │  │  Title input                 │   │
  │  │  Description textarea        │   │
  │  │  Due date input              │   │
  │  │  Label chips                 │   │
  │  │  [Cancel] [Save]             │   │
  │  └──────────────────────────────┘   │
  └─────────────────────────────────────┘
  ```
- **User Flow**: Click card → store update → modal renders → edit → Save/Cancel → store cleared → modal unmounts
- **Pros**:
  - No router changes needed
  - `BoardView` already has all board data; no additional fetch for card
- **Cons**:
  - URL stays at `/boards/:boardId` — no deep-linking, no shareable link to a specific card
  - Browser Back does not close the modal — unexpected for users
  - `appStore` grows: must add `selectedCardId`, `setSelectedCardId` and their cleanup
  - TASK-003 UX-Q1 decided that click navigates to `/boards/:boardId/cards/:cardId` — Option A contradicts that already-shipped decision (would require retrofitting CardTile)
- **Usability**: Medium (browser back does not work; no deep link; contradicts existing click behavior)
- **Accessibility**: Medium (focus trap implementable but focus return on close is ad-hoc without router restoration)
- **Implementation Complexity**: Low (simpler routing, but breaks existing CardTile navigation)

### Option B: Route-Based Modal at Existing `/boards/:boardId/cards/:cardId`

- **Approach**: `CardDetailPlaceholderPage` is replaced by `CardDetailModal`. The modal is rendered inside `BoardView` via `<Outlet>`. A dimming backdrop sits between `BoardView` columns and the modal panel. Browser Back / Escape / backdrop click all call `navigate(-1)` to restore the board URL.
- **Wireframe**:
  ```
  ┌──────────────────────────────────────────────┐
  │ AppShell                                     │
  │  ┌────────────┐  ┌──────────────────────┐   │
  │  │ Sidebar    │  │ BoardView (dimmed)   │   │
  │  │            │  │  ┌────────────────┐  │   │
  │  │            │  │  │CardDetailModal │  │   │
  │  │            │  │  │ Title input    │  │   │
  │  │            │  │  │ Description    │  │   │
  │  │            │  │  │ Due date       │  │   │
  │  │            │  │  │ Labels         │  │   │
  │  │            │  │  │ Error area     │  │   │
  │  │            │  │  │[Cancel] [Save] │  │   │
  │  │            │  │  └────────────────┘  │   │
  │  └────────────┘  └──────────────────────┘   │
  └──────────────────────────────────────────────┘
  ```
- **User Flow**: Click CardTile → `navigate(/boards/:boardId/cards/:cardId)` → router renders `<Outlet>` inside `BoardView` → `CardDetailModal` mounts → user edits → Save or close → `navigate(-1)` → board URL restored → modal unmounts; focus returns to card tile.
- **Pros**:
  - Consistent with TASK-003 UX-Q1 decision (CardTile already navigates to this route)
  - Deep-linkable: paste URL → opens card on that board
  - Browser Back works as expected — dismiss modal without touching keyboard/mouse
  - Focus management: React Router navigation provides a natural lifecycle to restore focus via `useEffect` cleanup or `useRef` stored before modal opens
  - The route already exists in the router — this is an in-place upgrade of `CardDetailPlaceholderPage`
- **Cons**:
  - `BoardView` needs a `<Outlet>` appended (four lines of JSX change)
  - `CardDetailModal` must fetch card data itself (`GET /api/cards/:id`) since it cannot rely on board cache having the card in scope
  - URL changes while board is still visible — slight conceptual mismatch (board URL + card URL simultaneously), but this is the established pattern used by Linear, GitHub, and Trello
- **Usability**: High (browser Back, deep link, Escape all work as expected)
- **Accessibility**: High (React Router navigation provides clean focus lifecycle; focus trap via custom hook)
- **Implementation Complexity**: Medium (route already exists; Outlet addition to BoardView; CardDetailModal fetches own data)

### Option C: Route-Based Modal Rendered at AppShell Level

- **Approach**: Modal rendered in a router `<Outlet>` at `AppShell` level rather than `BoardView` level. Board columns visible behind a full-screen backdrop.
- **Pros**: Modal truly floats above everything; no `BoardView` changes needed.
- **Cons**: `AppShell` would need `<Outlet>` for the modal separately from `<main>` for the board, making the layout more complex; the board would scroll beneath the modal uncontrolled; no access to board data context. More disruption to layout shell.
- **Usability**: Medium
- **Accessibility**: Medium
- **Implementation Complexity**: High (double-outlet layout in AppShell)

### Q1 Decision: Option B — Route-Based Modal Rendered in BoardView via Outlet

**Rationale**: The CardTile already navigates to `/boards/:boardId/cards/:cardId` (TASK-003 UX-Q1 decision). Option B is a direct upgrade of the existing placeholder without any regression. The route already exists. `BoardView` needs only a `<div className="relative">` wrapper and `<Outlet>` appended — four lines. Browser Back, deep-link, and Escape all work for free. Linear, GitHub Issues, and Trello all use this overlay-on-board-URL pattern, which aligns with the product's competitive benchmark. Option A contradicts the already-shipped CardTile navigation behavior.

---

## Q2 — Inline Edit vs Read/Edit Toggle

### Option A: All Fields Immediately Editable

- **Approach**: Modal opens with all fields already in their editable state — `<input>` for title, `<textarea>` for description, `<input type="date">` for due date, label checkboxes. No "Read" view. Focus moves to title input on mount.
- **Wireframe**:
  ```
  ┌────────────────────────────────────────┐
  │ ✕                              [Save]  │
  ├────────────────────────────────────────┤
  │ ┌────────────────────────────────────┐ │
  │ │ Card title (editable input)        │ │
  │ └────────────────────────────────────┘ │
  │                                        │
  │ ┌────────────────────────────────────┐ │
  │ │ Description                        │ │
  │ │ (editable textarea, 4 rows)        │ │
  │ └────────────────────────────────────┘ │
  │                                        │
  │ Due date: [date input            ]     │
  │                                        │
  │ Labels:                                │
  │ [● Bug] [● Design] [○ Feature]        │
  │                                        │
  │ {error banner if save fails}           │
  ├────────────────────────────────────────┤
  │              [Cancel]  [Save]          │
  └────────────────────────────────────────┘
  ```
- **User Flow**: Modal opens → title input focused → user reads/edits fields → clicks Save → PATCH → success toast
- **Pros**:
  - Matches Linear and Jira patterns — power users expect immediate editability
  - One less click per editing session
  - Simpler component state (no `isEditing` flag needed)
  - Labels can use checkbox-as-chip toggles that work both as read-display and edit control simultaneously
- **Cons**:
  - Risk of accidental edits (e.g., pressing Delete while reading). Mitigated by: Save button is disabled when no changes detected; Cancel restores original values.
  - Tab navigation through form fields while just reading can be disorienting. Mitigated by: title input receives initial focus; user can Escape to close.
- **Usability**: High
- **Accessibility**: High (standard form elements; label→input associations; focus management natural)
- **Implementation Complexity**: Low

### Option B: Read Mode by Default; Pencil Icon Switches to Edit

- **Approach**: Modal opens in read mode: `<p>` for title, `<p>` for description, formatted date text. Each field has a pencil icon on hover. Clicking pencil (or the field itself) switches that field to an input. Or a global "Edit" button toggles all fields.
- **Pros**:
  - Prevents accidental edits
  - Read-mode is scannable (plain text, not form chrome)
- **Cons**:
  - Extra click to edit anything — friction for the Team Member persona who opens modal specifically to edit
  - Two visual states per field doubles the rendering code
  - Pencil icons on hover are invisible to keyboard users and screen readers unless explicitly placed
  - Inconsistent with competitive tools (Linear, Trello click-to-edit-immediately)
- **Usability**: Medium (read-first is fine for inspection, poor for editing workflows)
- **Accessibility**: Medium (hover-only pencil icons are an a11y anti-pattern)
- **Implementation Complexity**: Medium (dual-state rendering per field)

### Q2 Decision: Option A — All Fields Immediately Editable

**Rationale**: The Team Member persona's primary goal for the modal is to update a card. The "accidental edit" risk is fully mitigated by a disabled Save button when no fields have changed — edits are committed only on deliberate Save. The pattern matches Linear (the product's primary design benchmark per productBrief.md). Simpler implementation with no mode-switching state.

---

## Q3 — Save Trigger

### Option A: Single "Save" Button, Disabled When No Changes

- **Approach**: Save button at bottom-right of modal. Button is `disabled` when form values match server-loaded values (dirty-check). On click: loading spinner in button, PATCH request, success toast, modal closes. On error: error banner below label section, button re-enabled.
- **Pros**:
  - Follows `AddCardForm` pattern (explicit submit, disabled when invalid) — consistency
  - User controls exactly when data is sent — no surprise background saves
  - Error handling is simple: one error state per Save attempt
  - Change detection prevents no-op requests
- **Cons**:
  - If user forgets to click Save and closes modal, changes are lost. Mitigated by: "You have unsaved changes" warning on close when form is dirty.
- **Usability**: High
- **Accessibility**: High (button state communicated via `disabled` attribute; loading state announced via `aria-busy` or spinner with `aria-label`)
- **Implementation Complexity**: Low

### Option B: Per-Field Auto-Save on Blur

- **Approach**: Each field triggers a debounced PATCH on `onBlur` or after 800ms of inactivity. No Save button.
- **Pros**:
  - No "unsaved changes" risk
  - Feels fluid and modern (Notion-like)
- **Cons**:
  - Multiple concurrent in-flight PATCHes are possible (one per field changed in sequence)
  - Error handling: which PATCH failed? How does user know a field failed to save?
  - Last-write-wins conflicts between concurrent users (not in MVP scope but a future risk)
  - Significantly more complex: per-field dirty state, per-field error state, debounce timers, possibly per-field loading indicators
  - No `AddCardForm` precedent in codebase — introduces a new pattern without justification
- **Usability**: High (fluid), but Medium when errors occur (error attribution is unclear)
- **Accessibility**: Medium (auto-save status must be announced via live region; non-trivial)
- **Implementation Complexity**: High

### Option C: Always-Visible Save Button (No Change Detection)

- **Approach**: Save button always enabled. User can click Save at any time. No dirty check.
- **Pros**: Simplest implementation (no dirty-check logic)
- **Cons**:
  - Every modal open-then-close is at risk of a no-op PATCH if user accidentally clicks Save
  - No feedback to user about whether anything changed
  - Opens accidental overwrites if description was partially typed then user cancelled
- **Usability**: Medium
- **Accessibility**: High (button always available)
- **Implementation Complexity**: Very Low

### Q3 Decision: Option A — Single Save Button with Dirty Check

**Rationale**: Directly follows the `AddCardForm` pattern (disabled button until valid/changed). The only meaningful risk — losing unsaved changes on close — is addressed with an "unsaved changes" guard on the Cancel/backdrop/Escape paths when `isDirty === true`. This matches how Trello and most MVP-grade tools handle card editing. Implementation is contained within the modal component with a simple `JSON.stringify` dirty check against the initial values.

---

## Q4 — BoardHeader Context Threading

### Option A: Filter State in appStore; Board Name Threaded via AppShell useParams

- **Approach**: `appStore` holds `searchQuery`, `activeFilters`. `AppShell` calls `useParams()` to get `boardId`, fetches board name, passes it to `BoardHeader` as a prop. `BoardHeader` reads filter state from `appStore` directly.
- **Pros**: No structural change to component hierarchy
- **Cons**:
  - `AppShell` is a layout shell — it should not contain data-fetching logic. `AppShell` knowing about `boardId` from params violates single responsibility: it becomes a board-aware layout component.
  - `BoardHeader` must handle non-board pages where `boardId` is `undefined` — conditional fetch logic adds dead-code paths
  - The `AppShell` renders `BoardHeader` for ALL routes under `/` (including `/boards` list page) — a generic board-header on the board-list page is incorrect
- **Usability**: High (no visible difference)
- **Accessibility**: High
- **Implementation Complexity**: Medium (useParams in AppShell, conditional fetch)

### Option B: Move BoardHeader into BoardView; AppShell Renders Minimal Generic Bar

- **Approach**: `AppShell` renders only the sidebar + a minimal `<header>` for non-board pages (e.g., just the hamburger/logo). `BoardView` renders its own `BoardHeader` as the first child, wired to the board data it already has. `BoardHeader` receives `boardName`, `labels`, and filter state as props from `BoardView`.
- **Wireframe — Component Tree**:
  ```
  AppShell
  ├── Sidebar
  └── <div className="flex-1 flex-col">
      ├── <GenericTopBar />   ← hamburger + placeholder (shown on /boards list)
      └── <main>
          └── <Outlet>
              └── BoardDetailPage
                  └── BoardView(boardId)
                      ├── <BoardHeader boardName labels filters />   ← NEW POSITION
                      └── <DndContext> ... columns ... </DndContext>
  ```
- **Pros**:
  - `BoardView` already holds board data from `useBoard(boardId)` — zero additional fetches; labels come from `board.columns[].cards[].labels` (deduplicated)
  - `BoardHeader` is genuinely a board-specific component; placing it in `BoardView` is architecturally correct
  - Non-board pages (`/boards` list) get a simpler, appropriate top bar
  - Filter state props flow naturally from `BoardView` down into `BoardHeader` — no store needed for filter state (local `useState` in `BoardView` is sufficient)
  - Eliminates the awkward "board title hardcoded as 'My Board'" hack in the current `BoardHeader`
- **Cons**:
  - `AppShell` layout changes: `BoardHeader` no longer part of the shell layout; `BoardView` becomes responsible for its own header zone
  - `GenericTopBar` must be created for non-board pages (small component, ~10 lines)
  - The `h-14` header height that `AppShell` currently accounts for will need to be part of `BoardView`'s flex layout instead
- **Usability**: High (better: board name is now real instead of "My Board")
- **Accessibility**: High
- **Implementation Complexity**: Medium (layout refactor, but self-contained to AppShell + BoardView)

### Option C: Props Threaded from BoardDetailPage → BoardView → BoardHeader

- **Approach**: `BoardDetailPage` fetches board data, passes `boardName` and `labels` down to `BoardView`, which passes to `BoardHeader`. Filter state lives in `BoardView` local state and is also threaded down.
- **Pros**: No structural layout changes; `AppShell` untouched
- **Cons**:
  - `BoardDetailPage` currently has 9 lines (useParams + render BoardView). Adding a data fetch here and threading props down means `BoardDetailPage` fetches AND `BoardView` fetches (double-fetch, or fetch must be hoisted out of `BoardView` breaking its self-contained pattern)
  - Prop drilling through `BoardDetailPage → BoardView → BoardHeader` is the explicit downside called out in the question; it adds coupling without benefit
  - `AppShell` still renders `BoardHeader` for non-board pages — same bug as Option A
- **Usability**: High
- **Accessibility**: High
- **Implementation Complexity**: Medium (prop drilling, potential double-fetch)

### Q4 Decision: Option B — Move BoardHeader into BoardView

**Rationale**: `BoardView` already owns the board data via `useBoard(boardId)`. Moving `BoardHeader` into `BoardView` eliminates all prop-drilling, prevents double-fetching, and places a board-specific component exactly where board data lives — the architecturally correct location per the Guiding Principle "Simplicity over Cleverness." The codebase currently renders "My Board" as a hardcoded string in `AppShell`; Option B is the only approach that also fixes this bug. The `AppShell` change is minimal: swap `<BoardHeader onMenuClick={toggle} />` for `<GenericTopBar onMenuClick={toggle} />` (a new ~10-line component). Filter state lives in `BoardView` as `useState` — no store entry needed (board-scoped local state, not global state).

---

## Q5 — Label Chip Placement in BoardHeader

### Option A: Single Row — All Chips Inline

```
[☰] [Board Title         ] [Search___________] [Bug][Design][Overdue][Due Soon] [New Card]
```

- **Approach**: All filter chips displayed inline in the header row after the search input.
- **Pros**: Everything visible without interaction
- **Cons**:
  - With 5+ labels (common: Bug, Design, Feature, Frontend, Backend, Spike) the header wraps or overflows — breaks the fixed `h-14` header height
  - Label names can be long; chips crowd out other controls
  - Mobile/tablet: completely unworkable; chips would overflow off-screen
- **Usability**: Low (breaks at scale)
- **Accessibility**: Medium
- **Implementation Complexity**: Low

### Option B: Two Rows — Title+Search+NewCard Row + Filter Chips Row

```
Row 1: [☰] [Board Title    ] [Search___________]            [New Card]
Row 2: [Bug] [Design] [Feature] [Overdue] [Due Soon]  [Clear]
```

- **Approach**: Header expands to two rows. Filter row always visible (or conditionally shown when filters are active).
- **Pros**: Chips always visible; clear visual separation
- **Cons**:
  - Header grows to `h-28` (two rows) — reduces board visible area significantly on 768px tablets
  - Two-row header means `BoardView` flex layout needs to account for variable header height
  - "Always shown" row wastes space when filters are inactive (most of the time during normal use)
  - If collapsed when inactive: requires toggle state anyway — equivalent complexity to Option C
- **Usability**: Medium (wastes vertical space; tablet suffers)
- **Accessibility**: High (always visible)
- **Implementation Complexity**: Medium

### Option C: Single Row with "Filters" Dropdown Button

```
[☰] [Board Title         ] [Search___________] [Filters ▾] [New Card]
          ↓ (on click)
[Bug] [Design] [Feature] [Overdue] [Due Soon] [Clear all]  ← panel below header
```

- **Approach**: A single "Filters" button (with an active count badge when filters are on) sits between search and New Card. Clicking it opens a drop-down panel directly below the header showing all label chips + Overdue + Due Soon chips. The panel closes on outside click or pressing Escape. When filters are active, the button shows a count badge: "Filters (2)".
- **Wireframe**:
  ```
  ┌─────────────────────────────────────────────────────────────────┐  h-14
  │ [☰]  Board Title       [🔍 Search cards...] [Filters ▾] [New Card] │
  └─────────────────────────────────────────────────────────────────┘
       ┌─────────────────────────────────────┐  (dropdown panel)
       │ [● Bug] [● Design] [○ Feature]      │
       │ [○ Overdue] [○ Due Soon]            │
       │                      [Clear all]   │
       └─────────────────────────────────────┘
  ```
- **Pros**:
  - Header stays at fixed `h-14` regardless of label count — consistent layout
  - Scales to any number of labels (chips in panel, not header)
  - Works on tablet: the panel overlays columns rather than pushing them down
  - Active-filter count on button ("Filters (2)") gives at-a-glance awareness that filters are on
  - Panel can close automatically when the user interacts with the board again
- **Cons**:
  - One extra click to access filters (click "Filters" button to open panel)
  - Filter state is hidden — user must remember that filters may be active. Mitigated by the count badge.
- **Usability**: High (compact, scales with label count, works on all target screen sizes)
- **Accessibility**: Medium-High (dropdown requires `aria-expanded`, `aria-controls`, keyboard navigation inside panel — implementable with care)
- **Implementation Complexity**: Medium (dropdown open/close state; panel positioning with `absolute` + `z-50`)

### Q5 Decision: Option C — Single Row with "Filters" Dropdown Panel

**Rationale**: Option A breaks with 5+ labels and fails on tablet. Option B wastes 50% more vertical space for functionality that is used occasionally (not every session). Option C maintains the fixed `h-14` header height that the existing `AppShell` layout depends on, scales to any label count, and handles tablets without overflow. The "Filters (N)" active-count badge solves the discoverability problem. This pattern is used by GitHub Projects and Linear's filter bar. The implementation complexity (dropdown panel with outside-click close) is well-understood and can be encapsulated in a `useDropdown` hook.

---

## Full UI Layout

### BoardHeader (within BoardView) — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐ h-14
│ [☰]  Design Sprint Q3        [🔍 Search cards...]  [Filters ▾] [+ New Card] │
└─────────────────────────────────────────────────────────────────────┘
```

### BoardHeader with Filters Panel Open

```
┌─────────────────────────────────────────────────────────────────────┐ h-14
│ [☰]  Design Sprint Q3        [🔍 Search cards...]  [Filters (2)▾] [+ New Card] │
└─────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────┐
│  [● Bug] [● Design] [○ Feature]   │  absolute, z-50, below Filters button
│  [○ Overdue] [○ Due Soon]         │  shadow-lg, rounded-lg, border
│                    [Clear all ×]  │
└────────────────────────────────────┘
```

### CardDetailModal — Desktop (centered, max-w-lg)

```
┌──────────────────────────────────────────────────────┐
│ Fixed inset overlay: bg-black/40 z-50                │
│  ┌────────────────────────────────────────────────┐  │
│  │  [×  close]                                    │  │ max-w-lg, bg-surface-card
│  ├────────────────────────────────────────────────┤  │ rounded-xl, shadow-2xl
│  │  ┌──────────────────────────────────────────┐  │  │ mx-auto my-auto
│  │  │  Card Title                              │  │  │
│  │  │  (text-lg font-semibold input, w-full)   │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                │  │
│  │  Description                                   │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │  Add a description...                    │  │  │
│  │  │  (textarea 4 rows, resize-none)          │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                │  │
│  │  Due Date                                      │  │
│  │  [   2026-06-15   ] (date input)              │  │
│  │                                                │  │
│  │  Labels                                        │  │
│  │  [● Bug ✓] [○ Design] [○ Feature]             │  │
│  │                                                │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │ ⚠ Could not save. Try again.             │  │  │ (hidden when no error)
│  │  └──────────────────────────────────────────┘  │  │
│  ├────────────────────────────────────────────┤   │  │
│  │                    [Cancel]  [Save changes] │   │  │
│  └────────────────────────────────────────────┘   │  │
└──────────────────────────────────────────────────────┘
```

### CardDetailModal — Tablet (≥768px, max-w-lg centered)

Same layout. Modal width bounded by `max-w-lg w-[calc(100%-2rem)]`. Panel is scrollable if content exceeds viewport height.

---

## Evaluation Matrix

| Criteria | Q1 Opt A (Store) | Q1 Opt B (Route) | Q2 Opt A (Always Edit) | Q2 Opt B (Toggle) | Q3 Opt A (Save btn) | Q3 Opt B (Auto-save) | Q4 Opt A (Store+params) | Q4 Opt B (Move header) | Q5 Opt A (Inline all) | Q5 Opt B (Two rows) | Q5 Opt C (Dropdown) |
|----------|-----------------|-----------------|----------------------|------------------|--------------------|--------------------|----------------------|----------------------|---------------------|-------------------|-------------------|
| Usability | Medium | **High** | **High** | Medium | **High** | High | High | **High** | Low | Medium | **High** |
| Accessibility | Medium | **High** | **High** | Medium | **High** | Medium | High | **High** | Medium | High | High |
| Consistency | Low | **High** | **High** | Medium | **High** | Low | Medium | **High** | Low | Medium | **High** |
| Responsiveness | High | **High** | **High** | High | **High** | High | High | **High** | Low | Medium | **High** |
| Performance | **High** | Medium | **High** | High | **High** | Medium | Medium | **High** | **High** | High | High |
| Implementation | Low | Medium | **Low** | Medium | **Low** | High | Medium | Medium | **Low** | Medium | Medium |

---

## Design Specifications

### Layout

- **Desktop (≥1024px)**:
  - `BoardHeader` is first child of `BoardView` flex column: `<div className="flex flex-col h-full">` wrapping header + board scroll area
  - Header: `h-14 flex items-center px-4 gap-3 bg-surface-card border-b border-border shrink-0`
  - Board scroll area: `flex-1 overflow-x-auto`
  - Modal: fixed inset, `flex items-center justify-center p-4`, backdrop `bg-black/40`
  - Modal panel: `bg-surface-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col`

- **Tablet (768–1023px)**:
  - Same layout; hamburger menu button visible
  - Filters dropdown panel: `position: absolute`, aligned to the "Filters" button's left edge, `z-50`
  - Modal: `max-w-lg w-[calc(100%-2rem)]` — respects small viewport

- **Mobile (<768px)**:
  - Not optimized for MVP; layout must not break. Modal: `w-full h-full rounded-none` at `<640px` breakpoint (bottom-sheet style fallback)

### Key Components

| Component | Location | Purpose | Behavior |
|-----------|----------|---------|----------|
| `BoardHeader` | `src/components/board/BoardHeader.tsx` | Board-specific header with search, filters, new card | Receives `boardName`, `labels`, `onAddCard` props; owns filter/search state locally or via props from BoardView |
| `GenericTopBar` | `src/components/layout/GenericTopBar.tsx` | Minimal header for non-board pages | Renders hamburger + app title. No data dependencies. |
| `SearchInput` | `src/components/filters/SearchInput.tsx` | Search by card title | Controlled input; calls `onSearchChange(value)`. Debounced in parent (300ms). |
| `FiltersDropdown` | `src/components/filters/FiltersDropdown.tsx` | Dropdown panel for label + date filters | Renders "Filters (N)" button + absolute panel. `useClickOutside` hook to close. |
| `FilterChip` | `src/components/filters/FilterChip.tsx` | Individual toggleable filter chip | Pressed/unpressed state. Follows label chip visual style. |
| `CardDetailModal` | `src/components/card/CardDetailModal.tsx` | Route-rendered card detail + edit overlay | Fetches own card data via `useCard(cardId)`. Form with dirty check. Focus trap. |
| `useCardForm` | `src/components/card/useCardForm.ts` | Custom hook for form state + dirty check | Holds `formValues`, `initialValues`, `isDirty`, `errors`. |

### Interactions

| Trigger | Action | Feedback |
|---------|--------|----------|
| Click card tile body | `navigate(/boards/:boardId/cards/:cardId)` | Modal fades in (transition 150ms); focus moves to title input |
| Press Escape in modal | `navigate(-1)` if not dirty; else show confirm | Modal closes; focus returns to card tile |
| Click modal backdrop | `navigate(-1)` if not dirty; else show confirm | Modal closes |
| Click "Save changes" | PATCH `/api/cards/:id`; button shows loading state | Success: toast "Card saved"; modal closes. Error: inline error banner; button re-enabled |
| Click "Cancel" | `navigate(-1)` if not dirty; else confirm | Modal closes; no PATCH |
| Type in search input | Filter cards client-side (debounced 300ms) | Cards not matching query hidden; column card counts update |
| Click "Filters" button | Open filter panel | Panel slides in below button; button shows `aria-expanded="true"` |
| Click label chip in panel | Toggle filter on/off | Chip pressed state toggles; board re-filters immediately |
| Click "Overdue" chip | Toggle overdue filter | Cards without overdue due date hidden |
| Click "Clear all" | Reset all active filters | All chips unpressed; all cards visible; Filters button badge clears |
| Click outside filter panel | Close panel | Panel hides; focus returns to Filters button |

### Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| < 640px | Modal becomes full-screen: `inset-0 rounded-none`; no backdrop. Board header wraps: search + filters stack if needed |
| 640–1023px | Modal: `max-w-lg`, centered with `p-4` margin. Filter panel: absolute positioned below Filters button |
| ≥ 1024px | Full layout; sidebar visible; modal centered with generous backdrop |

### Accessibility Requirements

- [x] Keyboard navigation: Tab through all modal fields; Escape closes; Enter in title input does not submit (use Cmd/Ctrl+Enter or Save button)
- [x] Focus trap in modal: `focus-trap-react` or hand-rolled `useFocusTrap` hook; focus moves to title input on open; returns to card tile button on close
- [x] Screen reader: modal has `role="dialog"` `aria-modal="true"` `aria-labelledby="modal-title"`; title input is `id="modal-title"`
- [x] Color contrast: all text on `surface-card` background uses `text-primary` (#0f172a on #ffffff = 18.1:1 ratio — passes AAA). Error banner uses `text-red-700` on `bg-red-50` — verify ≥ 4.5:1
- [x] Focus indicators: all inputs/buttons use `focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`
- [x] Search input: `<label htmlFor="board-search" className="sr-only">Search cards</label>` — visible only to screen readers
- [x] Filters button: `aria-expanded`, `aria-controls="filter-panel"`. Panel has `id="filter-panel"` `role="group"` `aria-label="Filter options"`
- [x] Filter chips: `role="checkbox"` `aria-checked` or `<button aria-pressed>` — either conveys toggled state
- [x] Label chips in modal: `role="checkbox"` `aria-checked` `aria-label="{label.name}"`
- [x] Error message: `role="alert"` so screen readers announce it immediately on save failure
- [x] Loading state on Save button: `aria-busy="true"` `aria-label="Saving..."` during PATCH request
- [x] "Unsaved changes" guard: dialog (native `window.confirm` for MVP) before close when `isDirty`

---

## Implementation Guidelines

### For Developers

1. **AppShell change**: Replace `<BoardHeader onMenuClick={toggle} />` with `<GenericTopBar onMenuClick={toggle} />`. Create `src/components/layout/GenericTopBar.tsx` — a ~10-line component with hamburger button + BanyanBoard wordmark.

2. **BoardView change**: Wrap return in `<div className="flex flex-col h-full">`. First child: `<BoardHeader boardName={board.name} labels={allLabels} searchQuery={searchQuery} activeFilters={activeFilters} onSearch={setSearchQuery} onFilterChange={toggleFilter} onAddCard={...} onMenuClick={...} />`. Second child: `<div className="flex-1 overflow-x-auto">` containing the existing DndContext. Append `<Outlet />` at the same level as the scroll div (sibling, not inside the scroll area) for route-based modal rendering. Compute `allLabels` by deduplicating across all columns' cards' labels using a `Map<string, Label>` keyed by `label.id`.

3. **Filter state in BoardView**: `const [searchQuery, setSearchQuery] = useState('')` and `const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())`. Apply filtering to `board.columns` before passing to `Column`. Filter logic: a card passes if (a) its title includes `searchQuery` (case-insensitive) AND (b) all active label/date filter chips match. If `activeFilters` has 'overdue', card must have `isOverdue(card.dueDate)`. If `activeFilters` has a label id, card must have that label.

4. **CardDetailModal rendering**: The modal is rendered by the router at `/boards/:boardId/cards/:cardId`. It needs `cardId` from `useParams`. Create `useCard(cardId)` hook (GET `/api/cards/:id`). Render: fixed inset backdrop div + centered panel div. Use `useEffect(() => { /* focus title on mount */ }, [])`. Handle close via `const navigate = useNavigate(); const handleClose = () => navigate(-1)`.

5. **Focus management**: On `CardDetailModal` mount, `titleInputRef.current?.focus()`. On close, focus must return to the card tile. Since the card tile is the element that triggered navigation, store a ref to it before navigating — or accept that React Router will naturally return focus to the previous focused element on history pop (verify in practice; if not, use `document.querySelector([data-card-id="${cardId}"])?.focus()`).

6. **Dirty check**: `const isDirty = JSON.stringify(formValues) !== JSON.stringify(initialValues)` where `initialValues` is set once when card data loads. Gate Save button: `disabled={!isDirty || isSubmitting}`. Gate close: if `isDirty`, `window.confirm('Discard unsaved changes?')` before `navigate(-1)`.

7. **Save flow**: On Save, call `PATCH /api/cards/:id` with changed fields only (or full payload — simpler for MVP). On 200: call `queryClient.invalidateQueries(['board', boardId])` to refresh board cache, show `toast.success('Card saved')` via sonner, then `navigate(-1)`. On error: set `errorMessage` state, render as `role="alert"` banner.

8. **FiltersDropdown**: Use `useRef<HTMLDivElement>(null)` for the panel. `useEffect` adds a `mousedown` listener on `document` that checks `!panelRef.current?.contains(event.target)` to close on outside click. `position: absolute` on the panel; parent container needs `position: relative`.

9. **Filter chip visual states**: Active filter chip: `bg-primary text-primary-foreground`. Inactive: `bg-nav-hover text-text-secondary hover:bg-border`. This distinguishes selected filters from unselected ones clearly.

### Component Structure

```
src/components/
├── board/
│   ├── BoardHeader.tsx          (moved here; was layout/)
│   └── BoardView.tsx            (updated: owns filter state, renders BoardHeader + Outlet)
├── card/
│   ├── CardDetailModal.tsx      (new: route-rendered modal overlay)
│   └── useCardForm.ts           (new: form state + dirty check hook)
├── filters/
│   ├── SearchInput.tsx          (new: search input with sr-only label)
│   ├── FiltersDropdown.tsx      (new: Filters button + absolute panel)
│   └── FilterChip.tsx           (new: toggleable chip, aria-pressed)
├── layout/
│   ├── AppShell.tsx             (updated: uses GenericTopBar instead of BoardHeader)
│   ├── GenericTopBar.tsx        (new: hamburger + app title for non-board pages)
│   └── BoardHeader.tsx          (deleted from here — moved to board/)
└── ui/
    └── (existing primitives)
```

### Recommended Patterns

- **No new date-picker library**: Use `<input type="date" />`. Style with Tailwind: `border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:ring-2 focus:ring-primary focus:outline-none`. The value is a string in `YYYY-MM-DD` format matching what the API returns (ISO date).
- **No headless UI library for modal**: Hand-rolled focus trap is ~30 lines. Use `useEffect` + `addEventListener('keydown', ...)` listening for Tab (cycle within modal) and Escape (close). Simpler than adding a dependency for MVP.
- **Sonner toasts already installed**: Use `toast.success('Card saved')` and `toast.error('Failed to save card')` from `sonner` — already imported in `main.tsx`.
- **clsx already installed**: Use for conditional class composition: `clsx('base-classes', { 'active-classes': isActive })`.
- **useDropdown pattern**: A reusable `useDropdown` hook returns `{ isOpen, open, close, toggleOpen, panelRef, triggerRef }`. The `useEffect` inside attaches the document `mousedown` listener and Escape key listener. This keeps `FiltersDropdown` clean.

---

## Validation Checklist

- [x] Meets all user goals (inspect, edit, filter, search, save with confidence)
- [x] Accessible per requirements (WCAG 2.1 AA best-effort: focus trap, aria-dialog, keyboard nav, contrast)
- [x] Consistent with existing patterns (TailwindCSS tokens, AddCardForm save pattern, sonner toasts, clsx)
- [x] Respects Guiding Principles (Simplicity over Cleverness: Option B in Q4 eliminates prop-drilling by moving data closer to its source; No Premature Abstractions: useDropdown hook only when FiltersDropdown is implemented)
- [x] Responsive across devices (h-14 header preserved; modal full-screen fallback at <640px; dropdown panel overlays columns on tablet)
- [x] Performance acceptable (client-side filtering against TanStack Query cache — no additional API calls per keystroke; dirty check is O(n) JSON comparison on small card objects)
- [x] Implementation feasible (no new libraries required; largest new file is CardDetailModal at ~150 lines)

---

## Next Steps

1. Update `AppShell.tsx`: replace `<BoardHeader>` with `<GenericTopBar>`; create `GenericTopBar.tsx`
2. Update `BoardView.tsx`: add filter/search state, deduplicate labels, apply filtering, render `<BoardHeader>` as first child, append `<Outlet />` as sibling to scroll area
3. Create `BoardHeader.tsx` (in `board/`): receives `boardName`, `labels`, filter props; renders search input + FiltersDropdown
4. Create `SearchInput.tsx`, `FiltersDropdown.tsx`, `FilterChip.tsx` under `filters/`
5. Create `CardDetailModal.tsx`: route-rendered; fetches own card data; form with dirty check; focus trap; save/cancel with guard
6. Create `useCardForm.ts` hook: manages `formValues`, `initialValues`, `isDirty` derived state
7. Update `router/index.tsx`: replace `CardDetailPlaceholderPage` import with `CardDetailModal`
8. Create `useCard(cardId)` hook in `hooks/`: GET `/api/cards/:id`, returns `{ data: Card, isLoading, isError }`
9. Verify `GET /api/cards/:id` endpoint exists in backend; if not, add it in TASK-004 backend phase
10. Run accessibility audit: Tab through modal, verify focus trap, verify Escape closes, verify screen reader announces `aria-label` on filter chips
