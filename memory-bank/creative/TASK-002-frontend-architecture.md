# Architecture Decision: BanyanBoard Frontend — Technical Stack

**Created**: 2026-05-16
**Status**: DECIDED
**Decision Type**: Architecture
**Task**: TASK-002 (FEAT-002 Frontend Foundation)
**Complexity**: Level 3 — Foundation for FEAT-003 (Kanban Board UI) and FEAT-004 (Card Detail Modal + Search/Filter)
**Scope**: Resolves CE-3 (routing), CE-4 (global state), CE-4b (state-layer split), CE-5 (frontend logging), CE-6 (types location)

> CE-1 (sidebar layout) and CE-2 (TailwindCSS theme tokens) are visual / UI/UX concerns and are resolved by the parallel UI/UX Design creative sub-agent — they are out of scope for this Architecture document.

---

## Context

### System Requirements

- Greenfield Vite + React 18 + TypeScript 5 (strict) frontend in `frontend/`
- Three-zone application shell: left sidebar, board header, main content area
- Client-side routing: `/`, `/boards`, `/boards/:id` (more routes arriving in FEAT-003 and FEAT-004)
- Type-safe API client stub reading `VITE_API_BASE_URL` (default `http://localhost:3001`)
- TanStack Query v5 `QueryClientProvider` at the app root for server state
- Global client-side state store (Zustand or Context) — initial slice: `{ activeBoardId: string | null }`
- Shared TypeScript domain types (`Board`, `Column`, `Card`, `Label`) — location to be decided
- Frontend logging strategy compatible with a `no-console` lint rule (parity with backend) — or an explicit, justified deviation
- Future load: FEAT-003 introduces **optimistic-UI drag-and-drop** of cards across columns; the state architecture must support this cleanly

### Technical Constraints

