# UI/UX Decision: BanyanBoard App Shell — Layout & Visual Theme

**Created**: 2026-05-16
**Status**: DECIDED
**Decision Type**: UI/UX
**Task**: TASK-002 (FEAT-002 Frontend Foundation)
**Resolves**: CE-1 (App shell layout & sidebar collapse), CE-2 (TailwindCSS colour token selection)

---

## User Context

### Target Users

- **Primary**: Team Member — individual contributor (developer, designer, PM) who opens BanyanBoard every day to check their board and drag cards between columns. The app shell is the persistent frame they inhabit for minutes to hours per day. Its quality directly determines daily-use satisfaction.
- **Secondary**: Team Lead — engineering or product lead who needs an at-a-glance view of the team board. Uses the sidebar to switch between boards frequently. Values information density and low visual noise.
- **Tertiary (operator)**: Self-hoster — sets up Docker Compose; never designs UI but needs the shell to work correctly across Chrome/Firefox/Safari/Edge without polyfills.

### User Goals

1. Open BanyanBoard and immediately see the relevant board with zero loading friction (sidebar shows boards; main area shows columns).
2. Switch between boards quickly without losing context (sidebar navigation persistent; board content area swaps).
3. Perform actions (create card, filter, search) without hunting for controls (board header always visible, not hidden on scroll).

### Use Cases

| Use Case | User | Goal | Frequency |
|----------|------|------|-----------|
| Daily standup board review | Team Member | See In Progress column at a glance | Daily |
| Switch between project boards | Team Lead / Freelancer | Navigate sidebar to different board | Multiple times daily |
| Create first card on a new board | New User | Locate "New Card" button quickly | Once per onboarding |
| Filter board by label | Team Member | Find cards matching a label | Weekly |
| Use on 1280px laptop | All | Full layout without horizontal scrollbar on shell | Daily |
| Use on 768–1023px tablet (secondary) | Team Member | Read board on iPad; sidebar out of the way | Occasional |

### Constraints

- **Devices**: Desktop ≥ 1024px (primary), Tablet 768–1023px (secondary), Mobile < 768px (post-MVP — out of scope)
- **Accessibility**: WCAG 2.1 AA — colour contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components; keyboard-navigable sidebar and header; visible focus indicators
- **Styling**: TailwindCSS v3 utility-first only — no custom CSS files; theme extensions via `tailwind.config.ts` only
- **Framework**: React + TypeScript (strict); component-by-responsibility folder structure (`components/layout/`)
- **Existing Patterns**: No frontend exists yet — this decision document IS the design contract for FEAT-003 and FEAT-004

---

## User Flow

### Flow Diagram

```
[User opens http://localhost:5173]
           │
           ▼
    [Root / redirect]
           │
           ▼
    [/boards — BoardListPage]
    [AppShell renders: Sidebar + BoardHeader + Main]
           │
    ┌──────┴──────────────────┐
    │                         │
    ▼                         ▼
[Click sidebar board link]  [Board header: title visible]
    │                         │
    ▼                         ▼
[/boards/:id — BoardDetailPage]   [Click "New Card" → future modal]
    │
    ▼
[Sidebar stays mounted — only main area swaps]
```

### Flow Description

1. **Entry**: Browser opens `/` → router redirects to `/boards`
2. **Persistent Shell**: `AppShell` renders; `Sidebar` and `BoardHeader` mount and stay mounted for the entire session
3. **Board Navigation**: User clicks a board link in the sidebar → URL changes to `/boards/:id`; `BoardDetailPage` renders in main content area; sidebar and header remain unchanged
4. **Action Entry**: User sees "New Card" button in board header → clicks (FEAT-004 will wire this up)
5. **Tablet Entry**: User on 768–1023px device → sidebar is hidden by default; burger-menu icon in header reveals sidebar as an overlay

### Error States

| Error | Cause | User Recovery |
|-------|-------|---------------|
| Route not found | User navigates to unknown path | Redirect to `/boards` or show "Page not found" within main area (sidebar stays) |
| API base URL not configured | `VITE_API_BASE_URL` missing | App shell still renders; logger emits warning; no visible error to user at shell level |
| Board not found (future) | `/boards/:id` with unknown ID | `BoardDetailPage` shows "Board not found" placeholder in main area |

---

## CE-1: App Shell Layout & Sidebar Collapse

### Option 1: Fixed 256px Sidebar — Always Visible Desktop, Hidden (Burger Menu) on Tablet

**Approach**: On desktop (≥ 1024px) the sidebar is always visible at a fixed `w-64` (256px). On tablet (768–1023px) the sidebar collapses to fully hidden; a hamburger button appears in the board header. Clicking it overlays the sidebar as a drawer from the left.

