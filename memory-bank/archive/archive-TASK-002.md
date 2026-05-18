# Archive: TASK-002 — Frontend Foundation

**Task ID**: TASK-002
**Feature**: FEAT-002
**Complexity**: Level 3
**Status**: ✅ COMPLETE
**Date Completed**: 2026-05-18
**Branch**: feature/FEAT-002-frontend-foundation (merged to master)
**Worktree**: `.claude-worktrees/FEAT-002` (removed)

---

## Summary

TASK-002 delivered the complete BanyanBoard React frontend foundation across 3 build phases. All 9 acceptance criteria were met, 14 Vitest tests pass, and every phase was committed behind a tsc + lint + build gate. The creative phase (two documents, 6 creative decisions) resolved all design and architecture questions before implementation began — eliminating rework across Phases 2 and 3.

The result is a documented, stable frontend contract that FEAT-003 and FEAT-004 can build on without re-opening any design decisions.

---

## What Was Delivered

### Phase 1: Project Scaffold
- `frontend/` directory: Vite 5 + React 18 + TypeScript 5 strict
- TailwindCSS v3 with semantic design tokens (`bg-surface-page`, `bg-primary`, `text-text-primary`, etc.)
- Inter font (400/500/600 weights via `@fontsource/inter`)
- ESLint v9 flat-config with `no-console: error`; per-file override for `logger.ts` and test files
- `src/utils/logger.ts` — dev-aware console wrapper (satisfies AC-ERROR-1 and `no-console` rule)
- `src/api/apiClient.ts` — typed fetch wrapper reading `VITE_API_BASE_URL` with fallback to `:3001` + `logger.warn()`
- Vitest v2 + React Testing Library v16; `globals: true` + `"types": ["vitest/globals"]` alignment
- `frontend/.npmrc` with `workspaces=false` (prevents npm workspace auto-detection)
- Docker Compose `frontend` service + `override.yml` for dev hot-reload
- **Tests**: 3 (apiClient base URL, env var fallback, API client type)
- **Commit**: `9483e08` "Phase 1: Project scaffold — Vite + React + TS + TailwindCSS + ESLint + Vitest"

### Phase 2: App Shell Layout
- `AppShell.tsx` — `flex h-screen overflow-hidden`, backdrop overlay on mobile/tablet
- `Sidebar.tsx` — fixed overlay (tablet, `z-50`) / static (desktop `lg:`), NavLink active states, 3 placeholder boards
- `BoardHeader.tsx` — burger button (`aria-label="Open navigation"`, `lg:hidden`), board title h1, "New Card" button
- `useSidebar.ts` hook — `isOpen/open/close/toggle`, local to AppShell (not in Zustand)
- `BoardListPage.tsx`, `BoardDetailPage.tsx` — placeholder route pages
- `src/router/index.tsx` — `createBrowserRouter` with `AppShell` as persistent shell, `Navigate` redirect `/ → /boards`, nested `<Outlet>`
- Deleted `src/App.tsx` (dead code after RouterProvider migration)
- **Tests**: 4 (AppShell renders, sidebar links, New Card button, burger toggle) + 3 route smoke = 7 new (10 total)
- **Commit**: `57170a4` "Phase 2: App shell layout — three-zone shell, routing, navigation"

### Phase 3: State + Query Wiring
- `main.tsx` — `QueryClientProvider` (staleTime 30s, retry 1) wrapping `RouterProvider`; `ReactQueryDevtools` conditional on `import.meta.env.DEV`
- `src/store/appStore.ts` — Zustand v4 `create<AppState>()()` with `devtools` middleware gated to DEV; `activeBoardId` + `sidebarCollapsed` slices
- `src/types/domain.ts` — `Board`, `Column`, `Card`, `Label` interfaces (inline per CE-6)
- `src/types/api.ts` — empty stub (`export type {}`)
- `src/types/index.ts` — re-export barrel
- **Tests**: 3 (Zustand init, `setActiveBoardId`, `toggleSidebar`) + 1 (QueryClient accessible in tree) = 4 new (14 total)
- **Commit**: `a8bd915` "Phase 3: State + query wiring — Zustand store, QueryClient, domain types"
- **Reflection commit**: `159bc4c` "TASK-002: Add task reflection + pattern extraction"

---

## Creative Decisions

Six creative decisions (CE-1 through CE-6) were resolved before Phase 2 began. Documents:
- `memory-bank/creative/TASK-002-app-shell-uiux.md` — CE-1, CE-2
- `memory-bank/creative/TASK-002-frontend-architecture.md` — CE-3, CE-4, CE-5, CE-6

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CE-1: Sidebar collapse | Burger-menu drawer (Option 1) — hidden on tablet, fixed on desktop | Matches Linear/Notion precedents; simpler than icon rail at MVP scale |
| CE-2: TailwindCSS tokens | Slate/indigo palette with semantic token names (`bg-surface-*`, `text-*`, `bg-primary`) | WCAG AA verified; semantic names decouple components from raw palette |
| CE-3: Routing library | React Router v6 `createBrowserRouter` + nested `<Outlet>` | Simpler than TanStack Router for a 3-route MVP; full type-safe route params unnecessary |
| CE-4: State management | Zustand v4 + three-layer split (TanStack Query / Zustand / URL / useState) | Testable without Provider wrapping; scales to FEAT-003 optimistic DnD |
| CE-5: Frontend logging | Thin `src/utils/logger.ts` wrapper (dev: console, prod: no-op) | Zero deps, satisfies `no-console` ESLint rule, mirrors backend Logger pattern |
| CE-6: Type location | Inline `frontend/src/types/` | No shared package complexity; migration to `shared/` is post-MVP |

