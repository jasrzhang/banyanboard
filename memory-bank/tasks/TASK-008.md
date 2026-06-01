# TASK-008: Basic User Administration

**Complexity**: Level 3
**Status**: BUILD
**Roadmap**: FEAT-008
**Branch**: feature/FEAT-008-basic-user-administration
**Worktree**: C:/git/banyanboard (main worktree, feature branch checked out)

## Task Description

Lightweight user identity layer for BanyanBoard. User model: `{ id, firstName }` — firstName is 2–30 characters, letters and spaces only. Backend: `POST /api/users/login` accepts `{ firstName }` and returns `{ id, firstName }`. Session persists in `localStorage` under the key `'currentUser'`. Header displays "Hi, {firstName}" when a session exists; shows a Login link otherwise. Logout clears the session and redirects to `/login`. Login form shows an inline validation error for invalid firstName.

---

## Specification

**Feature Type**: End-User Feature
**Primary Persona**: Team Member — individual contributor (dev, designer, PM) who wants to know what to work on and update card status quickly. The login is the entry point before they can use the board.
**Creative Exploration Needed**: No

### Invocation Method

**Login Entry Point**
- **Location**: `/login` — a standalone full-page route outside `AppShell`. Added alongside the existing `AppShell`-wrapped routes in `frontend/src/router/index.tsx`.
- **Element**: A `<LoginPage>` component rendered at `{ path: 'login', element: <LoginPage /> }` as a sibling of the root `AppShell` route (not nested inside it, so it has no sidebar or header).
- **Visibility**: Always accessible at `/login`. Unauthenticated users are redirected here from any protected route.
- **Navigation**: Browser navigates to `/` → redirect to `/boards` → if no `currentUser` in localStorage, redirect to `/login` → user sees login form.
- **Confidence**: HIGH — router pattern follows `createBrowserRouter` in `frontend/src/router/index.tsx` (lines 7–25); standalone route is the correct approach since AppShell wraps all current pages.

**Header Session Display**
- **Location**: `frontend/src/components/layout/GenericTopBar.tsx` — the persistent `<header>` rendered for all AppShell pages.
- **Element**: Right-hand area of the header. When `useCurrentUser()` returns a user: renders "Hi, {firstName}" text plus a Logout button/link. When no session: renders a "Login" link pointing to `/login`.
- **Visibility**: Always visible (header is always rendered inside AppShell).
- **Navigation**: N/A — passive display; Logout button triggers session clear + redirect.
- **Confidence**: HIGH — `GenericTopBar.tsx` is the correct component (line 5 of `AppShell.tsx`); the right-hand slot is currently empty (the header only contains a menu icon and "BanyanBoard" title).

### Success Criteria

**Login success**
- **User sees**: After submitting a valid firstName, the page redirects to `/boards`. The header in `GenericTopBar` displays "Hi, {firstName}".
- **Verifiable at**: `GenericTopBar` right-hand area; URL changes to `/boards`.
- **Data persisted**: `localStorage['currentUser']` = `{ id: "<uuid>", firstName: "<submitted value>" }`. Backend inserts or upserts a row in the new `users` table (`id uuid, first_name text`).
- **Observable within**: Immediate (synchronous localStorage write + React state update from `useCurrentUser` hook).

**Logout**
- **User sees**: Header reverts to showing the "Login" link. URL changes to `/login`.
- **Verifiable at**: `GenericTopBar` right-hand area; URL.
- **Data persisted**: `localStorage['currentUser']` key is removed.
- **Observable within**: Immediate.

**Validation error**
- **User sees**: Inline error message below/beside the firstName input (e.g., "Name must be 2–30 letters and spaces only") without navigating away. The submit button remains enabled for retry.
- **Verifiable at**: Login form, below the firstName input field.
- **Observable within**: Immediate (client-side validation on submit).

### Acceptance Criteria