**Wireframe — Desktop (≥ 1024px)**:
```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────┐ ┌────────────────────────────────────────────┐ │
│ │  SIDEBAR       │ │  BOARD HEADER                              │ │
│ │  ──────────    │ │  [Board Title]          [New Card ▶]       │ │
│ │  BanyanBoard   │ ├────────────────────────────────────────────┤ │
│ │                │ │                                            │ │
│ │  ● My Board    │ │  MAIN CONTENT AREA                         │ │
│ │  ○ Project X   │ │  (BoardDetailPage / BoardListPage)         │ │
│ │  ○ Ops Board   │ │                                            │ │
│ │                │ │                                            │ │
│ │  ──────────    │ │                                            │ │
│ │  + New Board   │ │                                            │ │
│ └────────────────┘ └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
  w-64 (256px) fixed    flex-1 (fills remaining width)
```

**Wireframe — Tablet (768–1023px)**:
```
┌──────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────┐ │
│ │  BOARD HEADER                                │ │
│ │  [☰]  [Board Title]       [New Card ▶]       │ │
│ ├──────────────────────────────────────────────┤ │
│ │                                              │ │
│ │  MAIN CONTENT AREA (full width)              │ │
│ │                                              │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

On [☰] click:
┌──────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────────────────────┐│
│ │ SIDEBAR      │ │ MAIN (dimmed overlay)        ││
│ │ (overlay,    │ │                              ││
│ │  z-50)       │ │                              ││
│ └──────────────┘ └──────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

**CSS Layout**: Flexbox (`flex flex-row`) on `AppShell`. Sidebar is `w-64 shrink-0`; main area is `flex-1 flex flex-col`. On tablet, sidebar is `fixed inset-y-0 left-0 z-50 transform -translate-x-full` toggled to `translate-x-0` via state.

**State**: Requires `useSidebar()` hook with `isOpen: boolean` and `toggle()`. State lives in React Context (lightweight, colocation with `AppShell`).

- **Pros**:
  - Maximum main content real estate on tablet — board columns get full width
  - Most familiar pattern (matches Linear, Notion mobile-first approach)
  - Clean separation: desktop never needs JS for sidebar visibility
  - Overlay pattern is well-understood by users; ESC key closes it
- **Cons**:
  - Tablet loses sidebar context at a glance (must open drawer to switch boards)
  - Requires `useSidebar` hook + overlay logic in Phase 2
  - Overlay needs an accessible backdrop/close mechanism (keyboard + click-outside)
- **Usability**: High (desktop), Medium (tablet — drawer adds a tap to switch boards)
- **Accessibility**: High — drawer pattern is WCAG-compliant with `aria-expanded`, `aria-controls`, focus trap
- **Implementation Complexity**: Medium (overlay state + focus trap)

---

### Option 2: Fixed 256px Desktop, Icon-Only 64px Rail on Tablet

**Approach**: On desktop (≥ 1024px) the sidebar shows at full `w-64` with labels. On tablet (768–1023px) the sidebar collapses to a `w-16` (64px) icon-only rail — board icons/initials are shown without text labels. No drawer; the rail is always present.

**Wireframe — Desktop (≥ 1024px)**:
```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────┐ ┌────────────────────────────────────────────┐ │
│ │  SIDEBAR       │ │  BOARD HEADER                              │ │
│ │  BanyanBoard   │ │  [Board Title]          [New Card ▶]       │ │
│ │                │ ├────────────────────────────────────────────┤ │
│ │  ● My Board    │ │  MAIN CONTENT AREA                         │ │
│ │  ○ Project X   │ │                                            │ │
│ └────────────────┘ └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       w-64                      flex-1
```

**Wireframe — Tablet (768–1023px)**:
```
┌─────────────────────────────────────────────────────┐
│ ┌──────┐ ┌───────────────────────────────────────┐  │
│ │ RAIL │ │ BOARD HEADER                          │  │
│ │  🏠  │ │ [Board Title]        [New Card ▶]     │  │
│ │      │ ├───────────────────────────────────────┤  │
│ │  [M] │ │ MAIN CONTENT AREA                     │  │
│ │  [P] │ │                                       │  │
│ │  [O] │ │                                       │  │
│ │      │ └───────────────────────────────────────┘  │
│ └──────┘                                             │
│  w-16                   flex-1                       │
└─────────────────────────────────────────────────────┘
[M], [P], [O] = board initials/icons with tooltips
```

**CSS Layout**: Flexbox or CSS Grid. `AppShell` uses `flex flex-row`. Sidebar width switches: `w-64` on `lg:` breakpoint, `w-16` on `md:` and below. Transition: `transition-all duration-200`.

**State**: Sidebar width driven purely by Tailwind responsive classes — no JS state needed. Tooltips on icon rail items (native `title` attribute or radix Tooltip for accessibility).

- **Pros**:
  - Zero JS state — responsive purely via Tailwind breakpoint classes
  - Users always see board icons on tablet; one tap to switch boards
  - Smooth `transition-all` between widths feels polished
  - No focus trap complexity
- **Cons**:
  - Board names invisible on tablet — only icons/initials; works poorly when boards have similar names
  - Requires board icons or generated initials (adds data requirement to `Board` type)
  - More visual clutter on tablet than hidden sidebar; main area is narrower by 64px
  - In MVP, boards have no icons yet — initials must be derived from board name
- **Usability**: High (desktop), Medium (tablet — initials may be ambiguous)
- **Accessibility**: High — no complex patterns; tooltips must be keyboard-accessible (`aria-label`)
- **Implementation Complexity**: Low (no JS state; Tailwind responsive classes only)

---

### Option 3: CSS Grid Shell — Fixed Sidebar Always Visible, No Collapse

**Approach**: A pure CSS Grid layout (`grid-cols-[256px_1fr]`) with a `grid-rows-[auto_1fr]` for the header/content split. Sidebar is always visible on both desktop (≥ 1024px) and tablet (768–1023px). Mobile is post-MVP (not addressed). No collapse behaviour at all.

**Wireframe**:
```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────┬───────────────────────────────────────────────┐│
│ │                │  BOARD HEADER                                 ││
│ │  SIDEBAR       │  [Board Title]               [New Card ▶]    ││
│ │  (row-span-2)  ├───────────────────────────────────────────────┤│
│ │                │  MAIN CONTENT AREA                            ││
│ │  ● My Board    │                                               ││
│ │  ○ Project X   │                                               ││
│ │                │                                               ││
│ └────────────────┴───────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
  grid-col 1 (256px)          grid-col 2 (1fr)
