# UI/UX Decision: Activity Feed Panel Layout & Presentation

**Created**: 2026-05-25
**Status**: DECIDED
**Decision Type**: UI/UX

---

## User Context

### Target Users

- **Primary**: Team Lead — wants to monitor team activity at a glance without interrupting their board workflow. Needs to see who is moving work forward and spot bottlenecks in real time.
- **Secondary**: Team Member — wants confirmation that their own actions (card created, moved, updated) were recorded, and wants ambient awareness of what teammates are doing simultaneously.

### User Goals

1. Open the activity feed quickly without losing their place in the board.
2. Scan recent events (card created, moved, updated) with enough context to understand what happened and where, without clicking into individual cards.
3. Close the feed equally quickly when they no longer need it, and have the full board return to normal without any layout disruption.

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Daily standup check | Team Lead | Review last hour of activity before standup | Daily |
| Ambient awareness | Team Member | Glance at feed while working on board | Multiple times/day |
| Post-action confirmation | Team Member | Confirm their drag-drop registered correctly | On each action |
| Connection loss recovery | Any | See reconnecting indicator; understand feed is temporarily paused | Occasional |
| Error recovery | Any | Understand live updates are down; retry without reloading board | Rare |

### Constraints

- **Devices**: Desktop ≥1024px primary; tablet 768–1023px secondary; mobile not in scope for MVP
- **Accessibility**: WCAG 2.1 AA (best-effort); keyboard toggle (Enter/Space); panel focusable; `role="log"` + `aria-live="polite"`; `<time datetime={iso}>` on timestamps; focus trap not required (panel is additive, not modal)
- **Existing Patterns**: shadcn/ui primitives; Tailwind utility classes with the project's custom token set (`surface-*`, `text-*`, `border`, `primary`); no custom CSS frameworks; Inter font; muted color palette with `primary: #4f46e5` as accent
- **Board Layout**: `BoardView` renders a `flex flex-col h-full` outer shell containing `BoardHeader` (fixed 56px `shrink-0`) and a `flex-1 overflow-hidden relative` inner area that holds the horizontally scrolling column region. Any panel must integrate within or alongside this shell without breaking the column scroll area.
- **Horizontal Scroll**: Columns are `flex-shrink-0 w-[300px]` items in an `overflow-x-auto` row. A right-side element at the same DOM level as the column area compresses the available scroll viewport — columns themselves do not shrink.

---

## User Flow

### Flow Diagram

```
[Board loaded at /boards/:id]
        |
        v
[BoardHeader visible — Activity toggle button always present]
        |
        v
[User clicks "Activity" toggle button (or keyboard Enter/Space)]
        |
        v
[Feed panel opens] ──────────────────────────────────────────┐
        |                                                     |
        v                                                     |
[Initial REST load: GET /api/boards/:id/activity]           (SSE connecting)
        |                            |                        |
  [Entries exist]             [No entries]              [SSE connected]
        |                            |                        |
        v                            v                        v
[Reverse-chron list]        [Empty state shown]        [Live events append at top]
        |
        v
[User reads entries / watches live updates]
        |
        +──────────────────────────────────────────────────────┐
        |                                                      |
[Connection drops]                                   [User clicks toggle / presses Escape]
        |                                                      |
        v                                                      v
[Reconnecting indicator (non-blocking)]              [Panel closes; board full-width restored]
        |                                            [SSE connection closed]
[Auto-reconnect succeeds] → [Indicator cleared]
        |
[Auto-reconnect fails after retry] → [Error state: "Live updates unavailable" + Retry button]
```

### Flow Description

1. **Entry**: User is on a board page (`/boards/:id`). The Activity toggle button is always visible in `BoardHeader`, to the left of "New Card".
2. **Toggle open**: User clicks the button (or presses Enter/Space with focus on the button). `activityOpen` state in `BoardView` changes to `true`. Panel mounts and renders.
3. **Initial load**: `useActivityFeed` fires `GET /api/boards/:id/activity` (REST). Skeleton or loading indicator appears while fetching.
4. **Live connection**: `EventSource` connection opens to `GET /api/boards/:id/activity-stream`. Status shows "Live" (subtle indicator) once connected.
5. **Reading entries**: User scans the reverse-chronological list. Each entry shows event type, card title, column info (for moves), and relative timestamp.
6. **Connection disruption**: SSE drops → "Reconnecting..." status bar appears at top of panel (non-blocking; entries remain readable). Browser-native `EventSource` retries automatically.
7. **Persistent failure**: After retries fail → error state replaces status bar: "Live updates unavailable" + "Retry" button.
8. **Exit**: User clicks the toggle button again (or presses Escape). Panel unmounts. `EventSource` closed. Board columns return to full available width.