#### AC-ENTRY-1: Unauthenticated user is redirected to /login
**Priority**: MUST
**Given** a user opens any protected route (e.g., `/boards`) with no `currentUser` key in localStorage
**When** the router evaluates the route
**Then** the user is redirected to `/login` and sees the login form with a firstName input and a "Log in" button

#### AC-ENTRY-2: Authenticated user is not forced to /login
**Priority**: MUST
**Given** a user has a valid `currentUser` object in localStorage
**When** the user navigates to `/login` directly
**Then** they are redirected to `/boards` (skip re-login)

#### AC-HAPPY-1: User completes the login journey
**Priority**: MUST
**Given** the user is on `/login` with no existing session
**When** they:
  1. Type a valid firstName (2–30 characters, letters and spaces only, e.g., "Alice") into the firstName input
  2. Click the "Log in" button (or press Enter)
  3. The frontend calls `POST /api/users/login` with `{ firstName: "Alice" }`
  4. The API returns `{ id: "<uuid>", firstName: "Alice" }` with HTTP 201
  5. The response is written to `localStorage['currentUser']`
**Then**:
  - The user is redirected to `/boards`
  - `GenericTopBar` displays "Hi, Alice" in its right-hand area
  - `localStorage['currentUser']` equals `{ id: "<uuid>", firstName: "Alice" }`

#### AC-HAPPY-2: Logged-in user can log out
**Priority**: MUST
**Given** the user is logged in (session in localStorage) and on any AppShell page
**When** they click the "Log out" button in `GenericTopBar`
**Then**:
  - `localStorage['currentUser']` is removed
  - The user is redirected to `/login`
  - `GenericTopBar` now shows the "Login" link instead of "Hi, {firstName}"

#### AC-HEADER-1: Header shows session greeting when user is logged in
**Priority**: MUST
**Given** the user has `{ id, firstName: "Bob" }` in `localStorage['currentUser']`
**When** they load any AppShell page
**Then** `GenericTopBar` right-hand area displays "Hi, Bob" and a "Log out" button; no "Login" link is visible

#### AC-HEADER-2: Header shows Login link when no session exists
**Priority**: MUST
**Given** no `currentUser` key in localStorage
**When** the user loads any AppShell page
**Then** `GenericTopBar` right-hand area displays a "Login" link pointing to `/login`; no "Hi, ..." text is visible

#### AC-ERROR-1: Login form shows inline validation error for invalid firstName (client-side)
**Priority**: MUST
**Given** the user is on `/login`
**When** they submit the form with an invalid firstName (empty string, single character, >30 characters, or containing non-letter/non-space characters such as "Al1ce" or "A!")
**Then**:
  - An inline error message appears below the firstName input (e.g., "Name must be 2–30 letters and spaces only")
  - No API call is made
  - The user remains on `/login` and the input retains focus for correction

#### AC-ERROR-2: Backend rejects invalid firstName with 400
**Priority**: MUST
**Given** a direct API call to `POST /api/users/login` with `{ firstName: "A" }` (or any invalid value)
**When** the request reaches the backend
**Then**:
  - The response is HTTP 400 with body `{ error: { message: "Invalid request", issues: [...], traceId: "..." } }` (matching the Zod validation error shape used by `LabelController` and `AutomationController`)
  - No user row is inserted

#### AC-ERROR-3: Backend rejects missing or empty request body with 400
**Priority**: MUST
**Given** a direct API call to `POST /api/users/login` with `{}`, or with no body at all
**When** the request reaches the backend
**Then**:
  - The response is HTTP 400 with the standard Zod error shape (missing `firstName` field reported in `issues`)
  - No user row is inserted

#### AC-ERROR-4: Login form rejects whitespace-only firstName
**Priority**: MUST
**Given** the user is on `/login`
**When** they submit the form with a firstName that contains only spaces (e.g., "   ")
**Then**:
  - The same inline validation error appears ("Name must be 2–30 letters and spaces only")
  - No API call is made
  - The input retains focus for correction
  - Note: the client-side validator must `.trim()` before checking the regex, or add a `refine` that rejects all-whitespace strings