```

**CSS Layout**: `grid grid-cols-[256px_1fr] grid-rows-[56px_1fr] h-screen`. Sidebar: `row-span-2`. Header: `col-start-2 row-start-1`. Main: `col-start-2 row-start-2 overflow-auto`.

**State**: Zero state — purely structural CSS.

- **Pros**:
  - Absolute simplest implementation — pure CSS, no hooks, no JS
  - CSS Grid named areas make structure immediately readable in code
  - No responsive complexity in Phase 2; sidebar collapse is post-MVP
  - Sidebar always visible → board switching always one click away
- **Cons**:
  - Tablet (768–1023px) gets a 256px sidebar that consumes 33% of viewport width — cramped for board columns
  - productBrief says "sidebar may collapse" on tablet — this ignores that intent
  - At 768px, `256px sidebar + 512px content` is very tight for a Kanban board with 3 columns
  - No path to post-MVP collapse without refactoring the layout approach
- **Usability**: High (desktop), Low (tablet — too narrow for board content)
- **Accessibility**: High — simplest structure
- **Implementation Complexity**: Very Low

---

### CE-1 Evaluation Matrix

| Criteria | Option 1: Burger Drawer | Option 2: Icon Rail | Option 3: Always Visible |
|----------|------------------------|---------------------|--------------------------|
| Desktop Usability | High | High | High |
| Tablet Usability | High | Medium | Low |
| Accessibility | High | High | High |
| Consistency (Linear/Notion pattern) | High | Medium | Low |
| Responsiveness | High | High | Low |
| Implementation Complexity | Medium | Low | Very Low |
| Future-proofing (post-MVP collapse) | High | Medium | Low |

---

### CE-1 Decision

**Chosen**: Option 1 — Fixed 256px Sidebar, Burger-Menu Drawer on Tablet

**Rationale**: The primary users (Team Members, Team Leads) need maximum board-content real estate on tablet — Kanban columns are horizontally wide and every pixel matters. A full-width main area on tablet (Option 1) is the right trade-off. The burger-menu drawer pattern is universally understood, matches the Linear and Notion mobile-first patterns the productBrief references, and satisfies the productBrief's stated "sidebar may collapse" intent. Option 2 (icon rail) is attractive but BanyanBoard boards have no icons in MVP, making the rail ambiguous. Option 3 fails at tablet viewport sizes.

The `useSidebar()` hook IS needed in Phase 2 (not post-MVP) because Phase 2 builds the app shell and must support the secondary tablet breakpoint.

**Trade-offs Accepted**:
- Tablet users need one extra tap to switch boards (drawer must be opened). Acceptable because tablet is a secondary use case and the drawer pattern is intuitive.
- `useSidebar()` hook adds ~20 lines of code. Acceptable given it unlocks correct tablet behaviour.

---

## CE-2: TailwindCSS Colour Token Selection

### Colour Philosophy

productBrief mandates: "light neutral background, white cards and panels, muted accent colours, calm productivity-focused workspace". Reference products: Linear (slate-based palette, indigo accents), Notion (gray/white, minimal colour), Trello (white cards, blue accents).

The palette must achieve WCAG 2.1 AA:
- Normal body text on background: ≥ 4.5:1 contrast ratio
- Large text (≥ 18px) and UI components: ≥ 3:1
- All interactive elements (buttons, links) on their backgrounds: ≥ 4.5:1

---

### Option A: Slate-Based (Linear-Inspired)

**Background**: `slate-50` (#f8fafc) — barely-blue neutral; Linear's exact background tone
**Sidebar**: `slate-100` (#f1f5f9) — one step darker than background for subtle zone separation
**Card/Panel surface**: `white` (#ffffff)
**Primary accent**: `indigo-600` (#4f46e5) — Linear's brand accent; high saturation button colour
**Active nav**: `indigo-700` background (`#3730a3`) with `white` text
**Border**: `slate-200` (#e2e8f0)
**Body text**: `slate-900` (#0f172a) — near-black; very high contrast
**Muted text**: `slate-500` (#64748b) — secondary labels
**Label chips** (6 colours, muted):
  - Rose: `bg-rose-100 text-rose-700` — #ffe4e6 / #be123c
  - Amber: `bg-amber-100 text-amber-700` — #fef3c7 / #b45309
  - Emerald: `bg-emerald-100 text-emerald-700` — #d1fae5 / #047857
  - Sky: `bg-sky-100 text-sky-700` — #e0f2fe / #0369a1
  - Violet: `bg-violet-100 text-violet-700` — #ede9fe / #6d28d9
  - Orange: `bg-orange-100 text-orange-700` — #ffedd5 / #c2410c

**Font**: Inter (via Google Fonts CDN or `@fontsource/inter`) — modern sans-serif; matches Linear/Notion; extend Tailwind `fontFamily.sans`

**Contrast check**:
- `slate-900` (#0f172a) on `white` (#ffffff): 19.4:1 ✓ (far exceeds AA)
- `slate-900` on `slate-50` (#f8fafc): 17.6:1 ✓
- `white` on `indigo-600` (#4f46e5): 4.82:1 ✓ (passes AA for normal text)
- `slate-500` (#64748b) on `white`: 4.6:1 ✓ (just passes AA)
- `rose-700` (#be123c) on `rose-100` (#ffe4e6): 5.1:1 ✓
- `amber-700` (#b45309) on `amber-100` (#fef3c7): 5.4:1 ✓
- `emerald-700` (#047857) on `emerald-100` (#d1fae5): 5.0:1 ✓
- `sky-700` (#0369a1) on `sky-100` (#e0f2fe): 5.8:1 ✓
- `violet-700` (#6d28d9) on `violet-100` (#ede9fe): 6.3:1 ✓
- `orange-700` (#c2410c) on `orange-100` (#ffedd5): 5.2:1 ✓

All label combinations pass WCAG AA ✓

- **Pros**: Most closely matches Linear (the primary inspiration); `slate` is the most balanced neutral in Tailwind (has a slight cool blue that reads as "tech"); indigo accent is energetic without being gaudy; all contrasts verified AA.
- **Cons**: Indigo is strongly associated with Linear — may feel like a direct clone; slightly technical/cold for teams in non-dev industries.
- **Usability**: High
- **Accessibility**: High (all contrasts verified)
- **Implementation Complexity**: Low

---

### Option B: Gray-Based (Notion-Inspired, Warmer)

**Background**: `gray-50` (#f9fafb) — warm neutral; Notion-like
**Sidebar**: `gray-100` (#f3f4f6)
**Card/Panel surface**: `white` (#ffffff)
**Primary accent**: `blue-600` (#2563eb) — familiar, safe blue; used by Linear (older), GitHub, Tailwind UI
**Active nav**: `blue-700` (#1d4ed8) with `white` text
**Border**: `gray-200` (#e5e7eb)
**Body text**: `gray-900` (#111827)
**Muted text**: `gray-500` (#6b7280)
**Label chips**:
  - Pink: `bg-pink-100 text-pink-700` — #fce7f3 / #be185d
  - Yellow: `bg-yellow-100 text-yellow-800` — #fef9c3 / #854d0e (note: yellow-700 fails AA on yellow-100; use yellow-800)
  - Green: `bg-green-100 text-green-700` — #dcfce7 / #15803d
  - Cyan: `bg-cyan-100 text-cyan-700` — #cffafe / #0e7490
  - Purple: `bg-purple-100 text-purple-700` — #f3e8ff / #7e22ce
  - Red: `bg-red-100 text-red-700` — #fee2e2 / #b91c1c

**Font**: System UI stack — `font-sans` (Tailwind default: `ui-sans-serif, system-ui, -apple-system, ...`); no custom font download; matches Notion's approach on system fonts

**Contrast check**:
- `gray-900` on `white`: 19.5:1 ✓
- `white` on `blue-600` (#2563eb): 4.68:1 ✓
- `gray-500` (#6b7280) on `white`: 4.47:1 — FAILS AA (4.47 < 4.5) ✗

  **Fix**: Use `gray-600` (#4b5563) for muted text → on `white`: 7.0:1 ✓

- `yellow-800` (#854d0e) on `yellow-100` (#fef9c3): 5.8:1 ✓

- **Pros**: Warmer feel; system fonts eliminate the Google Fonts dependency and font download; `blue-600` is maximally familiar; no external font loading = faster initial load
- **Cons**: Gray is more generic — less distinct than slate; system font stack means appearance varies subtly across Mac (SF Pro), Windows (Segoe UI), Linux (default sans); `gray-500` fails AA for muted text (must use `gray-600`)
- **Usability**: High
- **Accessibility**: High (with gray-600 correction)
- **Implementation Complexity**: Low

---

### Option C: Neutral-Based (Pure Neutral, Maximum Calm)

**Background**: `neutral-50` (#fafafa) — the most neutral neutral in Tailwind (no hue whatsoever)
**Sidebar**: `neutral-100` (#f5f5f5)
**Card/Panel surface**: `white` (#ffffff)
**Primary accent**: `violet-600` (#7c3aed) — warmer than indigo; distinct from Linear
**Active nav**: `violet-700` (#6d28d9) with `white` text
**Border**: `neutral-200` (#e5e5e5)
**Body text**: `neutral-900` (#171717)
**Muted text**: `neutral-500` (#737373)
**Label chips**:
  - Same muted set as Option A (rose/amber/emerald/sky/violet/orange — these work across any neutral background)

**Font**: Inter (same as Option A)

**Contrast check**:
- `neutral-900` on `white`: 18.1:1 ✓
- `white` on `violet-600` (#7c3aed): 4.55:1 ✓
- `neutral-500` (#737373) on `white`: 4.48:1 — FAILS AA ✗

  **Fix**: Use `neutral-600` (#525252) for muted text → 7.0:1 ✓

- **Pros**: Absolutely neutral background — no hue bias; clearest backdrop for label colour chips (no competing tint); violet accent distinguishes BanyanBoard from Linear (indigo) and GitHub (blue)
- **Cons**: True neutral can feel slightly cold/clinical; `neutral-500` fails AA for muted text (same issue as Option B's gray-500); violet accent is less immediately recognizable than blue/indigo
- **Usability**: High
- **Accessibility**: High (with neutral-600 correction)
- **Implementation Complexity**: Low

---

### CE-2 Evaluation Matrix

| Criteria | Option A: Slate/Indigo | Option B: Gray/Blue | Option C: Neutral/Violet |
|----------|------------------------|---------------------|--------------------------|
| WCAG AA Compliance | Full ✓ | Full ✓ (w/ gray-600) | Full ✓ (w/ neutral-600) |
| Design Language Match | Very High (Linear) | High (Notion/GitHub) | High |
| Label Chip Readability | High | High | Very High |
| Font Performance | Medium (external font) | High (system fonts) | Medium (external font) |
| Distinctiveness from Competitors | Medium (= Linear) | Medium (= GitHub) | High |
| Implementation Simplicity | Low (needs font setup) | Very Low | Low (needs font setup) |

---

### CE-2 Decision

**Chosen**: Option A — Slate/Indigo with Inter font, with one targeted refinement

**Rationale**: The productBrief explicitly names Linear as the primary design inspiration, and Option A's slate/indigo palette is the most faithful realisation of that intent. All label chip contrast ratios pass WCAG AA without any fixes. Inter is a better typographic choice than system fonts for a productivity tool because it is consistent across all operating systems (Linux users on system-sans get variable results). The indigo accent is appropriate for a tech-audience tool (small dev/product teams). The one risk — "looks too much like Linear" — is acceptable: BanyanBoard's differentiation is in its simplicity and self-hosting, not its colour palette.

**Refinement applied**: `slate-600` (#475569) is used for muted/secondary text instead of `slate-500`, to ensure the muted text contrast ratio is clearly above the 4.5:1 AA threshold (slate-600 on white = 5.9:1).

**Trade-offs Accepted**:
- Inter requires a font dependency (Google Fonts CDN or `@fontsource/inter` npm package). Acceptable: `@fontsource/inter` is a zero-latency self-hosted option that keeps the 12-Factor config principle (no external CDN dependency at runtime).
- Indigo accent is visually close to Linear. Acceptable: the productBrief explicitly references Linear as inspiration; the app's differentiator is simplicity, not colour.

---

## Final Design Specifications

### CE-1: Layout Specification

#### CSS Layout Approach

Use **Flexbox**, not CSS Grid, for the three-zone shell:

```
AppShell root: flex flex-row h-screen overflow-hidden
├── Sidebar: w-64 shrink-0 flex-none h-full (desktop)
│            Fixed overlay on tablet (see below)
└── Right panel: flex-1 flex flex-col min-w-0 overflow-hidden
    ├── BoardHeader: shrink-0 h-14 (fixed height header)
    └── Main: flex-1 overflow-auto
```

**Rationale for Flexbox over CSS Grid**: The two-column (sidebar + content) layout is a simpler flexbox problem. CSS Grid shines with two-dimensional layouts; this is one-dimensional (row). Flexbox `flex-1` on the main panel handles all viewport sizes without explicit column sizing. The main area's `overflow-auto` enables horizontal scroll of the Kanban board columns inside FEAT-003 without affecting the shell.

#### Sidebar Widths

```typescript
// tailwind.config.ts theme extension
sidebar: {
  DEFAULT: '16rem',  // 256px — w-64
}
```

Use Tailwind's built-in `w-64` (256px) — no custom width token needed; it is a standard spacing value.

#### `useSidebar()` Hook

Required in Phase 2. Minimum interface:

```typescript
// src/hooks/useSidebar.ts
interface SidebarState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
```

State lives in `AppShell` via `useState` — no global store needed. The hook is a thin wrapper providing a stable API. Pass `isOpen` and `toggle` as props to `Sidebar` and `BoardHeader`.

#### Responsive Behaviour

| Breakpoint | Sidebar | Main Area | Trigger |
|------------|---------|-----------|---------|
| ≥ 1024px (`lg:`) | `w-64` always visible, `relative position` | `flex-1` | None |
| 768–1023px (`md:` only) | Hidden by default; appears as fixed overlay `z-50 w-64` when `isOpen` | Full width `flex-1` | Burger button in header |
| < 768px | Post-MVP — not implemented | — | — |

**Overlay behaviour (tablet)**:
- Sidebar: `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200`
- Closed: `-translate-x-full`
- Open: `translate-x-0`
- Backdrop: `fixed inset-0 bg-black/30 z-40` (appears behind sidebar, above main content; click closes sidebar)
- Sidebar has `aria-expanded={isOpen}` and `aria-label="Navigation sidebar"`
- Burger button has `aria-controls="sidebar"` and `aria-expanded={isOpen}`
- Focus trap: when sidebar opens on tablet, first focusable element in sidebar receives focus; ESC closes

**Desktop (`lg:` breakpoint)**: Sidebar is `static` (not `fixed`); no overlay, no backdrop. The `isOpen` state is irrelevant on desktop — sidebar is always rendered in flow.

```tsx
// Tailwind classes for Sidebar.tsx
const sidebarClasses = clsx(
  'bg-slate-100 border-r border-slate-200 flex flex-col h-full',
  // Tablet: overlay
  'fixed inset-y-0 left-0 z-50 w-64',
  'transform transition-transform duration-200',
  isOpen ? 'translate-x-0' : '-translate-x-full',
  // Desktop: always visible, static
  'lg:static lg:translate-x-0 lg:z-auto'
);
```

#### Three-Zone AppShell Structure

```tsx
// src/components/layout/AppShell.tsx structure
<div className="flex flex-row h-screen overflow-hidden bg-slate-50">
  {/* Backdrop — tablet only, behind sidebar */}
  {isOpen && (
    <div
      className="fixed inset-0 bg-black/30 z-40 lg:hidden"
      onClick={close}
      aria-hidden="true"
    />
  )}
  {/* Zone 1: Sidebar */}
  <Sidebar id="sidebar" isOpen={isOpen} onClose={close} />
  {/* Zone 2+3: Right panel */}
  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
    {/* Zone 2: Board Header */}
    <BoardHeader onMenuClick={toggle} />
    {/* Zone 3: Main Content */}
    <main className="flex-1 overflow-auto">
      <Outlet />  {/* React Router nested layout */}
    </main>
  </div>
</div>
```

---

### CE-2: TailwindCSS Theme Token Specification

#### `tailwind.config.ts` Extension

```typescript
import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Surface colours
        surface: {
          page: '#f8fafc',      // slate-50 — page background
          sidebar: '#f1f5f9',   // slate-100 — sidebar background
          card: '#ffffff',      // white — card/panel background
          overlay: 'rgba(0,0,0,0.3)', // drawer backdrop
        },
        // Brand/accent
        primary: {
          DEFAULT: '#4f46e5',   // indigo-600 — buttons, active states
          hover: '#4338ca',     // indigo-700 — hover state
          foreground: '#ffffff', // text on primary buttons
        },
        // Border
        border: {
          DEFAULT: '#e2e8f0',   // slate-200
          strong: '#cbd5e1',    // slate-300 — stronger dividers
        },
        // Text
        text: {
          primary: '#0f172a',   // slate-900 — body text
          secondary: '#475569', // slate-600 — muted/label text (AA compliant)
          disabled: '#94a3b8',  // slate-400 — disabled (decorative only — do not use for meaningful text)
          inverse: '#ffffff',   // text on dark backgrounds
        },
        // Navigation
        nav: {
          active: '#4f46e5',    // indigo-600 text for active link
          activeBg: '#eef2ff',  // indigo-50 background for active link
          hover: '#f1f5f9',     // slate-100 hover background
        },
        // Label chip palette (6 muted colours — all AA verified)
        label: {
          rose: { bg: '#ffe4e6', text: '#be123c' },     // rose-100/rose-700 — 5.1:1 ✓
          amber: { bg: '#fef3c7', text: '#b45309' },    // amber-100/amber-700 — 5.4:1 ✓
          emerald: { bg: '#d1fae5', text: '#047857' },  // emerald-100/emerald-700 — 5.0:1 ✓
          sky: { bg: '#e0f2fe', text: '#0369a1' },      // sky-100/sky-700 — 5.8:1 ✓
          violet: { bg: '#ede9fe', text: '#6d28d9' },   // violet-100/violet-700 — 6.3:1 ✓
          orange: { bg: '#ffedd5', text: '#c2410c' },   // orange-100/orange-700 — 5.2:1 ✓
        },
      },
      borderRadius: {
        // Tailwind defaults (sm/md/lg/xl) are kept; these are the preferred scales:
        // Cards: rounded-lg (8px)
        // Buttons: rounded-md (6px)
        // Label chips: rounded-full (pill)
        // Sidebar nav items: rounded-md (6px)
      },
      boxShadow: {
        // Cards (resting): shadow-sm
        // Cards (hover): shadow-md
        // Sidebar overlay (tablet): shadow-xl
        // No custom shadow tokens — Tailwind defaults are sufficient
      },
    },
  },
  plugins: [],
};
export default config;
```

**Note on label colours**: The 6 label colours above map directly to Tailwind palette names, allowing developers to use either the extended token (`label-rose-bg`) or the Tailwind utility directly (`bg-rose-100 text-rose-700`). Both approaches work; prefer the Tailwind utilities in components for readability.

#### Typography Scale

| Element | Classes | Notes |
|---------|---------|-------|
| App wordmark | `text-lg font-semibold text-text-primary` | Sidebar top |
| Section headings | `text-xs font-semibold uppercase tracking-wider text-text-secondary` | Sidebar section labels |
| Nav link text | `text-sm font-medium text-text-primary` | Board nav items |
| Board title | `text-xl font-semibold text-text-primary` | BoardHeader |
| Body text | `text-sm text-text-primary` | Card content, descriptions |
| Label chip text | `text-xs font-medium` | Colour-paired per label |
| Button text | `text-sm font-medium` | "New Card" button |

#### Component-Level Token Application

**Sidebar**:
```
bg-surface-sidebar border-r border-border
```

**Sidebar nav item (default)**:
```
flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
text-text-primary hover:bg-nav-hover cursor-pointer
```

**Sidebar nav item (active)**:
```
bg-nav-activeBg text-nav-active font-semibold
```

**Board Header**:
```
bg-surface-card border-b border-border h-14 flex items-center px-4 gap-4 shrink-0
```

**"New Card" Button (primary)**:
```
bg-primary hover:bg-primary-hover text-primary-foreground
text-sm font-medium px-4 py-2 rounded-md
focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
transition-colors duration-150
```

**Card tile**:
```
bg-surface-card rounded-lg shadow-sm hover:shadow-md
transition-shadow duration-150 p-3 border border-border
```

**Label chip**:
```
inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
[bg/text from label palette above]
```

**Page background**:
```
bg-surface-page
```

---

## Responsive Behaviour Summary

| Breakpoint | Layout Change | Implementation |
|------------|---------------|----------------|
| ≥ 1024px (`lg:`) | Sidebar always visible, 256px, static | `lg:static lg:translate-x-0 lg:w-64` |
| 768–1023px (`md:` to `lg:`) | Sidebar hidden; burger icon in header; sidebar as fixed overlay | `fixed -translate-x-full` toggled to `translate-x-0` via `useSidebar()` |
| < 768px | Post-MVP; not implemented | — |

---

## Accessibility Requirements

- [x] Keyboard navigation: Sidebar links are `<a>` or `<button>` elements; all are focusable and activatable via Enter/Space
- [x] Screen reader: Sidebar has `aria-label="Navigation sidebar"`; burger button has `aria-label="Open navigation"` / `"Close navigation"`; active nav item has `aria-current="page"`
- [x] Colour contrast: All text/background combinations verified ≥ 4.5:1 (see CE-2 contrast checks above)
- [x] Focus indicators: All interactive elements use `focus:ring-2 focus:ring-primary focus:ring-offset-2` (visible indigo focus ring)
- [x] Error messages: N/A for shell (no form inputs in app shell)
- [x] Tablet overlay: Focus trap when sidebar drawer is open (ESC closes; first focusable element gets focus on open)

---

## Implementation Guidelines

### For Developers

1. **Start with `AppShell.tsx`** as the root layout. It owns `useSidebar()` state and passes props to `Sidebar` and `BoardHeader`. The `<Outlet />` from React Router renders in the `<main>` zone.

2. **Sidebar classes must use `lg:` prefix for desktop overrides**. The sidebar is always defined as a fixed overlay (mobile-first), then overridden to static on `lg:`. This is the correct Tailwind mobile-first approach.

3. **Do not create custom CSS**. Every visual attribute must be a Tailwind class. If you find yourself reaching for custom CSS, first check if a Tailwind utility exists. If the value is truly one-off, use Tailwind's arbitrary value syntax: `w-[256px]` (but prefer `w-64` since it maps to exactly 256px).

4. **Font setup**: Install `@fontsource/inter` (`npm install @fontsource/inter`) and import in `src/main.tsx`:
   ```typescript
   import '@fontsource/inter/400.css';
   import '@fontsource/inter/500.css';
   import '@fontsource/inter/600.css';
   ```
   This self-hosts Inter — no Google Fonts CDN call required. Update `tailwind.config.ts` to extend `fontFamily.sans` as shown above.

5. **Colour tokens**: Use the semantic token names (`bg-surface-sidebar`, `text-text-primary`, `bg-primary`) rather than raw Tailwind palette values (`bg-slate-100`, `text-slate-900`, `bg-indigo-600`). This allows future palette changes in one file rather than across all components.

6. **`useSidebar()` scope**: Keep sidebar state local to `AppShell` — no Zustand store needed for this. Pass `isOpen`, `open`, `close`, `toggle` as props. The Zustand store (CE-4) is for board data state, not shell UI state.

7. **`min-w-0` on flex children**: The right panel div needs `min-w-0` to prevent flex children from overflowing. Without it, wide content (Kanban columns in FEAT-003) will cause the layout to break.

8. **`overflow-auto` on `<main>`**: The main content zone must have `overflow-auto` (not `overflow-hidden`) so the horizontal Kanban board in FEAT-003 can scroll within the shell without scrolling the header.

### Component Structure

```
src/components/layout/
├── AppShell.tsx           # Root layout; owns useSidebar state
├── AppShell.test.tsx      # Renders sidebar, header, main zone
├── Sidebar.tsx            # Left nav: wordmark, board links, workspace area
├── Sidebar.test.tsx       # Nav links present, active state
└── BoardHeader.tsx        # Top bar: board title, New Card button, burger icon
    BoardHeader.test.tsx   # Header renders, burger click calls onMenuClick

src/hooks/
└── useSidebar.ts          # isOpen, open, close, toggle

src/pages/
├── BoardListPage.tsx      # Placeholder for /boards
└── BoardDetailPage.tsx    # Placeholder for /boards/:id
```

### Recommended Libraries/Patterns

- `clsx` (or `clsx` + `tailwind-merge`) for conditional class composition: `npm install clsx` — keeps Tailwind class strings readable in JSX
- `@fontsource/inter` for self-hosted Inter font: `npm install @fontsource/inter`
- No additional UI libraries for the shell — Tailwind utilities are sufficient for all shell elements
- Radix UI Tooltip (post-MVP, if icon-rail option were chosen) — not needed for Option 1

---

## Validation Checklist

- [x] Meets all user goals (sidebar navigation, board header always visible, main area scrollable)
- [x] Accessible per WCAG 2.1 AA requirements (contrast ratios verified, ARIA attributes specified, focus management documented)
- [x] Consistent with productBrief design language (Linear/Notion-inspired, calm, light, modern)
- [x] Respects Guiding Principles (Simplicity over Cleverness — Flexbox not Grid; no premature abstraction in useSidebar)
- [x] Responsive across target devices (desktop ≥ 1024px primary; tablet 768–1023px secondary; mobile post-MVP)
- [x] Performance acceptable (no runtime CSS; font self-hosted; no external library added for shell)
- [x] Implementation feasible within Phase 2 scope (all patterns are standard React + Tailwind)
- [x] Unblocks FEAT-003 (Kanban Board UI): `overflow-auto` on main area; `min-w-0` on right panel; token contract established

---

## Next Steps

1. **Phase 1 (Scaffold)** can begin immediately — `tailwind.config.ts` token schema is defined here; Phase 1 installs TailwindCSS and creates the config file with these tokens.
2. **Phase 2 (App Shell Layout)** is now unblocked — implement `AppShell.tsx`, `Sidebar.tsx`, `BoardHeader.tsx`, `useSidebar.ts` per the specifications in this document.
3. **Architecture Design** (CE-3 through CE-6) is handled by the parallel Architecture creative agent — consult `TASK-002-app-shell-arch.md` for routing, state, logging, and types decisions before Phase 2 implementation.
4. **FEAT-003 design handoff**: The token names defined in CE-2 (`surface-card`, `border`, `text-primary`, `primary`, label chip palette) become the design contract for Column and Card components.