### Error States

| Error | Cause | User Recovery |
|-------|-------|---------------|
| Initial load failure | REST endpoint returns non-200 | Inline error message in panel with "Retry" button |
| SSE connection drop | Network interruption, server restart | "Reconnecting..." indicator; auto-retry via browser EventSource |
| SSE unavailable (persistent) | Non-200 on stream endpoint, proxy blocking | "Live updates unavailable" + manual "Retry" button |
| Empty feed | No events recorded yet for board | Empty state: "No activity yet" with subtle icon |
| Panel keyboard focus lost | Panel mount without focus management | Toggle button retains focus; Tab moves into panel naturally |

---

## Options Explored

### Option 1: Right-Side Slide-Over Drawer (Overlapping)

- **Approach**: The feed panel renders as a fixed-position overlay anchored to the right edge of the board area, floating above the kanban columns. It does not shift the columns. Opened via the `activityOpen` state with a CSS slide-in transition from the right.

- **Wireframe/Layout** (desktop ≥1024px, feed open):
  ```
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  BoardHeader: [Board Name]  [Search]  [Filters]  [Activity ●]  [New Card]        │
  ├──────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                  │
  │  [Col: To Do]   [Col: In Progress]   [Col: Done]   ╔══════════════════════════╗ │
  │  ┌──────────┐   ┌──────────┐         ┌──────────┐  ║  Activity              × ║ │
  │  │  Card A  │   │  Card B  │         │  Card C  │  ╠══════════════════════════╣ │
  │  │  Card D  │   │  Card E  │         │          │  ║  ● Live                  ║ │
  │  │          │   │          │         │          │  ╠══════════════════════════╣ │
  │  └──────────┘   └──────────┘         └──────────┘  ║  ▸ Card moved          ║ │
  │                                   (columns visible) ║    "Task A" In Prog→Done║ │
  │                                                     ║    2 min ago            ║ │
  │                                                     ╠══════════════════════════╣ │
  │                                                     ║  ▸ Card created         ║ │
  │                                                     ║    "Task B" in To Do    ║ │
  │                                                     ║    5 min ago            ║ │
  │                                                     ╚══════════════════════════╝ │
  └──────────────────────────────────────────────────────────────────────────────────┘
  ```
  Panel width: ~320px. Z-index above column area. Positioned absolute within the `flex-1 overflow-hidden relative` container.

- **User Flow**: Board columns render normally at full width. Panel slides in from the right over the rightmost visible column. Columns behind the panel are still in the DOM (scroll-accessible) but obscured at the far right of the viewport.

- **Pros**:
  - Zero layout restructure — no changes to `BoardView` flex structure or column sizing
  - Fastest to implement — absolutely positioned within the existing `relative` container
  - Columns retain their full scroll width; board DnD is completely unaffected
  - Feels familiar (common drawer/notification-tray pattern from Linear, GitHub, Slack)
  - Closes cleanly with no reflow

- **Cons**:
  - Partially covers the rightmost visible column(s) — violates AC-ENTRY-1 ("no board columns obscured on desktop ≥1024px when feed is open")
  - User cannot view and interact with far-right columns simultaneously with the feed open
  - A dismiss gesture to see the column underneath is an extra step
  - On narrower desktops (1024–1280px) with 3–4 columns, coverage is significant

- **Usability**: Medium — convenient to open, but the overlap creates friction for multi-column boards
- **Accessibility**: High — absolute positioning does not affect DOM order; keyboard navigation unaffected; panel can be mounted after column content
- **Implementation Complexity**: Low

---

### Option 2: Right-Side Panel That Pushes Board Columns Left