#### AC-ASYNC-1: Login button is disabled while the request is in-flight
**Priority**: MUST
**Given** the user submits a valid firstName
**When** the `POST /api/users/login` request is pending (not yet resolved or rejected)
**Then**:
  - The "Log in" button is disabled (cannot be clicked again)
  - The firstName input is disabled
  - This prevents a duplicate user row from being created by a double-submit

#### AC-ASYNC-2: Network or server error on login shows a form-level error message
**Priority**: MUST
**Given** the user submits a valid firstName
**When** the `POST /api/users/login` call fails (network error, 500 response, or timeout)
**Then**:
  - A form-level error message appears (e.g., "Something went wrong. Please try again.")
  - The user remains on `/login`
  - The "Log in" button becomes enabled again so the user can retry
  - `localStorage['currentUser']` is NOT written (no partial session)

#### AC-SESSION-1: Session survives page reload
**Priority**: MUST
**Given** a user has logged in (localStorage['currentUser'] is set)
**When** they reload the page (F5)
**Then**:
  - `useCurrentUser()` reads localStorage on mount and restores the session
  - `GenericTopBar` shows "Hi, {firstName}" without requiring a new login

#### AC-SESSION-2: Corrupted localStorage is handled gracefully
**Priority**: MUST
**Given** `localStorage['currentUser']` contains invalid JSON (e.g., the string `"not-json"` or a partial object `"{id:"`)
**When** the app loads and `useCurrentUser()` initialises
**Then**:
  - The hook catches the JSON parse error silently and returns `null` (no uncaught exception, no white-screen crash)
  - `GenericTopBar` shows the "Login" link
  - The user is redirected to `/login` by the router guard as if unauthenticated

#### AC-SESSION-3: Re-login with the same firstName is idempotent (same user ID returned)
**Priority**: MUST
**Given** "Alice" has previously logged in and a `users` row with `first_name = 'Alice'` already exists
**When** "Alice" submits the login form again (from a new browser session or after clearing localStorage)
**Then**:
  - The API returns HTTP 201 with the **same** `id` UUID as the original login
  - No duplicate row is created in the `users` table
  - The session is established normally

### Scope Boundaries

**In scope**:
- `POST /api/users/login` endpoint: accepts `{ firstName }`, validates with Zod (2–30 chars, letters/spaces only), upserts or creates user row in `users` table, returns `{ id, firstName }` with HTTP 201.
- `users` DB migration: `users` table with `id uuid PK DEFAULT gen_random_uuid()`, `first_name text NOT NULL`, timestamps. No password column, no email column.
- `useCurrentUser()` hook in `frontend/src/hooks/useCurrentUser.ts`: reads/writes `localStorage['currentUser']` as `{ id, firstName }`. No direct localStorage access in components.
- `LoginPage` component at `frontend/src/pages/LoginPage.tsx`: firstName input, "Log in" button, inline validation error span.
- `GenericTopBar` update: "Hi, {firstName}" + Logout button when session active; "Login" link when not.
- Router update in `frontend/src/router/index.tsx`: add `/login` route (outside AppShell), add redirect guard for unauthenticated AppShell access.
- `User` type added to `frontend/src/types/domain.ts`: `{ id: string; firstName: string }`.
- `usersApi.ts` API module at `frontend/src/api/usersApi.ts`: wraps `apiClient.post('/api/users/login', ...)`.

**Out of scope**:
- Passwords, email, JWT tokens, or server-side sessions — this is prototype-level identity only.
- Authorization checks on existing board/card/column endpoints — no per-user access control in this feature.
- User listing, user deletion, or user profile editing.
- Persistent backend "remember me" sessions or token refresh.
- Any change to the board, column, card, label, or automation routes.
- Multi-user isolation — all boards remain accessible to any logged-in user (MVP).