---

## Acceptance Criteria Status

| AC | Description | Status |
|----|-------------|--------|
| AC-ENTRY-1 | `npm run dev` serves app shell at localhost:5173 | ✅ Met |
| AC-HAPPY-1 | Sidebar + header + empty main rendered | ✅ Met |
| AC-HAPPY-2 | `/boards` and `/boards/:id` resolve without 404 | ✅ Met |
| AC-HAPPY-3 | API client reads `VITE_API_BASE_URL` | ✅ Met |
| AC-HAPPY-4 | `QueryClient` accessible to all components | ✅ Met |
| AC-HAPPY-5 | Zustand store initialises without error | ✅ Met |
| AC-ERROR-1 | App loads with warning when `VITE_API_BASE_URL` not set | ✅ Met |
| AC-NAV-1 | Sidebar nav links navigate between routes | ✅ Met |
| AC-NAV-2 | Root `/` redirects to `/boards` | ✅ Met |
| AC-DOCKER-1 | Frontend service in Docker Compose | ✅ Met |

---

## Test Coverage

| Test File | Tests | Focus |
|-----------|------:|-------|
| `src/api/apiClient.test.ts` | 3 | Base URL, env var fallback, type safety |
| `src/components/layout/AppShell.test.tsx` | 4 | Three-zone render, sidebar links, burger toggle |
| `src/router/routes.test.tsx` | 3 | Route smoke tests (`/boards`, `/boards/:id`, redirect) |
| `src/__tests__/queryProvider.test.tsx` | 1 | QueryClient accessible in tree |
| `src/store/appStore.test.ts` | 3 | Init, `setActiveBoardId`, `toggleSidebar` |
| **Total** | **14** | All pass; tsc + lint + build gate clean |

---

## Technical Debt & Future Work

| Item | Priority | Target |
|------|----------|--------|
| React Error Boundary around `<Outlet>` in AppShell | High | FEAT-003 — prevents full shell unmount on render error |
| Focus trap for tablet sidebar drawer (WCAG 2.1 AA) | Medium | FEAT-003 — `useSidebar` hook is in place; trap logic missing |
| `RouteParams` type convention not enforced for `useParams` | Low | FEAT-003 — pattern needed when real route params are consumed |
| `systemPatterns.md` missing Frontend Architecture section | Low | Before FEAT-003 — document state-layer split and token strategy |
| Docker Compose integration smoke test | Low | CI setup — AC-DOCKER-1 verified by code review, not automated test |
| `sidebarCollapsed` vs `isOpen` dual-boolean distinction | Documentation | Add comment to `appStore.ts` clarifying the semantic difference |

---

## Key Learnings (Extracted)

Pattern extraction created or amended 3 learned rule files:

| Rule File | Action | Learning |
|-----------|--------|---------|
| `agent-rules/_learned/toolchain-setup.md` | Created | Vitest globals: both `globals: true` in config AND `"types": ["vitest/globals"]` in tsconfig; `.npmrc workspaces=false` for frontend subdirectories |
| `agent-rules/_learned/testing-patterns.md` | Amended | Zustand `beforeEach` reset with `setState(initialState)` prevents state leak between tests |
| `agent-rules/_learned/state-architecture.md` | Created | Three-layer state split (TanStack Query / Zustand / URL params) — documented contract for FEAT-003+ |

---

## Reflection

**Full reflection**: `memory-bank/reflection/reflection-TASK-002.md`

- **Task Quality**: Success — all 10 ACs met, 14 tests pass, no rework across phases
- **Ecosystem Effectiveness**: Highly Effective — Level 3 workflow appropriate; creative phase was the highest-leverage investment
- **Primary friction point**: 5 toolchain issues in Phase 1 (ESLint v9 plugin, npm workspace, Vitest globals, tsc emit, spy cache) — fully resolved, now captured in `toolchain-setup.md` learned rule

---

## Git History

```
159bc4c  TASK-002: Add task reflection + pattern extraction
a8bd915  Phase 3: State + query wiring — Zustand store, QueryClient, domain types
57170a4  Phase 2: App shell layout — three-zone shell, routing, navigation
9483e08  Phase 1: Project scaffold — Vite + React + TS + TailwindCSS + ESLint + Vitest
```

---

*Archived by `/banyan-archive` on 2026-05-18*