- **Approach**: The feed panel is a fixed-width sibling element in the `BoardView` flex row alongside the kanban area. When open, the column scroll container shrinks to `flex-1` and the feed panel occupies a fixed `w-80` (320px) slice on the right. Columns compress into a narrower scroll viewport.

- **Wireframe/Layout** (desktop ≥1024px, feed open):
  ```
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  BoardHeader: [Board Name]  [Search]  [Filters]  [Activity ●]  [New Card]        │
  ├────────────────────────────────────────────────────┬─────────────────────────────┤
  │                                                    │  Activity               ×   │
  │  [Col: To Do]   [Col: In Progress]   [Col: Done]  │  ─────────────────────────  │
  │  ┌──────────┐   ┌──────────┐         ┌──────────┐ │  ● Live                     │
  │  │  Card A  │   │  Card B  │         │  Card C  │ │  ─────────────────────────  │
  │  │  Card D  │   │  Card E  │         │          │ │  ▸ Card moved               │
  │  └──────────┘   └──────────┘         └──────────┘ │    "Task A"                 │
  │   ◀────────── scroll viewport narrows ───────────▶ │    In Progress → Done       │
  │                 (columns still 300px each,          │    2 min ago                │
  │                  but viewport is ~70% of screen)    │  ─────────────────────────  │
  │                                                    │  ▸ Card created             │
  │                                                    │    "Task B" in To Do        │
  │                                                    │    5 min ago                │
  └────────────────────────────────────────────────────┴─────────────────────────────┘
  ```
  Panel is a `flex-shrink-0 w-80 border-l` sibling. Column area becomes `flex-1 overflow-x-auto`.

- **User Flow**: When panel opens, `BoardView`'s inner content area transitions from a single full-width scroll zone to a split — column scroll region + panel. Columns are not obscured; they are fully accessible via horizontal scroll in a narrower viewport.

- **Pros**:
  - No columns are ever obscured — satisfies AC-ENTRY-1 fully
  - Panel and board visible simultaneously; natural split-pane mental model
  - Column DnD is completely unaffected (columns still 300px; drop zones intact)
  - Panel is part of normal document flow; consistent z-index behavior
  - Natural sibling layout with a border separator (matches the `border-b` pattern in BoardHeader)

- **Cons**:
  - Requires restructuring the `flex-1 overflow-hidden relative` inner area in `BoardView` to a `flex flex-row` with two children
  - On 1024px viewport with 3 columns: `3 × 300px = 900px` of column content + `320px` panel = `1220px` scroll width; viewport is only `704px` — users must scroll more to see the third column
  - Board feels "squeezed" on narrower desktops; columns require more scrolling
  - Layout transition (panel slide-in + width animation) may cause a brief reflow visible to users
  - `DndContext` wraps the column area — the outer flex restructure must not inadvertently change the DnD context boundary

- **Usability**: High — no obscuring, split-pane is familiar from Linear/Notion
- **Accessibility**: High — document-flow position is logical; keyboard navigation natural
- **Implementation Complexity**: Medium — requires `BoardView` inner layout restructure and careful DnD context boundary preservation

---

### Option 3: Bottom-Anchored Collapsible Strip

- **Approach**: The feed panel is a horizontal strip anchored to the bottom of the viewport/board area. It expands upward from the bottom edge when toggled, reducing the available height for the board columns (which remain at full width). The strip shows entries in a horizontal row or a short vertical list in a constrained height.

- **Wireframe/Layout** (desktop ≥1024px, feed open):
  ```
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  BoardHeader: [Board Name]  [Search]  [Filters]  [Activity ●]  [New Card]        │
  ├──────────────────────────────────────────────────────────────────────────────────┤
  │                                                                                  │
  │  [Col: To Do]     [Col: In Progress]     [Col: Done]                             │
  │  ┌────────────┐   ┌────────────┐         ┌──────────┐                            │
  │  │  Card A    │   │  Card B    │         │  Card C  │                            │
  │  │  Card D    │   │  Card E    │  (column height reduced)                        │
  │  └────────────┘   └────────────┘         └──────────┘                            │
  │                                                                                  │
  ├──────────────────────────────────────────────────────────────────────────────────┤
  │  Activity Feed  ● Live                                                       [×] │
  ├──────────────────────────────────────────────────────────────────────────────────┤
  │  ▸ Card moved "Task A" In Progress → Done  2 min ago                             │
  │  ▸ Card created "Task B" in To Do  5 min ago                                    │
  │  ▸ Card updated "Task C"  12 min ago                                             │
  └──────────────────────────────────────────────────────────────────────────────────┘
  ```
  Panel height: ~200px. Columns still full-width but vertically compressed.