**Dependencies**:
- Existing `backend/src/config/db.ts` pool for the new `UserRepository`.
- Existing `apiClient` in `frontend/src/api/apiClient.ts` for `usersApi.ts`.
- Existing `createBrowserRouter` router in `frontend/src/router/index.tsx`.
- `node-pg-migrate` for the `users` table migration (next migration timestamp: `1747600008000`).

**NFR implications**:
- Performance: `POST /api/users/login` must meet the p95 < 200ms target; a single `INSERT ... ON CONFLICT DO UPDATE` (upsert) or `INSERT` satisfies this.
- Accessibility: The login form must have a labelled input (`<label>` + `htmlFor`), a visible focus ring, and an `aria-invalid` + `aria-describedby` wired to the inline error span when validation fails (matches the ARIA co-location rule from `agent-rules/_learned/ui-patterns.md`).
- Security: No passwords or tokens in this feature; `first_name` is not PII-sensitive at MVP scope; no logging of firstName values to avoid future PII risk (follow LOG_REDACT_PATTERNS convention).
- Browser support: `localStorage` is universally available in Chrome 120+, Firefox 120+, Safari 17+, Edge 120+.

### Creative Exploration Needed

Specification is concrete — proceed to implementation planning.

---

## Test Strategy

### Approach
- **Emphasis**: Integration-first (matching project pattern in `systemPatterns.md`). Backend: supertest against a real Express app instance (`createApp()`). Frontend: React Testing Library + `vi.mock` for `usersApi` module to control API responses without a real server; jsdom `localStorage` is available and reset between tests via `beforeEach`.
- **Target test count**: ~7–8 backend test cases; ~14–16 frontend test cases split across three files. Total ~22.

### File Organization
- **New test files**:
  - `backend/src/__tests__/users.test.ts` — all backend integration tests for `POST /api/users/login`
  - `frontend/src/__tests__/useCurrentUser.test.ts` — hook isolation tests (localStorage read/write/clear/corrupt)
  - `frontend/src/__tests__/loginPage.test.tsx` — LoginPage render, submit flows, validation, async states, ARIA
  - `frontend/src/__tests__/genericTopBar.test.tsx` — session greeting, login link, logout action, corrupted storage
- **Extend existing**: None — no existing test file covers these components.

### What NOT to Test
- `localStorage` persistence across a real browser page reload (environmental; jsdom resets per test suite).
- PostgreSQL `gen_random_uuid()` correctness (third-party DB built-in).
- TypeScript compilation (covered by `npm run typecheck`).
- Redirect animation or transition timing.
- React Router DOM internal navigation logic (tested by the library itself).

### Per-Phase Test Guidance

#### Phase 1 — Backend (`users.test.ts`, ~7–8 tests)
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid firstName "Alice" → first call | 201 + `{ id: <uuid>, firstName: "Alice" }` |
| 2 | Same firstName "Alice" → second call (upsert) | 201 + **same** `id` as test 1 (idempotency — AC-SESSION-3) |
| 3 | firstName too short ("A") | 400 + `issues` array (AC-ERROR-2) |
| 4 | firstName too long (31-char string) | 400 + `issues` array |
| 5 | firstName contains digit ("Al1ce") | 400 + `issues` array |
| 6 | firstName is empty string `""` | 400 + `issues` array |
| 7 | Body is `{}` — missing `firstName` field | 400 + `issues` array (AC-ERROR-3) |
| 8 | firstName is all spaces `"   "` | 400 + `issues` array (AC-ERROR-4 server-side defence) |

**Setup**: use `createApp()` from `src/app.ts` + supertest; real PostgreSQL via docker-compose (same pattern as existing tests); run `migrate` before test suite.

#### Phase 2 — `useCurrentUser` hook (`useCurrentUser.test.ts`, ~5 tests)
| # | Scenario | Expected |
|---|----------|----------|
| 1 | localStorage empty on mount | hook returns `null` |
| 2 | localStorage has valid `currentUser` on mount | hook returns `{ id, firstName }` |
| 3 | `setUser({ id, firstName })` called | `localStorage['currentUser']` equals `JSON.stringify(...)` |
| 4 | `clearUser()` called | `localStorage['currentUser']` key is removed |
| 5 | `localStorage['currentUser']` contains invalid JSON | hook returns `null` without throwing (AC-SESSION-2) |

