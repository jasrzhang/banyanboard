# UI/UX Design: TASK-003 Kanban Board UI

**Created**: 2026-05-18
**Status**: DECIDED
**Decision Type**: UI/UX
**Task**: TASK-003 (FEAT-003 Kanban Board)
**Resolves**: UX-Q1 through UX-Q8

---

## Decision Summary

| Question | Decision |
|----------|----------|
| UX-Q1: Click-on-card | Option B — Navigate to `/boards/:boardId/cards/:cardId` placeholder route ("Card detail coming soon") |
| UX-Q2: Sticky column header | Option A — CSS `position: sticky; top: 0` inside `overflow-y: auto` column |
| UX-Q3: Add-card form factor | Option A — Inline expanding form at column bottom (Trello-style) |
| UX-Q4: Drag visual affordances | Option B — Hover-reveal drag handle icon on left edge of card |
| UX-Q5: Error indicator for DnD rollback | Option A — Toast via `sonner` (lightweight, zero-config) |
| UX-Q6: Column width / horizontal scroll | Option B — Fixed `min-w-[300px]` with `flex-shrink-0` |
| UX-Q7: Card-count badge | Option A — Pill badge `bg-surface-raised text-text-secondary` (neutral tokens) |
| UX-Q8: Empty states | Dashed-border placeholder (empty column), skeleton columns (loading), inline error panel (fetch fail) |

---

## Component Inventory

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `BoardView` | `src/components/board/BoardView.tsx` | Horizontal scroll rail; `DndContext` wrapper; renders one `Column` per `board.columns[]` |
| `Column` | `src/components/board/Column.tsx` | Column header (name + badge), `SortableContext` card list, `AddCardForm` slot |
| `CardTile` | `src/components/card/CardTile.tsx` | Draggable card: title, description preview, due date, label chips, drag handle |
| `DragOverlay` | inline in `BoardView` | Ghost card rendered during active drag (dnd-kit `<DragOverlay>`) |
| `AddCardForm` | `src/components/card/AddCardForm.tsx` | Inline expanding form — idle button state / open textarea+button state |
| `CardSkeleton` | `src/components/card/CardSkeleton.tsx` | Animated skeleton placeholder for loading state |
| `BoardErrorPanel` | `src/components/board/BoardErrorPanel.tsx` | Error state with message + Retry button |
| `ErrorToast` (via sonner) | `src/main.tsx` — `<Toaster />` | Floating toast for DnD rollback error notification |

---

## UX-Q1: Click-on-Card Behavior

### Options Evaluated

**Option A: No click handler — drag only**
- Pros: Simplest implementation; zero dead-end routes; no WCAG violation if card is `role="listitem"` not a button
- Cons: Cards have no keyboard-activatable affordance — users can't Tab → Enter to open them; violates WCAG 2.1 SC 4.1.2 (interactive-looking elements must have a name and role); confusing: hover state implies clickability but nothing happens; actively blocks FEAT-004 (every click handler will need to be retrofitted)
- Usability: Low
- Accessibility: Low (hover shadow implies affordance; no action delivered)
- Implementation: Very Low