- **User Flow**: Feed opens as a bottom drawer. Columns remain fully accessible at full width (no horizontal compression). But column cards are visible in a shorter vertical window, requiring more vertical scroll within columns.

- **Pros**:
  - Full column width preserved — no horizontal compression
  - Familiar bottom-panel pattern from VS Code, browser DevTools, Jira issue detail
  - Columns are never obscured horizontally
  - Columns remain visible above the feed simultaneously

- **Cons**:
  - Reduces vertical space for board columns — columns with many cards require more scrolling, directly competing with the feed's own scroll
  - Activity feed entries are designed around a narrow vertical list; a wide horizontal strip wastes the layout and reads awkwardly
  - Text-heavy event entries (card title + column names + timestamp) are harder to scan horizontally in a strip than vertically in a column
  - Least aligned with how existing activity feeds are presented in comparable tools (Linear, GitHub, Slack sidebar all use vertical panels)
  - The board's primary interaction axis (horizontal column scroll) is perpendicular to the feed's natural reading axis — the layout creates visual tension
  - Animation (expand upward) compresses the column area with a jarring reflow
  - Doesn't match the existing sidebar and header visual language (vertical panels are the established pattern)

- **Usability**: Low-Medium — columns unobscured horizontally, but vertical compression and horizontal entry layout create poor reading UX
- **Accessibility**: Medium — no columns obscured; but scrollable feed content in a bottom strip is harder to navigate with keyboard/screen reader in the context of the board above it
- **Implementation Complexity**: Medium — requires adjusting the `flex flex-col h-full` layout to accommodate a variable-height bottom strip

---

## Evaluation Matrix

| Criteria | Option 1: Slide-Over Drawer | Option 2: Push Panel | Option 3: Bottom Strip |
|----------|-----------------------------|----------------------|------------------------|
| Usability | Medium — columns obscured | **High** — full column access | Low-Medium — awkward reading axis |
| Accessibility | High | **High** | Medium |
| Consistency with existing patterns | High — drawer is familiar | **High** — split-pane familiar | Low — breaks vertical panel language |
| AC-ENTRY-1 compliance | **FAIL** — columns obscured | **PASS** | **PASS** |
| Horizontal-scroll compatibility | Medium — competes for rightmost view | **High** — narrow but intact | High — full width preserved |
| Performance | High — no reflow | Medium — one-time layout shift | Medium — one-time layout shift |
| Implementation effort | **Low** | Medium | Medium |
| "Calm, productivity-focused" feel | Medium — overlay can feel intrusive | **High** — clean split-pane | Low-Medium — awkward proportions |

---

## Decision

**Chosen**: Option 2 — Right-Side Panel That Pushes Board Columns Left

### Rationale

Option 2 is the only design that satisfies AC-ENTRY-1 (no board columns obscured on desktop ≥1024px) while also delivering a calm, legible feed experience that aligns with the productivity tool aesthetic.

**Why not Option 1**: Despite its low implementation cost, Option 1 fails the explicit acceptance criterion that no columns be obscured when the feed is open. A slide-over drawer that covers the rightmost column is a meaningful UX regression for users with 3+ columns — the most common board layout. The entire value of an activity feed is "monitor without losing context," and covering the board undermines that.

**Why not Option 3**: The bottom strip pattern forces activity entries — which are inherently vertical, text-rich, multi-line items — into a horizontal strip that reads poorly. The primary interaction model (horizontal column scroll) is perpendicular to how entries would be scanned. This option also vertically compresses the most important part of the product (the kanban columns) without a proportional UX benefit. It is the weakest of the three for this specific content type.