**Setup**: `beforeEach(() => localStorage.clear())`.

#### Phase 3 — LoginPage (`loginPage.test.tsx`, ~7 tests)
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Renders firstName input with label, "Log in" button | Elements present; no error span visible |
| 2 | Submit empty firstName | Inline error shown; `usersApi.login` NOT called (AC-ERROR-1) |
| 3 | Submit all-spaces firstName ("   ") | Inline error shown; API NOT called (AC-ERROR-4) |
| 4 | Submit firstName with digit ("Al1ce") | Inline error shown; API NOT called |
| 5 | Submit valid "Alice" → API resolves | `usersApi.login` called with `"Alice"`; `setUser` called; navigate to `/boards` |
| 6 | Submit valid name → API rejects (500) | Form-level error message shown; button re-enabled; localStorage NOT written (AC-ASYNC-2) |
| 7 | Submit valid name → while pending | Button and input are disabled (AC-ASYNC-1) |
| 8 | Error state → `aria-invalid="true"` on input, `aria-describedby` points to error span | ARIA attributes present |

**Setup**: `vi.mock('../api/usersApi')` to control resolve/reject; wrap in `MemoryRouter` for `useNavigate`.

#### Phase 4 — GenericTopBar (`genericTopBar.test.tsx`, ~4–5 tests)
| # | Scenario | Expected |
|---|----------|----------|
| 1 | localStorage has `{ id, firstName: "Bob" }` | "Hi, Bob" visible; "Log out" button visible; no "Login" link (AC-HEADER-1) |
| 2 | localStorage is empty | "Login" link visible; no "Hi, ..." text (AC-HEADER-2) |
| 3 | localStorage has corrupted JSON | Treated as no session → "Login" link visible (AC-SESSION-2) |
| 4 | Click "Log out" | `clearUser()` called; navigate to `/login` (AC-HAPPY-2) |

**Setup**: render with `MemoryRouter`; `beforeEach(() => localStorage.clear())`.

---

## Implementation Roadmap

### Phase 1: Backend — users table migration + POST /api/users/login
- [x] Migration `1747600008000_create-users.js`: `users` table (`id uuid PK DEFAULT gen_random_uuid()`, `first_name text NOT NULL UNIQUE`, `created_at timestamptz DEFAULT now()`)
- [x] `backend/src/schemas/userSchemas.ts`: `LoginSchema = z.object({ firstName: z.string().min(2).max(30).regex(/^[A-Za-z ]+$/).refine(s => s.trim().length >= 2, 'Name must contain at least 2 non-space characters') })` — covers AC-ERROR-4 server-side
- [x] `backend/src/repositories/UserRepository.ts`: `findOrCreate(firstName): Promise<{ id, firstName }>` using `INSERT INTO users (first_name) VALUES ($1) ON CONFLICT (first_name) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING id, first_name` — idempotent upsert (AC-SESSION-3)
- [x] `backend/src/services/UserService.ts`: `login(firstName): Promise<{ id, firstName }>` — delegates to repo
- [x] `backend/src/controllers/UserController.ts`: `POST /api/users/login` — Zod validation → service → 201 `{ id, firstName }`; 400 on Zod failure (matching existing Zod error shape)
- [x] `backend/src/routes/users.ts`: router wired to controller; exported as `usersRouter`
- [x] `backend/src/app.ts`: `app.use('/api/users', usersRouter)` (alongside existing routes)
- [x] `backend/src/__tests__/users.test.ts`: 8 integration tests per Test Strategy Phase 1 table