- **TypeScript strict mode** — matches backend (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- **No premature abstractions** (systemPatterns Guiding Principle) — defer shared workspaces, code-generators, and exotic state libs until there are 3+ concrete users
- **Simplicity over Cleverness** (systemPatterns Guiding Principle) — readable code over clever patterns
- **12-Factor Config** — every environment-specific value via `import.meta.env.VITE_*`; documented in `frontend/.env.example`
- **Small scale** — 2–15 users per deployment, hundreds of cards per board, tens of boards
- **Browser support** — Chrome / Firefox / Safari / Edge 120+ (modern ESM target)
- **Docker Compose** — frontend dev server must bind `0.0.0.0:5173`
- **Existing backend pattern** — `no-console: error` ESLint rule, `LOG_LEVEL`/`LOG_FORMAT` env-driven logger, pino v9 with W3C Trace Context

### Non-Functional Requirements (from productBrief)

| NFR | Target | Architecture impact |
|-----|--------|---------------------|
| Frontend initial load | < 2s on localhost | Bundle size matters; prefer small libraries |
| Drag-and-drop perceived latency | "Instant" (optimistic UI) | State layer must support fast optimistic updates + rollback |
| Concurrent users | 2–15 per board | No need for CRDTs, server-sent events, multi-tab sync, or sharded stores |
| Browsers | Chrome/Firefox/Safari/Edge 120+ | ESM, `import.meta.env`, modern fetch are all fine |
| WCAG 2.1 AA (best-effort) | Keyboard nav + focus indicators | Routing library must support semantic `<a>` links and focus management |
| 12-Factor config | All env values from env vars | API base URL is the only env var in MVP |

### Guiding Principles to Respect

| Principle | Source | How this document applies it |
|-----------|--------|------------------------------|
| Simplicity over Cleverness | systemPatterns | Prefer the boring, well-known choice over the cutting-edge one |
| No Premature Abstractions | systemPatterns | No `shared/` workspace, no code-gen, no logger lib until concrete need |
| 12-Factor Config | systemPatterns | `VITE_API_BASE_URL` only; logger behaviour derived from `import.meta.env.PROD`/`MODE` |
| Optimistic UI | systemPatterns | The state architecture must enable FEAT-003 DnD without rewrite |
| Clean Architecture | systemPatterns (backend-mirror) | Frontend layering: components → hooks → api client → server state; UI never mutates server cache directly |

---

## Component Analysis

### Core Components

| Component | Purpose | Responsibilities |
|-----------|---------|------------------|
| **Router** | Client-side navigation | Define routes `/`, `/boards`, `/boards/:id`; persistent layout shell; typed params |
| **AppShell** | Persistent layout frame | Renders Sidebar + BoardHeader + Outlet (route content) |
| **API Client** | Typed fetch wrapper | Reads `VITE_API_BASE_URL`; exposes `get/post/patch/delete`; injects headers |
| **QueryClient (TanStack Query)** | Server state cache | Owns all server-fetched data (`Board`, `Column`, `Card` lists/entities); cache invalidation; optimistic updates |
| **Global Store (Zustand)** | Client-only UI state | `activeBoardId`, sidebar collapse, filter UI state, DnD in-flight state |
| **Domain types** | Shape contracts | `Board`, `Column`, `Card`, `Label` TypeScript interfaces consumed by API client + components |
| **Logger** | Dev-only structured logs | Thin wrapper over `console` in dev; no-op in production; satisfies `no-console` lint rule |

### Component Interactions

```
                       ┌──────────────────────────┐
                       │       Browser URL        │
                       └────────────┬─────────────┘
                                    │ React Router v6
                                    ▼
┌───────────────────────────────────────────────────────────┐
│                       <AppShell>                          │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Sidebar  │  │ BoardHeader  │  │      <Outlet/>      │  │
│  │ (reads   │  │ (reads       │  │  BoardListPage      │  │
│  │  store)  │  │  active id)  │  │  BoardDetailPage    │  │
│  └────┬─────┘  └──────┬───────┘  └──────────┬──────────┘  │
└───────┼───────────────┼─────────────────────┼─────────────┘
        │ setActiveBoard│                     │ useQuery / useMutation
        ▼               ▼                     ▼
   ┌──────────────────────────┐    ┌─────────────────────────┐
   │   Zustand Global Store   │    │   TanStack Query Cache  │
   │   - activeBoardId        │    │   - boards              │
   │   - sidebarCollapsed     │    │   - columns             │
   │   - filterUiState        │    │   - cards               │
   │   - inFlightCardMoves    │◀───┤   (optimistic updates   │
   └──────────────────────────┘    │    coordinate via store)│
                                   └────────────┬────────────┘
                                                │ apiClient.get/patch/...
                                                ▼
                                   ┌─────────────────────────┐
                                   │     API Client          │
                                   │  (VITE_API_BASE_URL)    │
                                   └────────────┬────────────┘
                                                │ fetch
                                                ▼
                                          Express backend
```

**Key boundaries**:

- **Server state (TanStack Query) and client state (Zustand) are disjoint.** No duplication of board/column/card lists into Zustand.
- **Components never call `fetch` directly** — always via the API client.
- **Components never mutate the Query cache directly** — always via `queryClient.setQueryData` inside a mutation's `onMutate` (the optimistic-update pattern).
- **Logger is the only sanctioned path for development diagnostics** — `console.*` is lint-banned.

---

## CE-3: Routing Library — React Router v6 vs TanStack Router v1

### Options Explored

#### Option 1: React Router v6.x (data routers — `createBrowserRouter`)

- **Description**: The de-facto SPA routing library for React. v6.4+ introduced "data routers" (`createBrowserRouter`) with loaders and actions, but we will use plain `<Outlet/>` route nesting (no loaders — TanStack Query owns data fetching).
- **Components**: `createBrowserRouter`, `RouterProvider`, `<Outlet/>`, `<Link/>`, `<NavLink/>`, `useNavigate`, `useParams`.
- **Pros**:
  - Smallest learning curve — almost every React developer has shipped React Router
  - First-class nested layouts via `<Outlet/>` — perfect fit for persistent AppShell
  - `<NavLink/>` exposes `isActive` for sidebar styling out of the box (AC-NAV-1)
  - Mature ecosystem; extensive docs, examples, and Stack Overflow coverage
  - Small bundle (~13 kB gzipped for `react-router-dom` v6.20+)
  - Plays cleanly with TanStack Query — neither library owns the other's concerns
- **Cons**:
  - `useParams<{ boardId: string }>()` typing is opt-in; route params are not type-checked against route definitions (requires manual `<T>` annotation, no compile-time guarantee that the route declares `:boardId`)
  - No built-in search-params schema validation
- **Technical Fit**: **High** — matches systemPatterns Simplicity Principle; team familiarity maximised
- **Complexity**: **Low**
- **Scalability**: **High** for MVP scope; routes for FEAT-003/FEAT-004 (card modal route, board detail) all fit the standard nested pattern

#### Option 2: TanStack Router v1

- **Description**: Newer routing library from the TanStack family (same authors as React Query). Emphasises fully type-safe routes, search params, and loader/preload integration.
- **Components**: `createRouter`, `Route`, `RouterProvider`, `<Link/>`, `useParams`, file-based or code-based route trees.
- **Pros**:
  - End-to-end type safety: `<Link to="/boards/$boardId" params={{ boardId }} />` is type-checked; misspelt routes fail at compile time
  - First-class search-params schema (Zod / Valibot) — useful for FEAT-004 search/filter URLs (e.g., `?label=red&due=overdue`)
  - Built-in route-level loaders with TanStack Query interop (preload data on hover)
- **Cons**:
  - Significantly less industry adoption (v1 GA: late 2024) — smaller talent pool
  - Steeper learning curve; route definition is more ceremony than React Router
  - Heavier bundle (~25–40 kB gzipped for `@tanstack/react-router` + devtools)
  - File-based routing requires a Vite plugin and generates a route tree at build time — additional moving piece
  - Type-safe benefits are most valuable on apps with deep route trees and complex search params; **BanyanBoard MVP has 3 routes total**
  - **Conflicts with No Premature Abstractions principle** — paying complexity tax now for benefits that materialise (if ever) post-MVP
- **Technical Fit**: **Medium** — works, but pulls against Simplicity over Cleverness
- **Complexity**: **Medium-High** for the scale of this app
- **Scalability**: **High** — but BanyanBoard will never need the routing scalability TanStack Router optimises for

### Evaluation Matrix

| Criteria | React Router v6 | TanStack Router v1 |
|----------|-----------------|--------------------|
| Team familiarity | High | Low |
| Type safety (route params) | Manual (good-enough) | Excellent (compile-time) |
| Nested layouts | Excellent | Excellent |
| Bundle size | ~13 kB | ~25–40 kB |
| Active-link detection | Built-in (`NavLink`) | Built-in |
| Future-fit for FEAT-003/004 routes | Excellent | Excellent |
| Industry adoption / docs | Excellent | Growing |
| Simplicity Principle alignment | High | Medium |

### Decision: **React Router v6 (`react-router-dom@^6.x`)**

**Rationale**: BanyanBoard has 3 routes today and will likely have ~6–8 by the end of FEAT-004 (card modal, possibly settings, possibly auth). At that scale, TanStack Router's type-safety wins do not justify the bundle-size cost, the additional build-time machinery (file-based route generator), and the deviation from the systemPatterns Simplicity Principle. React Router v6 is the boring, well-known choice — exactly what "Simplicity over Cleverness" prescribes. We can revisit if route count exceeds ~20 or if search-params get genuinely complex (currently no concrete need — search/filter in FEAT-004 can use plain `URLSearchParams` with a tiny adapter hook).

**Trade-offs accepted**:
- Route params are type-checked via manual `<T>` annotation on `useParams<{ boardId: string }>()` rather than compile-time route inference. Mitigated by a project convention: every route page declares a `RouteParams` type at the top of the file.
- No built-in search-params schema validation — for FEAT-004 we'll add a thin `useSearchParam<T>(key, parse)` hook (one helper, ~20 lines).

**Implementation guidelines**:
- Use the data-router API: `createBrowserRouter([...])` + `<RouterProvider router={router} />` (not the legacy `<BrowserRouter>` component) — this is the v6.4+ recommended approach and is what we'll need if we ever opt into loaders.
- **No loaders / no actions** in MVP. All data fetching goes through TanStack Query hooks invoked inside page components. This keeps the data layer in one place.
- The route tree wraps every page in a single `<AppShell>` parent route that renders `<Outlet/>` — this guarantees the sidebar and header remain mounted across navigations (AC-NAV-1).
- Use `<NavLink>` for sidebar items so the active-route style is automatic.
- Every page file exports a `RouteParams` type at the top, e.g. `type RouteParams = { boardId: string };`, then `const { boardId } = useParams<RouteParams>();`.

---

## CE-4: Global State Management — Zustand vs React Context

### Options Explored

#### Option 1: Zustand (`zustand@^4.x`)

- **Description**: Minimal, hook-based state library. Stores are plain functions; state is read via selectors; updates are mutations on a draft (immer optional) or replacement objects.
- **Components**: `create()`, store hooks (`useAppStore`), selectors, middleware (`devtools`, `persist`).
- **Pros**:
  - **Selector-based subscriptions** — components only re-render when the slice they select changes. Critical for FEAT-003 DnD where the cards list will be touched on every drag; unrelated UI must not re-render.
  - **Redux DevTools middleware** out of the box (`zustand/middleware`) — useful when debugging optimistic DnD rollbacks
  - **Trivially testable** — `useAppStore.setState({...})` and `useAppStore.getState()` work in tests without React mounting
  - **Tiny** — ~1 kB gzipped
  - **Idiomatic optimistic updates** — `setState((s) => ({ inFlightMoves: [...s.inFlightMoves, move] }))` reads naturally
  - Works outside React (e.g., inside DnD-kit callbacks or API client interceptors) via `useAppStore.getState()`
- **Cons**:
  - Adds a dependency (small but non-zero)
  - One more concept for new contributors who don't know it
- **Technical Fit**: **High** — matches the optimistic-DnD pattern in systemPatterns Guiding Principles
- **Complexity**: **Low** — store definitions are 5–15 lines each
- **Scalability**: **High** — selectors prevent the re-render storm that Context suffers from at scale

#### Option 2: React Context (built-in)

- **Description**: React's built-in mechanism for passing values through the component tree without prop drilling. Combined with `useReducer` for non-trivial state.
- **Components**: `createContext`, `<Provider value={...}>`, `useContext`.
- **Pros**:
  - Zero dependencies — already in React
  - Familiar to every React developer
  - Fine for read-mostly, rarely-changing state (theme, current user)
- **Cons**:
  - **Re-render cascade**: every component that calls `useContext(X)` re-renders whenever the provider value changes — regardless of which field it reads. This is the well-known Context "performance footgun" for high-frequency updates.
  - **No selector support** without third-party libraries (`use-context-selector`) — and adding `use-context-selector` defeats the "zero dependencies" win
  - **Painful for DnD**: card-drag updates touch the store many times per second; with Context, every consumer re-renders on every update. Mitigations (splitting into many contexts, memoising provider value, manual `React.memo` on consumers) re-introduce the complexity Context was supposed to avoid.
  - **No devtools** — debugging optimistic-update rollbacks means `console.log` (which we're trying to avoid)
  - **Awkward to test in isolation** — must render a Provider in every test that touches state
- **Technical Fit**: **Low** for FEAT-003 DnD workload; **Medium** for current-task scope (just `activeBoardId`)
- **Complexity**: **Low** today, **Medium-High** once FEAT-003 lands (will need either selectors lib or split into multiple contexts)
- **Scalability**: **Low** — known to degrade on high-frequency updates without escape hatches

### Evaluation Matrix

| Criteria | Zustand | React Context |
|----------|---------|---------------|
| Bundle cost | ~1 kB | 0 kB |
| Re-render granularity | Selector-based (fine-grained) | Provider-value-based (coarse) |
| Optimistic-UI DnD fit | Excellent | Poor without escape hatches |
| Devtools | Redux DevTools (yes) | None |
| Testing ergonomics | `getState()`/`setState()` directly | Must mount Provider |
| Learning curve for newcomers | Low (1-page docs) | Zero (built-in) |
| Simplicity Principle alignment | High (it's the simple thing that scales) | High at first, Low under DnD load |

### Decision: **Zustand**

**Rationale**: This is the most consequential decision in the document because FEAT-003 (drag-and-drop with optimistic UI) is the highest-risk demand on the state architecture, and the systemPatterns Guiding Principle "Optimistic UI" is non-negotiable. Context's coarse re-render granularity is a well-documented hazard for exactly this workload. Zustand's selector model neutralises that hazard at a 1 kB bundle cost and a tiny learning curve.

This is **not** a violation of "No Premature Abstractions" — we're not building a generalised state framework; we're picking the right tool for a known, concrete future demand that we will hit in the very next feature. The principle warns against abstractions invented for hypothetical needs, not against picking the appropriate library for a documented requirement.

**Trade-offs accepted**:
- One additional dependency (~1 kB gzipped). Acceptable: Zustand is mature (>4 M weekly downloads), single-maintainer-risk is low (TkDodo / pmndrs collective), and the API is small enough to vendor if ever abandoned.
- One additional concept for new contributors. Mitigated by the store being trivially small — the entire `appStore.ts` file in MVP will be < 30 lines.

**Implementation guidelines**:
- Single store: `src/store/appStore.ts` exports `useAppStore`. Resist the urge to split into multiple stores until there are ≥3 unrelated state domains (No Premature Abstractions).
- Always read with a selector: `const activeBoardId = useAppStore((s) => s.activeBoardId);` — never `const store = useAppStore();`. Add a project convention / ESLint rule (`zustand/no-store-destructuring` is not standard, so enforce via code review for now).
- Wire `devtools` middleware in development only: `create(devtools(..., { enabled: import.meta.env.DEV }))`.
- For optimistic mutations, the store provides a small `inFlightMoves` array (set in `onMutate`, cleared in `onSettled`); the TanStack Query mutation owns rollback logic.

---

## CE-4b: State-Layer Split — TanStack Query vs Zustand

### Decision Rules (the contract)

| State category | Owner | Examples |
|---|---|---|
| **Server state** (anything that came from or goes to the backend) | TanStack Query | `boards` list, `board` detail, `columns`, `cards`, `labels` |
| **Client-only UI state** (only the browser knows about it) | Zustand | `activeBoardId`, `sidebarCollapsed`, `filterUiState` (search query, label filter), `inFlightMoves` |
| **URL / route state** (deep-linkable, shareable) | React Router (URL) | `:boardId` route param, future `?search=` / `?label=` query params |
| **Form input state** (local to a single component) | `useState` | Card form fields before save, modal open/close (when not deep-linked) |

### Minimum-Viable Zustand Slice (Phase 3 of TASK-002)

```typescript
// src/store/appStore.ts
interface AppState {
  activeBoardId: string | null;
  sidebarCollapsed: boolean;
  setActiveBoardId: (id: string | null) => void;
  toggleSidebar: () => void;
}
```

That's the entire store at the end of TASK-002. Two pieces of state, two setters. No optimistic-DnD state yet — that belongs to FEAT-003 and is forecast below.

### Forecast: Where Optimistic DnD State Lives (FEAT-003 concern)

For the architecture to "support FEAT-003 cleanly" (the explicit constraint in this task), the split must be predictable now:

```typescript
// FEAT-003 will add (PREVIEW — not built in TASK-002):
interface AppState {
  // ...existing...
  inFlightMoves: Array<{ cardId: string; fromColumnId: string; toColumnId: string }>;
  beginCardMove: (move: CardMove) => void;
  endCardMove: (cardId: string) => void;
}
```

The flow in FEAT-003 will be:

1. User drops a card → component calls `useMutation` from TanStack Query
2. `onMutate`: optimistic update — `queryClient.setQueryData(['board', boardId], optimisticBoard)` AND `useAppStore.getState().beginCardMove(move)` to track in-flight state for UI affordances (e.g., spinner badge)
3. `onError`: rollback — `queryClient.setQueryData(['board', boardId], previousBoard)` AND `useAppStore.getState().endCardMove(cardId)`
4. `onSuccess`: `useAppStore.getState().endCardMove(cardId)` (query cache already reflects success)

**Server state lives in the Query cache; the Zustand store only tracks "what's in-flight for UI affordances" — not the data itself.** This split prevents the classic Redux-era mistake of duplicating server data into client state.

### Implementation Guidelines

- **TanStack Query** is the source of truth for any data fetched from the backend. Components consume via `useQuery(['board', boardId], ...)` etc.
- **Zustand** holds *only* state that no other source owns — UI affordances, current selection, transient interaction flags.
- If a piece of state is in the URL, neither Zustand nor Query store it independently — derive from `useParams`/`useSearchParams` instead.
- Cache keys: `['boards']`, `['board', boardId]`, `['cards', boardId]` — flat, predictable, deterministic.

---

## CE-5: Frontend Logging / Observability Approach

### Background

The backend enforces `'no-console': 'error'` in ESLint (`backend/eslint.config.js`, line 29). All production logs flow through a structured Logger (pino v9) with `LOG_LEVEL`, `LOG_FORMAT`, `LOG_OUTPUT` env config. The Acceptance Criterion **AC-ERROR-1** specifies "a structured warning is logged (using the frontend logger, not `console.warn` directly)".

### Options Explored

#### Option 1: Allow `console.*` in frontend (no lint rule, no wrapper)

- **Description**: Skip the logger entirely. Use `console.warn`/`console.error` directly in production. Accept that the frontend has different rules than the backend.
- **Pros**:
  - Zero code; nothing to maintain
  - Familiar to all developers
- **Cons**:
  - **Breaks AC-ERROR-1** as written (which requires a "structured warning ... using the frontend logger")
  - **Inconsistent with backend** — same project, two different rules. Confusing for contributors switching files.
  - Production bundles ship `console.log` calls that leak in any dev's open console — minor info-disclosure risk
  - No central toggle for production silencing if a noisy log starts firing in users' consoles
  - Violates the spirit of "12-Factor Config" (logging behaviour is hardcoded, not environment-driven)
- **Technical Fit**: **Low** — fails an explicit AC
- **Complexity**: **Lowest**

#### Option 2: Thin `src/utils/logger.ts` wrapper, env-aware, no external dependency

- **Description**: A ~30-line module that exports a `logger` object with `debug/info/warn/error` methods. In development (`import.meta.env.DEV`), each method delegates to the corresponding `console.*` call; in production (`import.meta.env.PROD`), `debug`/`info` are no-ops and `warn`/`error` either no-op or invoke a future `sendToBackend()` hook (TBD, post-MVP). The module is the *only* file allowed to import `console`; everywhere else, `'no-console': 'error'` lints it.
- **Pros**:
  - **Satisfies AC-ERROR-1** without ceremony
  - **Consistent with backend** — the frontend has a Logger abstraction with env-driven behaviour, mirroring `backend/src/types/logger.ts` and `backend/src/config/logger.ts`
  - **Future-ready**: when remote log aggregation is added (post-MVP), only `logger.ts` changes; consumers untouched
  - **12-Factor compliant**: behaviour driven by `import.meta.env.MODE` (build-time env), no hardcoded `if` chains in feature code
  - **Tree-shakeable**: production builds drop the dev-only `console.*` calls via dead-code elimination on the `import.meta.env.DEV` constant
  - **Zero new dependencies**
  - **OTel-shape parity** with the backend Logger: same method names (`debug/info/warn/error`), same first-arg-is-message convention — easy to evolve into a real OTel client in FEAT-007+ without consumer changes
- **Cons**:
  - 30 lines of code to maintain (negligible)
  - One indirection ("why don't we just use console?") — addressed by a doc-comment at the top of `logger.ts`
- **Technical Fit**: **High** — mirrors the established backend pattern at MVP-appropriate fidelity
- **Complexity**: **Low**

#### Option 3: Install a frontend logger library (`loglevel`, `pino/browser`, `tslog`)

- **Description**: Add a third-party logger to the bundle.
- **Pros**:
  - Battle-tested log-level filtering
  - `pino/browser` matches backend exactly
- **Cons**:
  - **New dependency** for a problem that 30 lines of code solves better
  - `pino/browser` is ~7 kB gzipped — large for the MVP value delivered
  - `loglevel` is fine (~1 kB) but is still a dep we control less than 30 lines of our own
  - Doesn't satisfy any AC that Option 2 doesn't satisfy
  - Violates "No Premature Abstractions" — we're solving a problem (multi-transport, level filtering, remote sinks) that we don't have yet
- **Technical Fit**: **Medium**
- **Complexity**: **Low-Medium**

### Evaluation Matrix

| Criteria | Option 1 (raw console) | Option 2 (thin wrapper) | Option 3 (lib) |
|----------|------------------------|--------------------------|----------------|
| Satisfies AC-ERROR-1 | No | Yes | Yes |
| Backend parity | None | Good (shape match) | Best |
| Bundle cost | 0 | ~0 (tree-shaken in prod) | 1–7 kB |
| 12-Factor compliance | Low | High | High |
| Future-ready for remote sinks | Low | High (one place to change) | Highest |
| No Premature Abstractions | High | High | Low |
| Simplicity Principle | High | High | Medium |

### Decision: **Option 2 — thin `src/utils/logger.ts` wrapper, env-aware, zero external deps**

**Rationale**: This is the only option that satisfies AC-ERROR-1 *and* respects every Guiding Principle (12-Factor Config, No Premature Abstractions, Simplicity over Cleverness). It mirrors the backend Logger interface shape so contributors don't context-switch, and it leaves a clean seam for future remote logging without paying that cost today.

**ESLint configuration**:
- Add `'no-console': 'error'` to `frontend/eslint.config.js` for `src/**/*.{ts,tsx}` (matching backend pattern).
- **Exception for `src/utils/logger.ts`** via per-file override: `'no-console': 'off'` only for that one file. This is the documented, narrow escape hatch.
- Tests (`*.test.ts`, `*.test.tsx`) get `'no-console': 'off'` (matching backend pattern, line 86 of `backend/eslint.config.js`).

**Logger shape** (target — Phase 1 implementation):

```typescript
// src/utils/logger.ts
// eslint-disable-next-line no-console -- this file is the only sanctioned console wrapper
type LogContext = Record<string, unknown>;

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
}

const isDev = import.meta.env.DEV;

export const logger: Logger = {
  debug: isDev ? (m, c) => console.debug(`[debug] ${m}`, c ?? '') : () => {},
  info:  isDev ? (m, c) => console.info(`[info] ${m}`, c ?? '')   : () => {},
  warn:  isDev ? (m, c) => console.warn(`[warn] ${m}`, c ?? '')   : (m, c) => console.warn(`[warn] ${m}`, c ?? ''),
  error: isDev
    ? (m, e, c) => console.error(`[error] ${m}`, e ?? '', c ?? '')
    : (m, e, c) => console.error(`[error] ${m}`, e ?? '', c ?? ''),
};
```

(Note: `warn` and `error` are NOT no-ops in production — user-facing problems should still surface in the browser console even in prod builds. `debug` and `info` *are* no-ops in production to keep the console clean.)

**Trade-offs accepted**:
- Frontend log levels are not env-var driven (unlike backend `LOG_LEVEL`). This is acceptable for MVP because the frontend has no log aggregator and no operator-facing log file; verbosity is a developer concern, gated by `import.meta.env.DEV`. If post-MVP work introduces remote log shipping, a `VITE_LOG_LEVEL` env var becomes trivial to add inside the same module.

---

## CE-6: TypeScript Types Location — Inline vs Shared Workspace

### Context

The backend currently has **no domain TypeScript types** for `Board`, `Column`, `Card`, `Label` — the entities don't exist on the backend yet (verified via Grep: no matches in `backend/src/`). They will be added in FEAT-003 (or earlier task on the backend side). The frontend needs these shapes for the API client stub in Phase 1 of TASK-002, even though no real requests are made yet.

### Options Explored

#### Option 1: Inline in `frontend/src/types/` (frontend-owned, no workspace)

- **Description**: Define `Board`, `Column`, `Card`, `Label` interfaces in `frontend/src/types/domain.ts`. The backend defines its own equivalents when it implements the REST endpoints. Drift is prevented by integration tests (FEAT-003+) and code review.
- **Pros**:
  - **Zero infrastructure** — no npm workspaces, no TypeScript project references, no path-alias setup
  - **Aligns with No Premature Abstractions** — backend types don't exist yet; we'd be sharing nothing
  - **Frontend ships independently** — the frontend doesn't need the backend to build
  - **Simplicity over Cleverness** — the obvious thing
  - **Common pattern**: many production frontends keep their own DTO types separate from server-side domain types (server domain ≠ wire format anyway)
- **Cons**:
  - **Drift risk** when backend types do appear — two definitions of `Card` could diverge silently
  - Duplicated code (mitigated by both sides being small)
- **Technical Fit**: **High** for current state (no backend types exist)
- **Complexity**: **Lowest**

#### Option 2: `shared/` npm workspace package

- **Description**: Convert the repo to an npm workspaces monorepo. Add `shared/` package exporting domain types. Both `frontend` and `backend` add `"@banyanboard/shared": "workspace:*"` to dependencies.
- **Pros**:
  - Single source of truth for domain types
  - DRY enforced by tooling
- **Cons**:
  - **Repo restructure** — `package.json` at root with `workspaces` field, Docker builds need updating to copy `shared/` before `frontend` and `backend`, CI scripts change
  - **Build-order complexity** — `shared/` must build before its consumers
  - **Premature**: nothing is shared yet. Building infrastructure for one consumer (frontend) is the textbook anti-pattern that "No Premature Abstractions" guards against
  - **Docker layer caching breaks** — workspace dependencies require workspace-aware lockfile handling in the Dockerfile (the existing backend Dockerfile is single-package)
  - **DnD-kit / TanStack Query type imports** — these are external; the shared package doesn't help with library types
  - **For a 2–15-user Kanban app**, the maintenance cost dwarfs the deduplication win
- **Technical Fit**: **Low** — over-engineered for the use case
- **Complexity**: **High** (repo restructure)

#### Option 3: Generate frontend types from backend OpenAPI spec

- **Description**: Backend produces an OpenAPI spec (or uses something like `zod-to-openapi`); frontend runs `openapi-typescript` to generate types. Types stay in sync mechanically.
- **Pros**:
  - True single source of truth (server-defined)
  - No manual sync
- **Cons**:
  - **Backend doesn't expose OpenAPI yet** and adding it is its own task
  - **Build-time code generation** in the frontend — new tooling
  - **Hard to debug** when generated types are wrong
  - **Premature**: there are zero endpoints to generate types for at TASK-002 time
  - Useful pattern, but not at this maturity stage of the project
- **Technical Fit**: **Low** for this task
- **Complexity**: **Medium-High**

### Evaluation Matrix

| Criteria | Option 1 (Inline) | Option 2 (Shared workspace) | Option 3 (OpenAPI gen) |
|----------|--------------------|------------------------------|------------------------|
| Setup cost | None | High (workspace restructure) | High (OpenAPI tooling + backend) |
| Drift risk | Medium (mitigated by tests) | Low | Lowest |
| Build complexity | None | Medium (Docker, CI) | Medium (codegen step) |
| Future-proof | Easy refactor to shared/ later | N/A (already there) | Best |
| Simplicity Principle | High | Low | Low |
| No Premature Abstractions | High | Violates | Violates |

### Decision: **Option 1 — Inline in `frontend/src/types/`**

**Rationale**: There are no backend domain types to share with today (verified — zero `Board`/`Column`/`Card` types exist in `backend/src/`). Building a `shared/` workspace before there's a second consumer is the textbook "No Premature Abstractions" violation that systemPatterns explicitly warns against. The migration path is cheap: if FEAT-003's backend implementation introduces backend-side types and drift becomes a real (not hypothetical) pain, a focused refactor task can introduce `shared/` then — by which point we'll have **two** concrete consumers and a real reason.

**File layout**:

```
frontend/src/types/
├── domain.ts        # Board, Column, Card, Label interfaces
├── api.ts           # Request/response DTOs (extends domain types; FEAT-003 will populate)
└── index.ts         # Barrel export
```

**Initial `domain.ts` contents** (shape only — fields confirmed against productBrief functionality):

```typescript
// src/types/domain.ts
// Domain entity shapes. These mirror the future backend domain model.
// When FEAT-003 implements the backend endpoints, keep this file in sync via
// integration tests. If drift becomes painful (>3 silent breakages), consider
// extracting to a shared/ workspace package.

export interface Label {
  id: string;
  name: string;
  color: string;  // hex / Tailwind token; finalised in CE-2
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;  // ISO 8601 date string
  labels: Label[];
  position: number;        // sort order within column
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  cards: Card[];           // hydrated when loaded with board detail
}

export interface Board {
  id: string;
  name: string;
  columns: Column[];       // hydrated when loaded by id
  createdAt: string;
  updatedAt: string;
}
```

**Trade-offs accepted**:
- Once the backend defines its own types in FEAT-003 (or a sibling task), there will be two definitions of these shapes briefly. Acceptable because:
  - The frontend file is the *wire format* (what the JSON API returns) — the backend may legitimately have a richer internal domain model.
  - A focused "extract shared types" refactor task (Level 2, half a day) can land in FEAT-003's planning if the drift pain materialises.
- Future post-MVP consideration: OpenAPI-driven type generation becomes attractive once the backend ships a stable spec — explicitly out of scope for TASK-002 and called out as a Future Enhancement.

---

## Cross-Cutting: Observability Architecture (for Frontend)

The frontend has a much smaller observability surface than the backend (no incoming requests, no service-to-service hops). The MVP commitments are:

### Logging
- **Library**: Internal `src/utils/logger.ts` (Option 2 above). Mirrors backend Logger interface shape; OTel-compatible method names.
- **Format**: Plain console output in development (with `[level]` prefix); no-op (debug/info) or surfaced (warn/error) in production.
- **Configuration**: Behaviour switched on `import.meta.env.DEV` / `import.meta.env.PROD` (Vite build-time). No runtime env var for log level in MVP.

### Distributed Tracing
- **Status**: **Deferred to post-MVP.** Same posture as backend Phase 5 — Logger interface is OTel-shaped so future wiring is mechanical.
- **Stub for FEAT-003**: The API client will be designed with header injection points so a future `traceparent` header can be added without changing call sites. Specifically, `apiClient.get/post/patch/delete` accept an optional `headers` parameter that the future trace middleware will populate.

### Metrics
- **Status**: Not applicable for MVP — no client-side metrics aggregation. Page-load metrics from browser DevTools are sufficient.

### Configuration Variables

| Variable | Purpose | Default | Required? |
|----------|---------|---------|-----------|
| `VITE_API_BASE_URL` | Backend REST API base URL | `http://localhost:3001` | No (warns + falls back) |
| `import.meta.env.DEV` | Vite-injected build-mode flag | (build-time) | (automatic) |
| `import.meta.env.PROD` | Vite-injected build-mode flag | (build-time) | (automatic) |

**No new env vars beyond `VITE_API_BASE_URL`** — this matches the spec scope boundary in TASK-002 ("`VITE_API_BASE_URL` is the only frontend environment variable in this task").

---

## Consolidated Decisions Summary

| ID | Question | Decision | Library / Version |
|----|----------|----------|-------------------|
| **CE-3** | Routing library | **React Router v6** (data-router API: `createBrowserRouter`) | `react-router-dom@^6.20.0` |
| **CE-4** | Global state | **Zustand** (single store, selector-only access) | `zustand@^4.5.0` |
| **CE-4b** | State-layer split | TanStack Query = server state; Zustand = client UI state; URL = deep-linkable state; `useState` = component-local | TanStack Query v5 + Zustand v4 |
| **CE-5** | Frontend logging | **Thin `src/utils/logger.ts` wrapper**, env-aware via `import.meta.env.DEV/PROD`. ESLint `no-console: error` with per-file exemption for `logger.ts` and test files | Built-in; no new dep |
| **CE-6** | Types location | **Inline in `frontend/src/types/`** (no shared workspace). Revisit if drift pain materialises | N/A |

### Dependency Additions to `frontend/package.json`

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^25.0.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "prettier": "^3.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

(Exact patch versions to be pinned at scaffold time. TailwindCSS pinned to v3 per TASK-002 risk register; v4 is a breaking change.)

---

## Implementation Guidelines (for Phases 1–3 of TASK-002)

### Phase 1 (Project Scaffold)

1. `npm create vite@latest frontend -- --template react-ts` — scaffold the project
2. Install dependencies listed above
3. Configure `frontend/tsconfig.json` strict mode (mirror backend: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`)
4. Configure `frontend/eslint.config.js`:
   - Flat-config format (matching `backend/eslint.config.js`)
   - `typescript-eslint` recommended
   - `'no-console': 'error'` for `src/**/*.{ts,tsx}`
   - Per-file override: `src/utils/logger.ts` gets `'no-console': 'off'`
   - Test files (`src/**/*.test.{ts,tsx}`) get `'no-console': 'off'`
   - `@typescript-eslint/no-explicit-any: 'error'` (mirror backend)
   - `@typescript-eslint/no-floating-promises: 'error'` (mirror backend)
   - `eslint-plugin-react-hooks` rules
5. Create `src/utils/logger.ts` per the CE-5 decision (shape shown above)
6. Create `src/api/apiClient.ts` — typed fetch wrapper:
   - Reads `import.meta.env.VITE_API_BASE_URL`; falls back to `'http://localhost:3001'` with `logger.warn(...)` (satisfies AC-ERROR-1)
   - Exposes `get<T>(path, init?)`, `post<T>(path, body, init?)`, `patch<T>(path, body, init?)`, `delete<T>(path, init?)`
   - Accepts optional `headers` parameter (future trace-context injection point)
   - No real backend calls in this task
7. Create `frontend/.env.example` documenting `VITE_API_BASE_URL`
8. Wire Vitest + React Testing Library + jsdom
9. Tests for `apiClient` (base URL resolution, env-var fallback, warning emission), and a typecheck-smoke test

### Phase 2 (App Shell + Routing) — depends on CE-1, CE-2 (UI/UX creative)

1. Create `src/router/index.tsx`:
   ```typescript
   import { createBrowserRouter } from 'react-router-dom';
   import { AppShell } from '../components/layout/AppShell';
   import { BoardListPage } from '../pages/BoardListPage';
   import { BoardDetailPage } from '../pages/BoardDetailPage';

   export const router = createBrowserRouter([
     {
       path: '/',
       element: <AppShell />,
       children: [
         { index: true, element: <Navigate to="/boards" replace /> },  // AC-NAV-2
         { path: 'boards', element: <BoardListPage /> },
         { path: 'boards/:boardId', element: <BoardDetailPage /> },
       ],
     },
   ]);
   ```
2. `AppShell.tsx` renders `<Sidebar />` + `<BoardHeader />` + `<Outlet />` in the three-zone layout (proportions per CE-1)
3. `Sidebar.tsx` uses `<NavLink to="/boards/...">` for active-state styling
4. Each page declares `type RouteParams = { boardId: string };` at the top and reads via `useParams<RouteParams>()`

### Phase 3 (State + Query Wiring) — depends on CE-4, CE-6 (this document)

1. Create `src/store/appStore.ts`:
   ```typescript
   import { create } from 'zustand';
   import { devtools } from 'zustand/middleware';

   interface AppState {
     activeBoardId: string | null;
     sidebarCollapsed: boolean;
     setActiveBoardId: (id: string | null) => void;
     toggleSidebar: () => void;
   }

   export const useAppStore = create<AppState>()(
     devtools(
       (set) => ({
         activeBoardId: null,
         sidebarCollapsed: false,
         setActiveBoardId: (id) => set({ activeBoardId: id }),
         toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
       }),
       { enabled: import.meta.env.DEV, name: 'BanyanBoard-AppStore' },
     ),
   );
   ```
2. Wire `QueryClientProvider` at the app root (`src/main.tsx`):
   ```typescript
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

   const queryClient = new QueryClient({
     defaultOptions: {
       queries: { staleTime: 30_000, retry: 1 },
     },
   });

   root.render(
     <QueryClientProvider client={queryClient}>
       <RouterProvider router={router} />
       {import.meta.env.DEV && <ReactQueryDevtools />}
     </QueryClientProvider>,
   );
   ```
3. Create `src/types/domain.ts` per the CE-6 decision (shapes shown above)
4. Tests:
   - `useQueryClient()` returns a client when called inside the tree (AC-HAPPY-4)
   - `useAppStore.getState()` returns initial state without error (AC-HAPPY-5)
   - `setActiveBoardId` mutates state and a selector reads the new value

---

## Validation Checklist

- [x] Meets all system requirements (routing, state, types, logging defined)
- [x] Respects technical constraints (TypeScript strict, 12-Factor, Vite, Docker)
- [x] Addresses non-functional requirements (bundle size, perceived latency, accessibility)
- [x] Technically feasible — all chosen libraries are mature, well-documented, and in active use
- [x] Risks identified and acceptable (see Risk Assessment below)
- [x] **Complies with all Guiding Principles in systemPatterns.md**:
  - Simplicity over Cleverness → React Router v6 (boring choice), inline types (no workspace)
  - No Premature Abstractions → No `shared/` workspace, no logger library, no codegen
  - 12-Factor Config → `VITE_API_BASE_URL` is the only env var; logger driven by `import.meta.env`
  - Optimistic UI → Zustand chosen specifically to support FEAT-003 DnD pattern
  - Clean Architecture (frontend mirror) → components → hooks → api client; cache mutations only via TanStack Query
- [x] Respects established patterns in systemPatterns.md (Logger shape mirrors backend)
- [x] Observability architecture defined (logger shape, env behaviour, trace-stub for future)
- [x] Trace context propagation — header injection seam provided in `apiClient`; full wiring deferred
- [x] Logging strategy consistent with observability-requirements.md (OTel-shape names, structured context arg)
- [x] Metrics strategy — N/A in MVP for frontend; documented explicitly

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TanStack Query + Zustand state-split confuses contributors ("where does X go?") | Medium | Low | The CE-4b decision table is the contract; add a `src/store/README.md` snippet referencing it. Code review enforces the boundary. |
| Optimistic-DnD complexity in FEAT-003 exceeds Zustand's clarity | Low | Medium | The CE-4 decision was made *because* of FEAT-003; Zustand's selector model is well-proven for this exact workload (e.g., used by `react-flow`, `excalidraw`, `tldraw`). If pain emerges, escape hatch is to add an immer middleware (1 line). |
| Domain-type drift between frontend and backend | Medium | Medium | Integration tests (added in FEAT-003) will catch shape mismatches. If drift becomes painful, the refactor to a `shared/` workspace is a small, well-scoped task. |
| `'no-console': 'error'` lint rule too strict in development | Low | Low | Logger wrapper is the sanctioned escape hatch; per-file `no-console: off` for `logger.ts` and test files. Pattern matches backend. |
| React Router v6 → v7 migration | Low | Low | v7 is announced as additive (no breaking changes from v6 data-router API); migration when it lands will be a config swap. |
| Zustand maintainer abandonment | Very Low | Low | Library is < 200 lines of actual code; can be vendored. Backed by pmndrs collective (also maintains `react-three-fiber`, `jotai`). |

---

## Next Steps

1. **TASK-002 Phase 1 build** can proceed immediately on the basis of this document (combined with the UI/UX Design output for CE-1/CE-2).
2. **TASK-002 Phase 2 build** unblocked once UI/UX Design (CE-1, CE-2) is complete.
3. **TASK-002 Phase 3 build** fully unblocked by this document.
4. **FEAT-003 planning** will reference Section CE-4b (state-layer split) and the Optimistic-DnD forecast as the contract for the DnD implementation.
5. **Post-MVP consideration**: revisit shared types (OpenAPI generation) and remote log shipping if and when those needs materialise — both have clean migration paths from the chosen MVP architecture.

---

ARCHITECTURE CREATIVE COMPLETE
Document: memory-bank/creative/TASK-002-frontend-architecture.md
Decision: React Router v6 + Zustand + TanStack Query v5 (server/client state split per CE-4b) + thin `src/utils/logger.ts` env-aware wrapper + inline `frontend/src/types/` (no shared workspace).