**Why Option 2**: The split-pane push panel is the standard solution used by Linear (right-side detail panels), GitHub Projects (right-side filters), and Notion (right-side page info). It is immediately legible: the board is on the left, the feed is on the right, and both are accessible. The panel integrates naturally as a sibling in the `BoardView` inner flex row, uses the project's existing border and surface tokens, and can be animated with a smooth width transition that avoids jarring reflow. The "column viewport narrows" trade-off is real — on a 1024px screen with the feed open, users see fewer columns without scrolling — but this is mitigated by: (a) the panel has a clear close button, (b) users who need to interact with far columns can quickly close the feed with Escape, (c) the feed is an optional overlay on top of a fully functional board, not a persistent split.

### Trade-offs Accepted

- **Narrower column viewport when feed is open**: On a 1024px wide viewport with 3+ columns and a 320px panel, users see only ~2 columns without horizontal scrolling. Mitigated by: clear toggle to close, Escape key close, and the fact that viewing the feed is a deliberate, temporary mode — not the default board state.
- **`BoardView` inner layout restructure required**: The `flex-1 overflow-hidden relative` inner container must become `flex flex-row overflow-hidden`. This is a contained, one-file change to `BoardView.tsx` and does not affect `DndContext` boundaries (DnD wraps column content inside the scroll region, not the outer container).

---

## Design Specifications

### Layout

- **Desktop (≥1024px)**: `BoardView` inner area = `flex flex-row h-full overflow-hidden`. Column scroll region = `flex-1 overflow-x-auto`. Feed panel = `flex-shrink-0 w-80 border-l border-border flex flex-col bg-surface-card`. Panel animated in: `transition-all duration-200 ease-out` with `w-0 opacity-0` → `w-80 opacity-100`.
- **Tablet (768–1023px)**: Same split-pane layout but panel width narrows to `w-72` (288px) to preserve column visibility. At 768px with 2 columns (600px) + panel (288px) = 888px scroll width, which is acceptable.
- **Mobile (<768px)**: Not in scope for MVP. Feed panel is hidden; toggle button is hidden.

### BoardHeader Toggle Button

**Icon choice**: A clock/history icon (`ClockIcon` or a simple SVG clock outline) communicates "recent activity" without requiring a text label to be understood. This is consistent with Linear's "Activity" icon in their board header.

**Label vs. icon-only**: Icon + short label ("Activity") rendered as text. Reasoning: BanyanBoard's header already uses text-label buttons ("New Card") and text-label controls ("Filters"). An icon-only button here would break the visual consistency of the header's control language. "Filters" uses a text label; "Activity" should too. Icon adds semantic clarity alongside the label.

**Placement**: Right side of the `BoardHeader` `flex-1` container, immediately to the left of "New Card". Matches the task plan's specification and the natural left-to-right reading order of header controls (search → filters → activity → new card).

**Toggle state styling**:
- Inactive: same style as "Filters" inactive state — `bg-nav-hover text-text-secondary hover:bg-border`
- Active/open: same as "Filters" active — `bg-primary text-primary-foreground`
- `aria-pressed` attribute reflects the `activityOpen` boolean state
- `aria-label="Toggle activity feed"` always present

**Exact button markup**:
```tsx
<button
  type="button"
  aria-pressed={activityOpen}
  aria-label="Toggle activity feed"
  onClick={onActivityToggle}
  className={`px-2.5 py-1 rounded-md text-xs font-medium focus:outline-none
    focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors
    duration-150 flex items-center gap-1
    ${activityOpen
      ? 'bg-primary text-primary-foreground'
      : 'bg-nav-hover text-text-secondary hover:bg-border'
    }`}
>
  {/* Clock icon */}
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
       stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
  Activity
</button>
```

### Feed Panel Header

```
┌────────────────────────────────┐
│  Activity              [×]    │   ← panel title left, close button right
├────────────────────────────────┤
│  [status indicator row]        │   ← "● Live" / "⟳ Reconnecting…" / error
├────────────────────────────────┤
│  [scrollable entries list]     │
└────────────────────────────────┘
```

- Panel heading: `<h2 className="text-sm font-semibold text-text-primary">Activity</h2>`
- Close button: `×` (×) with `aria-label="Close activity feed"` — same `text-text-secondary hover:text-text-primary` styling as other close/dismiss controls
- Panel role: `<aside aria-label="Activity feed">`
- Entries list: `<ol role="log" aria-live="polite" aria-label="Activity entries">`