### Phase 2: Frontend — useCurrentUser hook + usersApi module
- [ ] `frontend/src/types/domain.ts`: add `export interface User { id: string; firstName: string; }`
- [ ] `frontend/src/api/usersApi.ts`: `login(firstName: string): Promise<User>` — calls `apiClient.post<User>('/api/users/login', { firstName })`
- [ ] `frontend/src/hooks/useCurrentUser.ts`: reads `localStorage['currentUser']` on mount inside `try/catch` (corrupted JSON → returns `null`, AC-SESSION-2); exposes `{ user, setUser, clearUser }`. `setUser` writes `JSON.stringify(user)`; `clearUser` removes key. No direct localStorage access in components.
- [ ] `frontend/src/__tests__/useCurrentUser.test.ts`: 5 unit tests per Test Strategy Phase 2 table

### Phase 3: Frontend — LoginPage + router guards
- [ ] `frontend/src/pages/LoginPage.tsx`: firstName `<input>`, "Log in" `<button>`, inline `<span>` validation error, form-level `<p>` API error; client-side validates (trim + regex) before API call (AC-ERROR-1, AC-ERROR-4); disables button + input while request is pending (AC-ASYNC-1); on API rejection shows form-level error + re-enables button (AC-ASYNC-2); on success calls `setUser` then navigates to `/boards`; `aria-invalid` + `aria-describedby` wired to error span
- [ ] `frontend/src/router/index.tsx`: add `{ path: 'login', element: <LoginPage /> }` as a top-level route (sibling of the `AppShell` root route); add `ProtectedRoute` wrapper or inline redirect in AppShell child routes that checks `useCurrentUser().user` and redirects to `/login` when null (AC-ENTRY-1); add redirect from `/login` to `/boards` when already authenticated (AC-ENTRY-2)
- [ ] `frontend/src/__tests__/loginPage.test.tsx`: 8 tests per Test Strategy Phase 3 table

### Phase 4: Frontend — GenericTopBar session display
- [ ] `frontend/src/components/layout/GenericTopBar.tsx`: import `useCurrentUser`; render "Hi, {firstName}" + Logout button when user is set; render `<Link to="/login">Login</Link>` when user is null; Logout handler calls `clearUser()` then `navigate('/login')`
- [ ] `frontend/src/__tests__/genericTopBar.test.tsx`: session greeting, login link, logout action

---

## Creative Phases

None required — the feature is fully specified by FEAT-008. All design decisions (localStorage key, endpoint shape, validation rules, redirect targets, header placement) are explicit in the feature description.

---

## Execution State

**Build Status**: RUNNING
**Current Build**: Phase 1: Backend — users table migration + POST /api/users/login (TASK-008)
**Build Started**: 2026-06-01
**Phase Number**: 1 of 4
**Is Multi-Phase**: YES

### Current Build Step
**Step**: Step 11 - Git Commit (Phase 1 Complete)
**Status**: COMPLETE
**Started**: 2026-06-01
**Completed**: 2026-06-01

### Completed Steps
- Spec Writer Agent: specification written (2026-05-30)
- Human review: AC enriched (2026-05-30)
- Step 0.5 Git Setup: COMPLETE (2026-06-01) - Feature branch created, working in main worktree
- Step 1 Read Task Context: COMPLETE (2026-06-01) - Phase 1 identified, Level 3
- Step 3 Test Writer: COMPLETE (2026-06-01) - 8 tests in users.test.ts
- Step 4 Coding Agent: COMPLETE (2026-06-01) - Migration, schema, repo, service, controller, route, app wired
- Step 7 Integration Verification: COMPLETE (2026-06-01) - 120/120 tests pass, build clean, lint clean
- Step 11 Git Commit: COMPLETE (2026-06-01) - Phase 1 committed to feature branch

### Sub-Agents
(none - implemented directly)

### Resumption Notes
**Can Resume**: YES
**Resume From**: Phase 2
**Notes**: Phase 1 complete. Next: /banyan-build TASK-008 for Phase 2 (useCurrentUser hook + usersApi module)