**Option B: Navigate to `/boards/:boardId/cards/:cardId` placeholder**
- Pros: Cards become real interactive elements with `role="link"` or `role="button"` — keyboard accessible; correct WCAG 2.1 AA; provides forward-compatible route that FEAT-004 simply fills in; user gets clear feedback (placeholder page) rather than confusing silence; the route also enables deep-linking to cards in future
- Cons: Adds one placeholder route; user sees a "coming soon" page if they click (mild disappointment vs. confusion); must ensure click + drag coexist (dnd-kit handles this via drag threshold — a tap/click that doesn't cross the drag threshold fires the click handler)
- Usability: Medium (placeholder is a known pattern in iterative dev)
- Accessibility: High
- Implementation: Low (one route + one placeholder page)

**Option C: Inline expansion showing full description**
- Pros: Immediate value; no navigation; description visible in context
- Cons: Adds significant state complexity (which card is expanded? how does it interact with drag?); expanded card resizes columns; no edit affordance so it frustrates users who want to update content; FEAT-004 will need to undo or reconcile this pattern
- Usability: Medium (description read-only; can't edit)
- Accessibility: Medium (requires ARIA expanded/collapsed management)
- Implementation: High

### Decision

**Chosen**: Option B — Navigate to `/boards/:boardId/cards/:cardId` (placeholder route)

**Rationale**: Option A is an accessibility anti-pattern — cards render with `hover:shadow-md` (a clearly interactive affordance) but deliver no action. This fails WCAG 2.1 SC 2.1.1 (all functionality available by keyboard) because there is nothing to invoke. Option B makes cards proper interactive elements, satisfies keyboard navigation requirements for AC-A11Y-1, and establishes the route that FEAT-004 will complete. The "coming soon" placeholder is preferable to silent failure. dnd-kit's `useSortable` distinguishes drag intent from click intent via a movement threshold (typically 3px) — clicking fires the router navigation while dragging fires the DnD handler.

**Implementation**:
- `CardTile` root element: `<div role="article">` wrapping a `<button>` or `<a>` for the clickable card body
- Alternatively, wrap in `<Link to={/boards/${boardId}/cards/${card.id}}>` and intercept drag events on a `useSortable` wrapper div
- Preferred pattern: outer `<div>` with `useSortable` for DnD; inner `<button onClick={onCardClick}>` for keyboard/click; `onCardClick` uses `useNavigate()` to push route
- Add route `/boards/:boardId/cards/:cardId` to `src/router/index.tsx` rendering a `CardDetailPage` with placeholder text "Card detail — coming soon. This will be FEAT-004."
- Click handler fires only when `!isDragging` (dnd-kit provides `isDragging` from `useSortable`)

---

## UX-Q2: Sticky Column Headers

### Decision

**Chosen**: Option A — CSS `position: sticky; top: 0` on the column header

**Rationale**: Chrome 120+, Firefox 120+, and Safari 17+ all have full support for `position: sticky` inside flex children with `overflow-y: auto` containers — no polyfill needed. The trick is column-level containment: each column is `flex-shrink-0 flex flex-col overflow-y-auto h-full` (or a fixed max-height), and the header inside is `sticky top-0 z-10`. The outer board container handles horizontal scroll independently (`overflow-x: auto`), so vertical stickiness inside each column is orthogonal. The IntersectionObserver approach (Option B) adds ~40 lines of JS per column and only provides a visual drop-shadow trigger — the CSS `sticky` approach gives correct scroll containment natively.

**Implementation**:

Column structure:
```
<div className="flex-shrink-0 flex flex-col w-[300px] min-w-[300px] max-h-full overflow-y-auto rounded-xl bg-surface-sidebar border border-border">
  {/* Sticky header */}
  <div className="sticky top-0 z-10 bg-surface-sidebar px-3 pt-3 pb-2 border-b border-border">
    <ColumnHeader name={column.name} count={column.cards.length} />
  </div>
  {/* Scrollable card list */}
  <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
    {cards.map(...)}
    <AddCardForm />
  </div>
</div>
```

Key points:
- `sticky top-0 z-10` on the header; `bg-surface-sidebar` so it covers scrolling cards
- The column container must NOT have `overflow: visible` — it must be `overflow-y: auto` with a defined height for sticky to work. Use `max-h-[calc(100vh-theme(spacing.14)-theme(spacing.8))]` (viewport minus header 56px minus vertical padding) or simply inherit the parent's height via `h-full` on a flex column child.
- `z-10` on header prevents cards from rendering on top during scroll.

---

## UX-Q3: Add-Card Form Factor

### Options Evaluated

**Option A: Inline expanding form at column bottom (Trello-style)**

Closed state: `"+ Add a card"` text button at column bottom
Open state: `<textarea>` for title + "Add Card" (primary) + "Cancel" (ghost) buttons

```
┌──────────────────────────────┐
│  Column Header               │
├──────────────────────────────┤
│  [Card Tile 1]               │
│  [Card Tile 2]               │
│  [Card Tile 3]               │
├──────────────────────────────┤
│  + Add a card                │  ← closed state
└──────────────────────────────┘

Open state:
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ Card title...          │  │  ← textarea, auto-focuses
│  └────────────────────────┘  │
│  [Add Card]   [Cancel]       │
└──────────────────────────────┘
```

- Pros: Familiar (Trello pattern users already know); inline context — user sees which column they're adding to; keyboard flow: Tab to "+ Add a card", Enter opens form, type title, Enter submits; no modal overlay required; column context always visible
- Cons: Requires the column to expand vertically to show the form; if column is near bottom of viewport, may clip; slightly more state to manage (isOpen per column)
- Usability: High
- Accessibility: High — `<button>` for trigger, `<textarea>` for input, Enter submits, Escape cancels; focus auto-moves to textarea on open
- Implementation: Medium

**Option B: Modal dialog triggered by "+" button in column header**
- Pros: Clean UI; never clips viewport; consistent with generic CRUD form patterns
- Cons: Loses column context during form entry (user can't see which column the card will land in); adds modal management complexity; breaks the Kanban "in-context action" design language; keyboard user must navigate back to column after submit
- Usability: Medium
- Accessibility: Medium (modal trap required)
- Implementation: Medium

**Option C: "Add card" button in column header opens inline composer at bottom**
- Pros: Button placement in header is discoverable
- Cons: Header button adds clutter to an already-compact header (name + badge + button); same implementation complexity as Option A with worse discoverability (button not in visual proximity to where card appears); user must scan from header to bottom to see the form
- Usability: Medium
- Accessibility: Medium
- Implementation: Medium

### Decision

**Chosen**: Option A — Inline expanding form at column bottom

**Rationale**: The Trello-style inline form is the established mental model for this interaction pattern — it is what all three reference competitors (Trello, Linear, Notion) use. It places the affordance at the spatial location where the new card will appear (bottom of column), maintaining spatial coherence. It is fully keyboard accessible without a focus trap. The productBrief's "calm, productivity-focused" design language favors in-context actions over modal interruptions. Option B (modal) requires a focus trap and removes spatial context. Option C duplicates the column header.

**Component sketch**:

```
CLOSED STATE:
┌─────────────────────────────────────────┐
│  + Add a card                           │  text-text-secondary hover:text-text-primary
└─────────────────────────────────────────┘
  px-2 py-2 w-full text-left text-sm rounded-md hover:bg-nav-hover cursor-pointer

OPEN STATE:
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐    │
│  │ Card title (required)           │    │  textarea: text-sm text-text-primary
│  │                                 │    │  bg-surface-card border border-border
│  └─────────────────────────────────┘    │  rounded-md p-2 w-full resize-none rows=3
│  [Add Card]  [✕]                        │  focus:ring-2 focus:ring-primary
└─────────────────────────────────────────┘
```

**Keyboard flow**:
1. Tab → focus lands on `"+ Add a card"` button (`role="button"`)
2. Enter/Space → form opens, focus moves to `<textarea>` (`autoFocus`)
3. Type title
4. Enter (with Ctrl or Cmd, or dedicated "Add Card" button focus + Enter) → submits; fires `POST /api/columns/:columnId/cards`; form returns to closed state
5. Escape → form closes without submitting; focus returns to trigger button
6. Tab from textarea → moves to "Add Card" button → "Cancel" button → next column

**Tailwind class guidance**:

Trigger button (closed):
```
w-full flex items-center gap-1.5 px-2 py-2 rounded-md
text-sm text-text-secondary hover:text-text-primary hover:bg-nav-hover
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-colors duration-100 cursor-pointer
```

Open form container:
```
flex flex-col gap-2 p-2 bg-surface-card rounded-lg border border-border shadow-sm
```

Textarea:
```
w-full resize-none rounded-md border border-border p-2 text-sm text-text-primary
bg-surface-card placeholder:text-text-disabled
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
```

"Add Card" button (primary small):
```
bg-primary hover:bg-primary-hover text-primary-foreground
text-sm font-medium px-3 py-1.5 rounded-md
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-colors duration-100
```

"Cancel" button (ghost):
```
text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md
hover:bg-nav-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
transition-colors duration-100
```

---

## UX-Q4: Drag Visual Affordances

### Decision

**Chosen**: Option B — Drag handle icon (⠿ grip dots) visible on card hover, positioned on left edge

**Rationale**: dnd-kit's `useSortable` supports both whole-card drag and handle-restricted drag. The "entire card is draggable" approach (Option A) conflicts with the click-to-navigate decision from UX-Q1 — users who attempt to click a card risk accidentally initiating a drag (especially on slower devices or trackpads). A visible-on-hover drag handle (Option B) clearly separates "drag" from "click" affordances spatially. The handle being hover-revealed (not always visible, Option C) is appropriate for the "calm, productivity-focused" design language — always-visible handles add visual noise that competes with card content. dnd-kit's `DragConstraints` / `activationConstraint` on the `PointerSensor` can be configured to require a minimum drag distance (4px), which also helps distinguish click from drag on the whole-card approach, but the handle makes the affordance unambiguous.

Mobile: handle hover is irrelevant on touch; dnd-kit's `TouchSensor` is deferred to post-MVP per productBrief. For MVP, mouse + keyboard are the only inputs.

**Implementation**:

```
CardTile layout:
┌──────────────────────────────────────────────────┐
│ ⠿  Card Title                                    │
│    Description preview text...                   │
│    [May 22]  [bug] [frontend]                    │
└──────────────────────────────────────────────────┘
```

- Handle: left-aligned `⠿` icon (Unicode U+2807 BRAILLE PATTERN DOTS-1234567) or SVG grip icon; `opacity-0 group-hover:opacity-100` transition; acts as the dnd-kit drag activator via `useDraggable` listeners attached only to the handle element
- Cursor: `cursor-grab` on handle hover; `cursor-grabbing` during active drag (apply to `DragOverlay`)
- During drag: original card slot renders with `opacity-30` and a dashed `border border-border border-dashed rounded-lg` placeholder; drag overlay renders the card at full opacity with `shadow-xl rotate-1`

**Tailwind handle classes**:
```
opacity-0 group-hover:opacity-100 transition-opacity duration-100
text-text-disabled hover:text-text-secondary cursor-grab active:cursor-grabbing
flex-shrink-0 mr-2 mt-0.5 self-start
```

**dnd-kit sensor configuration** (in `BoardView`):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },  // 4px before drag activates
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);
```

The `distance: 4` on `PointerSensor` means a mouse click (distance 0) navigates to the card; a drag (distance >4px) initiates DnD. This is dnd-kit's recommended approach for coexisting click and drag on the same element.

---

## UX-Q5: Error Indicator for DnD Rollback

### Decision

**Chosen**: Option A — Toast notification via `sonner`

**Specific library**: `sonner` by Emil Kowalski — `npm install sonner`

**Rationale**:

| Factor | Analysis |
|--------|----------|
| Dependency cost | `sonner` is 2.6kB gzipped. Negligible for an MVP frontend. No transitive dependencies. |
| Design language fit | `sonner` renders minimal, clean toasts matching the Linear/Notion aesthetic. Configurable position (top-center recommended) and duration. |
| Accessibility | `sonner` uses `role="status"` and `aria-live="polite"` — screen readers announce the message without interrupting focus. |
| vs. inline column error (Option C) | Column-level errors are spatially tied to the source column. After a rollback, the card is back in its original column — the error context is the move attempt, not the column, so a floating toast is more semantically appropriate. |
| vs. board-level banner (Option B) | Inline banner at board top competes with column headers and reduces board real estate. It also requires manual dismissal. |
| No toast library risk | Confirmed: `sonner` is maintained, widely used, and has a stable API. The implementation is two lines: `<Toaster />` in `App.tsx` / `main.tsx` and `toast.error(message)` in the mutation's `onError` handler. |

**Why not roll a minimal toast**: A hand-rolled toast requires `setTimeout` management, `aria-live` region setup, animation CSS, and portal rendering. `sonner` covers all of this in 2.6kB. MVP simplicity favors proven libraries for non-core concerns.

**Implementation**:

In `main.tsx` (or `App.tsx`):
```tsx
import { Toaster } from 'sonner';
// Inside JSX tree:
<Toaster position="top-center" richColors />
```

In `useMoveCard()` mutation:
```typescript
onError: (error, variables, context) => {
  // Rollback the optimistic update
  queryClient.setQueryData(['board', boardId], context.previousBoard);
  // Show toast
  toast.error('Failed to move card. Please try again.', {
    duration: 4000,
    description: error instanceof Error ? error.message : 'Unknown error',
  });
},
```

**Accessibility**: `sonner` uses `aria-live="polite"` by default. For errors, configure `aria-live="assertive"` via the `Toaster` component's `toastOptions` or use `toast.error()` which triggers the assertive region. Screen readers announce the message without stealing focus.

**Alternative (zero-dependency fallback)**: If `sonner` is rejected during review, Option C (inline column error) is the fallback. Render a `<div role="alert" aria-live="assertive">` beneath the column header that auto-clears after 4 seconds via a `useEffect` cleanup timer.

---

## UX-Q6: Column Width and Horizontal Scroll

### Decision

**Chosen**: Option B — Fixed `min-w-[300px]` (300px) with `flex-shrink-0`; `overflow-x: auto` on board container

**Rationale**: productBrief explicitly specifies "horizontally scrollable Kanban columns". Fixed-width columns (Option B at 300px) match Trello's column width, which is a well-validated convention in the Kanban UI space. At desktop breakpoint ≥1024px with a 256px sidebar, the available board width is approximately `1024 - 256 = 768px` — enough for 2.5 columns before horizontal scroll activates, which is the correct behavior (content not compressed, scroll reveals more). Option A (280px) is slightly narrower, acceptable but less spacious for card content. Option C (fluid columns) would compress card titles at higher column counts and contradicts the productBrief's explicit "horizontally scrollable" requirement.

**Tailwind classes**:

Board container (inside `<main>`):
```
flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto
```

Individual column:
```
flex-shrink-0 w-[300px] min-w-[300px]
```

Note: Use `w-[300px]` (not `min-w-[300px]` alone) to prevent the column from growing wider than 300px in a short flex row. The combination `w-[300px] flex-shrink-0` pins width to exactly 300px.

**Scroll affordance**: The board container's `overflow-x: auto` shows a native horizontal scrollbar at the bottom of the main area. This is sufficient for MVP. Post-MVP, custom scrollbar styling via `::-webkit-scrollbar` CSS (or a Tailwind plugin) can improve the visual.

---

## UX-Q7: Card-Count Badge Styling

### Decision

**Chosen**: Option A — Pill badge using neutral surface tokens

**Rationale**: The card-count badge conveys quantity, not status or urgency — a neutral pill is semantically correct. The label palette (rose/amber/emerald/sky/violet/orange) is reserved for user-defined card labels and should not be repurposed for column metadata. Using a colored accent badge (Option C) would imply semantic meaning (e.g., "high count = problem") which is not intended. Plain parenthetical text (Option B) has no distinct visual boundary and is harder to parse at a glance.

The existing token set in `tailwind.config.ts` does not include a `surface-raised` token. The appropriate combination using existing tokens is:

**Badge Tailwind classes**:
```
inline-flex items-center justify-center
min-w-[1.25rem] h-5 px-1.5
rounded-full text-xs font-medium
bg-border text-text-secondary
```

- `bg-border` (#e2e8f0, slate-200) provides a visible but muted background — a light neutral chip on the `bg-surface-sidebar` (#f1f5f9) column background
- `text-text-secondary` (#475569) provides sufficient contrast: 5.9:1 on the badge background — passes WCAG AA
- `rounded-full` gives the pill shape
- `min-w-[1.25rem]` ensures single-digit numbers are circular; `px-1.5` accommodates two+ digits

**Column header structure**:
```tsx
<div className="flex items-center justify-between gap-2">
  <h2 className="text-sm font-semibold text-text-primary truncate">{column.name}</h2>
  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
                   rounded-full text-xs font-medium bg-border text-text-secondary
                   shrink-0 tabular-nums">
    {column.cards.length}
  </span>
</div>
```

Note: `tabular-nums` ensures badge width doesn't shift as count changes from single to double digit.

---

## UX-Q8: Empty States

### Decisions

#### Empty Column (0 cards)

Render a dashed-border placeholder in the card list area:

```
┌──────────────────────────────────────┐
│  Column Name                     0   │
├──────────────────────────────────────┤
│  ╔════════════════════════════════╗  │
│  ║                                ║  │
│  ║   No cards yet                 ║  │  text-text-disabled text-sm text-center
│  ║   + Add a card to get started  ║  │  (links to AddCardForm trigger)
│  ║                                ║  │
│  ╚════════════════════════════════╝  │
│  + Add a card                        │
└──────────────────────────────────────┘
```

Classes:
```
flex flex-col items-center justify-center
min-h-[100px] p-4 rounded-lg
border-2 border-dashed border-border
text-text-disabled text-sm text-center
mx-2 my-1
```

The "No cards yet" text is static. Do NOT use a call-to-action inside the empty state that duplicates the "+ Add a card" button — the dashed box is purely visual guidance; the action is the existing trigger button below it.

#### Zero Columns (Board has no columns)

Per the spec, this state "shouldn't happen" because default columns are seeded on board creation. If it does occur (data integrity issue), render:

```
<div className="flex flex-col items-center justify-center flex-1 gap-3 p-8 text-center">
  <p className="text-text-secondary text-sm">
    This board has no columns. Contact your administrator.
  </p>
</div>
```

No "Create column" CTA — column creation is out of scope for FEAT-003.

#### Loading State

Use **skeleton columns** — 3 skeleton placeholders (matching the seeded default of 3 columns). Each skeleton column contains 2 skeleton card tiles.

Skeleton classes (animated shimmer using Tailwind's `animate-pulse`):
```
Column skeleton:
flex-shrink-0 w-[300px] rounded-xl bg-surface-sidebar border border-border p-3

Column header skeleton:
h-5 w-24 bg-border rounded animate-pulse mb-3

Card skeleton:
h-20 bg-border rounded-lg animate-pulse mb-2
```

Rationale: Skeletons over a spinner because the board layout is known (columns + cards), so matching the layout skeleton reduces perceived load time (layout shift is minimal when real content arrives). A spinner (Option not listed in Q8 but implied) would be acceptable too — skeleton is preferred for complex structured content.

Implementation tip: render a fixed `[3]` skeleton columns array (hardcoded count) since we know boards default to 3 columns. This avoids layout shift.

#### Error State (fetch failed)

Already defined in spec (AC-ERROR-2). Render `<BoardErrorPanel>` inside `<main>`:

```tsx
<div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
  <p className="text-text-primary font-medium">We couldn't load this board</p>
  <p className="text-text-secondary text-sm">{error.message}</p>
  <button
    onClick={onRetry}
    className="bg-primary hover:bg-primary-hover text-primary-foreground
               text-sm font-medium px-4 py-2 rounded-md
               focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
               transition-colors duration-150"
  >
    Retry
  </button>
</div>
```

---

## Component Design Guidance

### BoardView

**Responsibility**: Top-level board UI container. Owns the `DndContext`, renders the horizontal column rail, and handles the `onDragEnd` event that triggers the `useMoveCard()` mutation.

**Layout structure**:
```tsx
// src/components/board/BoardView.tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <div
    className="flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto"
    aria-label="Kanban board columns"
    role="region"
  >
    {board.columns.map((column) => (
      <SortableContext
        key={column.id}
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <Column column={column} />
      </SortableContext>
    ))}
    {/* DragOverlay renders the ghost card during drag */}
    <DragOverlay dropAnimation={defaultDropAnimation}>
      {activeCard ? <CardTile card={activeCard} isDragOverlay /> : null}
    </DragOverlay>
  </div>
</DndContext>
```

**Tailwind classes summary**:
- Board scroll rail: `flex flex-row gap-3 h-full px-4 py-4 overflow-x-auto`
- Ensure the `<main>` element in `AppShell` already has `overflow-auto` (confirmed: `AppShell.tsx:21` has `overflow-auto` on the `<main>` tag). The board container inside `main` should use `h-full` to fill the available vertical space.

### Column

**Responsibility**: Renders a single Kanban column with a sticky header, scrollable card list, and add-card slot.

**Header structure**:
```tsx
// Column header
<div className="sticky top-0 z-10 bg-surface-sidebar px-3 pt-3 pb-2 border-b border-border">
  <div className="flex items-center justify-between gap-2">
    <h2 className="text-sm font-semibold text-text-primary truncate">{column.name}</h2>
    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
                     rounded-full text-xs font-medium bg-border text-text-secondary
                     shrink-0 tabular-nums">
      {column.cards.length}
    </span>
  </div>
</div>
```

**Column container**:
```
flex-shrink-0 w-[300px] flex flex-col rounded-xl
bg-surface-sidebar border border-border
max-h-full overflow-y-auto
```

**Card list**:
```
flex flex-col gap-2 p-2 flex-1
```

**Full column structure sketch**:
```
┌────────────────────────────────────────┐
│  [sticky] In Progress              3   │  ← sticky top header
├────────────────────────────────────────┤
│  [CardTile]                            │
│  [CardTile]                            │   ← overflow-y-auto card list
│  [CardTile]                            │
│                                        │
│  ┌────────────────────────────────┐    │  ← empty state (if 0 cards)
│  │  No cards yet                  │    │
│  └────────────────────────────────┘    │
├────────────────────────────────────────┤
│  + Add a card                          │  ← AddCardForm (pinned to bottom)
└────────────────────────────────────────┘
```

### CardTile

**Anatomy**:
```
┌──────────────────────────────────────────────────────┐
│  ⠿  Card title text here                             │
│     Description preview (up to 120 chars, truncated) │
│     May 22    [bug]  [frontend]                      │
└──────────────────────────────────────────────────────┘
```

**Tailwind classes**:

Card wrapper (drag container):
```
group relative bg-surface-card rounded-lg border border-border
shadow-sm hover:shadow-md transition-shadow duration-150
p-3 cursor-default
```

During drag (applied via `isDragging` from `useSortable`):
```
opacity-30 border-dashed
```

Drag overlay ghost:
```
bg-surface-card rounded-lg border border-border shadow-xl
rotate-1 scale-105 p-3
```

Content layout:
```tsx
<div className="flex items-start gap-2">
  {/* Drag handle */}
  <button
    {...listeners}  // dnd-kit drag listeners
    {...attributes} // dnd-kit drag attributes
    className="opacity-0 group-hover:opacity-100 transition-opacity duration-100
               text-text-disabled hover:text-text-secondary
               cursor-grab active:cursor-grabbing
               flex-shrink-0 mt-0.5 p-0.5 -ml-1 rounded"
    aria-label="Drag to reorder card"
    tabIndex={0}
  >
    <GripVerticalIcon className="h-4 w-4" />
  </button>

  {/* Card body — clickable */}
  <button
    onClick={() => !isDragging && navigate(`/boards/${boardId}/cards/${card.id}`)}
    className="flex-1 text-left min-w-0 focus:outline-none focus:ring-2
               focus:ring-primary focus:ring-offset-1 rounded"
  >
    {/* Title */}
    <p className="text-sm font-medium text-text-primary leading-snug mb-1">{card.title}</p>

    {/* Description preview */}
    {card.description && (
      <p className="text-xs text-text-secondary line-clamp-2 mb-2">
        {card.description}
      </p>
    )}

    {/* Footer: due date + labels */}
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {card.dueDate && (
        <span className="text-xs text-text-secondary">
          {formatDate(card.dueDate)}  {/* e.g. "May 22" */}
        </span>
      )}
      {card.labels.map((label) => (
        <LabelChip key={label.id} label={label} />
      ))}
    </div>
  </button>
</div>
```

**Label chip (`LabelChip`)**:
```tsx
<span
  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
  style={{ backgroundColor: label.color + '20', color: label.color }}
  // Note: label.color is a hex value (e.g. #be123c)
  // If label colors use the 6 semantic tokens, map to Tailwind classes instead:
  // bg-rose-100 text-rose-700, etc.
>
  {label.name}
</span>
```

**Note on label colors**: The `Label.color` field in `domain.ts` is `string` (hex or semantic token). For the label chip, if the backend stores semantic color names (`rose`, `amber`, `emerald`, `sky`, `violet`, `orange`), map to Tailwind classes. If storing hex values, use inline `style` with alpha-modified background. Recommend backend stores semantic names from the TASK-002 label palette — this enables pure Tailwind class usage.

**Description preview**: Use CSS `line-clamp-2` (Tailwind built-in since v3.3) rather than JS truncation to 120 characters. `line-clamp-2` is more responsive to varying card widths. Fall back to JS truncation (`description.slice(0, 120) + '...'`) only if line-clamp creates visual issues.

**Due date formatting**: Use a simple formatter, not a heavy library like `date-fns`. For MVP:
```typescript
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // → "May 22"
}
```

**Due date overdue styling**: If `new Date(card.dueDate) < new Date()`, render due date in `text-red-600` to signal urgency.

### AddCardForm

**Open and closed states**:

```tsx
// src/components/card/AddCardForm.tsx
export function AddCardForm({ columnId, onAdd }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOpen = () => {
    setIsOpen(true);
    // autoFocus via ref after state update
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onAdd(columnId, title.trim());
    setTitle('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
    if (e.key === 'Escape') { setIsOpen(false); setTitle(''); }
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-md
                   text-sm text-text-secondary hover:text-text-primary hover:bg-nav-hover
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                   transition-colors duration-100"
      >
        <PlusIcon className="h-4 w-4 flex-shrink-0" />
        Add a card
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 bg-surface-card rounded-lg border border-border shadow-sm">
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Card title"
        rows={3}
        className="w-full resize-none rounded-md border border-border p-2 text-sm text-text-primary
                   bg-surface-card placeholder:text-text-disabled
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        aria-label="New card title"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className="bg-primary hover:bg-primary-hover text-primary-foreground
                     text-sm font-medium px-3 py-1.5 rounded-md
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-colors duration-100"
        >
          Add Card
        </button>
        <button
          onClick={() => { setIsOpen(false); setTitle(''); }}
          className="text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md
                     hover:bg-nav-hover
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-colors duration-100"
          aria-label="Cancel add card"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

**Submit on Ctrl+Enter / Cmd+Enter** is the keyboard submit trigger (not bare Enter, which is a newline in a `<textarea>`). The "Add Card" button is the explicit submit for mouse users.

---

## Tailwind Token Reference

| Component | Token(s) Used | Purpose |
|-----------|---------------|---------|
| Board background | `bg-surface-page` | Page-level background fill |
| Column background | `bg-surface-sidebar` | Column container background |
| Card tile | `bg-surface-card` | White card surface |
| Card border | `border-border` | Subtle card boundary |
| Card hover shadow | `shadow-sm` → `hover:shadow-md` | Depth lift on hover |
| Column header border | `border-b border-border` | Header/card list divider |
| Column header text | `text-text-primary font-semibold` | Column name |
| Badge background | `bg-border` | Neutral pill fill (slate-200) |
| Badge text | `text-text-secondary` | Muted count text |
| Card title text | `text-text-primary` | Primary content text |
| Description preview | `text-text-secondary` | Muted secondary text |
| Due date text | `text-text-secondary` | Muted date |
| Due date overdue | `text-red-600` | Urgency signal (Tailwind built-in, not token) |
| Drag handle icon | `text-text-disabled` + `hover:text-text-secondary` | Subtle handle affordance |
| Add-card trigger text | `text-text-secondary` + `hover:text-text-primary` | Discoverable but quiet |
| Add-card hover bg | `hover:bg-nav-hover` | Hover surface match sidebar items |
| Primary button | `bg-primary hover:bg-primary-hover text-primary-foreground` | CTA actions |
| Focus ring | `focus:ring-2 focus:ring-primary focus:ring-offset-1` | WCAG keyboard focus |
| Empty state border | `border-2 border-dashed border-border` | Empty column indicator |
| Empty state text | `text-text-disabled` | Non-interactive guidance text |
| Label chips | `bg-{color}-100 text-{color}-700` (rose/amber/emerald/sky/violet/orange) | User-defined label colors |
| Skeleton pulse | `bg-border animate-pulse rounded-lg` | Loading skeleton shimmer |
| Error/rollback toast | sonner `toast.error()` | Non-blocking error notification |

**Tokens NOT yet in `tailwind.config.ts` that MUST be added**:

The current `tailwind.config.ts` (TASK-002) does not include the `label` palette or `surface-raised` token. TASK-003 must extend the config:

```typescript
// Add to tailwind.config.ts colors extension:
surface: {
  page: '#f8fafc',
  sidebar: '#f1f5f9',
  card: '#ffffff',
  // raised is used for badge background — use 'border' token instead (same value)
},
label: {
  rose:    { bg: '#ffe4e6', text: '#be123c' },
  amber:   { bg: '#fef3c7', text: '#b45309' },
  emerald: { bg: '#d1fae5', text: '#047857' },
  sky:     { bg: '#e0f2fe', text: '#0369a1' },
  violet:  { bg: '#ede9fe', text: '#6d28d9' },
  orange:  { bg: '#ffedd5', text: '#c2410c' },
},
```

Note: `surface-raised` token from the original design spec is not yet in `tailwind.config.ts`. For the badge, use the existing `bg-border` token (slate-200, #e2e8f0) which serves the same semantic purpose. This avoids adding a new token for a single use case.

---

## User Context

### Target Users

- **Primary**: Team Member (individual contributor — dev, designer, PM): opens the board daily, drags cards to update status, occasionally adds new cards. Uses the board as a "what am I working on today?" dashboard.
- **Secondary**: Team Lead: reviews the board at a glance to spot bottlenecks (too many cards in "In Progress"); doesn't drag cards themselves often; scans column names and card counts.

### User Goals

1. See all in-progress work without scrolling or clicking — board renders columns + cards immediately on load.
2. Update card status by dragging — should feel instant and effortless, not trigger a visible network delay.
3. Add new cards without leaving the board context — inline add-card keeps focus in the board.

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Review board at standup | Team Member / Lead | See column states and counts at a glance | Daily |
| Move card to Done | Team Member | Drag card from In Progress → Done | Multiple times daily |
| Create a new task | Team Member | Add card to To Do column | Several times per week |
| Review card detail | Team Member | Click card to read full description | Weekly |
| Recover from failed drag | Team Member | See rollback + error message, retry | Rare |

---

## Responsive Behavior

| Breakpoint | Board Changes |
|------------|---------------|
| ≥ 1024px (desktop) | Full sidebar (256px) + scrollable board; 3 columns visible before horizontal scroll |
| 768–1023px (tablet) | Sidebar hidden (burger menu); full board width available; 2.5 columns visible before scroll |
| < 768px (mobile) | Post-MVP — not implemented |

---

## Accessibility Requirements

- [x] Keyboard navigation: Tab to each column's "+ Add a card" button, Enter opens form, Ctrl+Enter submits, Escape cancels
- [x] Keyboard DnD: dnd-kit `KeyboardSensor` + `sortableKeyboardCoordinates`; Space picks up card, arrow keys move between columns, Space drops
- [x] Card click: Tab to card body `<button>`, Enter navigates to card detail route
- [x] Drag handle: focusable `<button>` with `aria-label="Drag to reorder card"`
- [x] Column headers: `<h2>` semantic heading per column
- [x] Card count badge: `aria-label` on the badge span, e.g. `aria-label="{count} cards"`
- [x] Error toast: `role="status"` / `aria-live="assertive"` via sonner
- [x] Focus indicators: `focus:ring-2 focus:ring-primary focus:ring-offset-1` on all interactive elements
- [x] Color contrast: All text/background combinations use TASK-002 verified tokens (all ≥ 4.5:1)
- [x] Loading state: skeletons have `aria-busy="true"` on the board container, and `aria-label="Loading board"` on the skeleton wrapper

---

## Validation Checklist

- [x] Meets all user goals (board renders live data; drag is instant; add-card is in-context)
- [x] Accessible per WCAG 2.1 AA requirements (keyboard DnD, click navigation, focus rings, ARIA labels)
- [x] Consistent with existing patterns (TASK-002 tokens, AppShell layout, Inter font, shadow conventions)
- [x] Respects Guiding Principles: Simplicity over Cleverness (no custom scroll JS; CSS sticky; Trello-pattern form); No Premature Abstractions (no shared label component until FEAT-004 uses it)
- [x] Responsive across target devices (desktop + tablet covered)
- [x] Performance acceptable (sonner 2.6kB; skeleton over spinner; CSS sticky over JS observer)
- [x] Implementation feasible within FEAT-003 build phases

---

## Next Steps

1. **Phase 3 (BoardView render)**: Implement `BoardView`, `Column`, `CardTile`, `AddCardForm`, `CardSkeleton`, `BoardErrorPanel` per the component guidance above. Add the label palette to `tailwind.config.ts`.
2. **Phase 4 (DnD + optimistic updates)**: Wire dnd-kit sensors with `activationConstraint: { distance: 4 }`, implement `useMoveCard()` with TanStack Query `onMutate`/`onError`, add `sonner` `<Toaster />` + `toast.error()` call.
3. **Phase 5 (Add-card)**: Wire `AddCardForm` to `useCreateCard()` mutation hook.
4. **New route**: Add `/boards/:boardId/cards/:cardId` placeholder route to `src/router/index.tsx` before Phase 3 completes.