### Activity Entry Format

Each `ActivityEntry` renders as a single list item (`<li>`) with:

```
[Icon]  [Description text]
        [Relative timestamp]
```

**Icon mapping** (inline SVG, 16×16, `text-text-secondary`):
| Event Type | Icon | Description template |
|------------|------|----------------------|
| `card_created` | Plus circle | "**{card title}** added to {column}" |
| `card_moved` | Arrow right | "**{card title}** moved from {from column} to {to column}" |
| `card_updated` | Pencil | "**{card title}** updated" |
| `card_deleted` | Trash (if implemented) | "**{card title}** deleted" |

**Card title** is rendered in `font-medium text-text-primary`; supporting text (`added to`, `moved from`, etc.) in `text-text-secondary`.

**Relative timestamp**: `<time datetime="{iso8601}" className="text-xs text-text-disabled">2 min ago</time>`

**Entry visual**:
```
┌────────────────────────────────────────────┐
│  [icon]  Task A moved                      │
│          from In Progress to Done          │
│          2 min ago                         │
└────────────────────────────────────────────┘
```
- Padding: `px-3 py-2`
- Separator: `border-b border-border` between entries (no separator after last)
- No background highlight on entries (calm, no noise)
- Hover state: subtle `hover:bg-surface-sidebar` for readability cue only

### Status Indicator Row (below panel header)

A single-row band below the panel title, above the entries list:

| State | Content | Styling |
|-------|---------|---------|
| `connecting` | Pulsing dot + "Connecting…" | `text-text-disabled text-xs` |
| `connected` | Green dot + "Live" | `text-emerald-600 text-xs` (or use a muted dot in `nav-active` color) |
| `reconnecting` | Animated spinner + "Reconnecting…" | `text-amber-600 text-xs` |
| `error` | Red dot + "Live updates unavailable" + "Retry" button | `text-rose-600 text-xs` |

**Reconnecting state** is non-blocking — the entry list remains scrollable and readable below the indicator.

**Error state** replaces the connecting indicator but does NOT replace the entries list — previously loaded entries stay visible.

### Empty State

When `entries.length === 0` and `status !== 'error'`:

```
┌──────────────────────────────────┐
│                                  │
│        [clock icon, 32px]        │
│                                  │
│      No activity yet             │   ← text-sm text-text-secondary
│  Actions on this board will      │
│  appear here as they happen.     │   ← text-xs text-text-disabled
│                                  │
└──────────────────────────────────┘
```

Copy:
- Primary: **"No activity yet"**
- Secondary: "Actions on this board will appear here as they happen."

### Error State Copy (persistent SSE failure)

Status indicator row shows:
- **"Live updates unavailable"** + `[Retry]` button
- Subtext below in `text-xs text-text-disabled`: "Historical entries are shown below."
- Previously loaded REST entries remain displayed (the feed is not blanked on SSE error)

### Reconnecting State Copy

Status indicator row shows:
- Animated spinner (CSS `animate-spin` on an SVG arc) + **"Reconnecting…"**
- No subtext; entries remain visible and readable

### Key Components

| Component | Purpose | Behavior |
|-----------|---------|----------|
| `BoardHeader` (modified) | Toggle button placement | Renders Activity toggle to the left of "New Card"; passes `onActivityToggle` prop |
| `BoardView` (modified) | Panel sibling layout | Inner area becomes `flex flex-row`; conditionally renders `ActivityFeedPanel` as right sibling |
| `ActivityFeedPanel` | Feed container | `<aside>` with panel header, status indicator, and scrollable entries list |
| `ActivityEntry` | Individual event row | `<li>` with icon, description, and `<time>` |
| `useActivityFeed` | Data + connection state | SSE lifecycle, initial REST load, entry state, `status` enum |

### Interactions

| Trigger | Action | Feedback |
|---------|--------|----------|
| Click "Activity" button | `activityOpen` toggles to `true` | Panel slides in from right; button changes to `bg-primary` active style; `aria-pressed="true"` |
| Click "Activity" button again | `activityOpen` toggles to `false` | Panel slides out; button returns to inactive style; `aria-pressed="false"` |
| Press Escape (keyboard) | If panel is open, close it | Same as button click; focus returns to toggle button |
| Click panel "×" close button | Close panel | Same as toggle; focus returns to toggle button |
| SSE connection drops | Auto-reconnect starts | "Reconnecting…" indicator appears in status row |
| SSE reconnect succeeds | Indicator clears | Status row returns to "● Live" |
| SSE persistent failure | Error state shown | "Live updates unavailable" + "Retry" button |
| Click "Retry" button | Re-initialize `EventSource` | Status transitions back to "Connecting…"; entries preserved |
| New SSE event received | Prepend entry to list | New entry slides in at top with `animate-fadeIn` (optional); `aria-live="polite"` announces to screen readers |

### Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| < 768px | Activity toggle button hidden; feed panel not rendered |
| 768–1023px | Panel width `w-72` (288px) instead of `w-80`; same push layout |
| ≥ 1024px | Full layout: panel `w-80` (320px); columns in `flex-1 overflow-x-auto` |

### Accessibility Requirements

- [x] Keyboard navigation support — toggle button focusable via Tab; Enter/Space to toggle; Escape to close panel
- [x] Screen reader compatibility — `<aside aria-label="Activity feed">`; `role="log"` on entries list; `aria-live="polite"` for live updates; `aria-pressed` on toggle button; `aria-label="Toggle activity feed"` on toggle button
- [x] Color contrast compliance (WCAG AA) — all text uses project token colors that meet AA contrast ratios; status indicators use color + icon/text (not color alone)
- [x] Focus indicators visible — inherits project's `focus:ring-2 focus:ring-primary focus:ring-offset-1` pattern
- [x] Error messages accessible — error state copy uses visible text + status indicator, not icon-only; "Retry" button is a proper `<button>` element
- [x] Timestamps — all relative timestamps wrapped in `<time datetime="{iso8601}">` for semantic accuracy

---

## Implementation Guidelines

### For Developers

1. **`BoardView.tsx` layout change** — The `div className="flex-1 overflow-hidden relative"` inner wrapper must become `div className="flex flex-row flex-1 overflow-hidden"`. The `DndContext` and column scroll `div` become the `flex-1 overflow-x-auto` child. The `ActivityFeedPanel` becomes a `flex-shrink-0` sibling to the right. The `Outlet` (for card modal) should remain inside the column area `div` so card modals render over columns, not over the feed panel.

2. **`BoardView.tsx` state** — Add `const [activityOpen, setActivityOpen] = useState(false)` to `BoardView`. Pass `activityOpen` and `onActivityToggle={() => setActivityOpen(prev => !prev)}` as props to `BoardHeader`. Conditionally render `{activityOpen && <ActivityFeedPanel boardId={boardId} onClose={() => setActivityOpen(false)} />}` as the right sibling. **`BoardDetailPage.tsx` does not need `activityOpen` state** — keep it in `BoardView` where all board-level state lives.

3. **`BoardHeader.tsx` change** — Add `activityOpen: boolean` and `onActivityToggle: () => void` props. Insert the Activity toggle button immediately before the existing "New Card" button in the right-side `flex` group.

4. **`ActivityFeedPanel.tsx`** — Render as `<aside>` with `w-80 flex-shrink-0 border-l border-border bg-surface-card flex flex-col h-full overflow-hidden`. The entries list `<ol>` should be `flex-1 overflow-y-auto`. The panel header is `flex-shrink-0`. The status row is `flex-shrink-0`. This ensures the panel header and status row stay pinned while entries scroll.

5. **Escape key close** — Add a `useEffect` in `ActivityFeedPanel` (or `BoardView`) that listens for `keydown Escape` and calls `onClose()` when `activityOpen` is true. This satisfies AC-CLOSE-1.

6. **Focus management** — When panel closes, return focus to the Activity toggle button in `BoardHeader`. Store a ref to the toggle button and call `ref.current.focus()` in the close handler.

7. **SSE cleanup** — `useActivityFeed` must close the `EventSource` in its cleanup function (`return () => eventSource.close()`). `ActivityFeedPanel` unmounts when `activityOpen` is false, triggering the hook cleanup automatically.

8. **Animation** — Use Tailwind `transition-all duration-200 ease-out` on the panel. Conditionally apply `w-80` vs `w-0` based on `activityOpen`. For mount/unmount animation, use a CSS transition on a persistent-but-hidden panel rather than conditional rendering (if smooth animation is desired). For MVP simplicity, conditional rendering without animation is acceptable.

### Component Structure

```
frontend/src/
├── components/
│   ├── board/
│   │   ├── BoardHeader.tsx          ← add activityOpen + onActivityToggle props + Activity button
│   │   └── BoardView.tsx            ← restructure inner layout + activityOpen state
│   └── activity/                    ← new directory
│       ├── ActivityFeedPanel.tsx    ← panel container; aside + header + status + entries
│       └── ActivityEntry.tsx        ← single entry; li + icon + description + time
├── hooks/
│   └── useActivityFeed.ts           ← SSE + REST + status state
├── api/
│   └── activitiesApi.ts             ← fetchActivity(boardId): Promise<ActivityEvent[]>
└── types/
    └── domain.ts                    ← add ActivityEvent type
```

### Recommended Libraries/Patterns

- **No new libraries needed** — browser-native `EventSource` API for SSE; no additional animation library (Tailwind CSS transitions sufficient); no additional icon library (project uses inline SVGs per existing pattern in `FiltersDropdown.tsx`)
- **Relative timestamps** — implement a simple `formatRelativeTime(iso: string): string` utility in `src/utils/` that uses `Date.now()` arithmetic: "just now" (<30s), "X min ago" (<60min), "X hr ago" (<24h), "{day} {month}" (older). No `date-fns` needed for this level of formatting.
- **`useActivityFeed` status enum** — `'connecting' | 'connected' | 'reconnecting' | 'error'` — map directly to the four SSE connection lifecycle states

---

## Validation Checklist

- [x] Meets all user goals — panel visible alongside board without obscuring columns; entries scannable; opens/closes cleanly
- [x] Accessible per requirements — keyboard toggle, aria-live, role="log", aria-pressed, time datetime, focus return on close
- [x] Consistent with existing patterns — uses same Tailwind tokens, same button style as Filters toggle, same inline SVG icon approach as FiltersDropdown
- [x] Respects Guiding Principles and component architecture in systemPatterns.md — no premature abstractions; `BoardView` holds state; no business logic in components; clean component-by-responsibility folder structure
- [x] Responsive across devices — push panel on ≥768px; hidden on mobile (MVP)
- [x] Performance acceptable — panel is a lightweight DOM addition; SSE is a single persistent connection per open panel; no polling
- [x] Implementation feasible — one file restructure (`BoardView`), two file prop additions (`BoardHeader`), two new components, one hook, one API function

---

## Exact Copy Inventory

| Location | Copy |
|----------|------|
| Toggle button label | "Activity" |
| Toggle button aria-label | "Toggle activity feed" |
| Panel heading | "Activity" |
| Panel close button aria-label | "Close activity feed" |
| Status: connecting | "Connecting…" |
| Status: connected | "Live" |
| Status: reconnecting | "Reconnecting…" |
| Status: error (primary) | "Live updates unavailable" |
| Status: error (subtext) | "Historical entries are shown below." |
| Error retry button | "Retry" |
| Empty state (primary) | "No activity yet" |
| Empty state (secondary) | "Actions on this board will appear here as they happen." |
| Entry: card_created | "{card title} added to {column}" |
| Entry: card_moved | "{card title} moved from {from column} to {to column}" |
| Entry: card_updated | "{card title} updated" |
| Entry: card_deleted | "{card title} deleted" |

---

## Next Steps

1. **Phase 3 build**: Implement `ActivityFeedPanel`, `ActivityEntry`, `useActivityFeed`, `activitiesApi` per this design spec, with `BoardView` inner layout restructure and `BoardHeader` toggle addition.
2. **Verify AC-ENTRY-1 visually**: After implementation, confirm no columns are obscured on a 1024px-wide viewport with 3 columns and the feed open.
3. **Verify keyboard flow**: Tab to toggle → Enter opens panel → Tab into panel entries → Escape closes panel → focus returns to toggle button.
4. **Relative timestamp utility**: Implement `formatRelativeTime` in `src/utils/` with a `setInterval` or hook to refresh timestamps every 30 seconds (entries ages change without new events).
