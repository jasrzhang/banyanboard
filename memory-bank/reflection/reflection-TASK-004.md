# Reflection: TASK-004 — Card Detail Modal + Search/Filter

**Date**: 2026-05-19
**Task Complexity**: Level 3
**Total Phases**: 2
**Duration**: 2026-05-19 (single day, two build sessions)

## Executive Summary

TASK-004 delivered BanyanBoard's first interactive card-level workflow — a route-based card detail modal with inline editing, and a board-level search/filter system with a dropdown filter panel. The two-phase build added 17 new source files and extended 6 existing ones, landing at 68 tests passing (up from 52 after Phase 1). Both phases achieved a clean green state: `tsc`, `eslint`, and `vite build` all passed at the end of each phase.

The creative phase was the most impactful part of this task. Five questions were resolved before a single line of implementation was written, and four of the five decisions proved superior to the roadmap's initial assumptions. The most consequential decision — moving `BoardHeader` into `BoardView` rather than threading board data through `AppShell` — eliminated a prop-drilling problem and removed the need for any Zustand store changes. This simplification is a textbook example of the "move data closer to where it lives" principle paying off concretely.

One meaningful interruption occurred: the first `/banyan-build` invocation for Phase 2 ran out of context capacity after creating all new files but before fixing failing tests. The second invocation picked up cleanly from the test-failure state, diagnosed one assertion mismatch, fixed it, and then completed the remaining search/filter tests. This demonstrates the interruption-recovery mechanism working as designed — the execution state in TASK-004.md gave the second session enough context to resume without redundant work.

---

## Dimension 1: Task Implementation Quality

### Requirements Achievement

**Status**: All Met

| Acceptance Criterion | Status | Evidence |
|----------------------|--------|----------|
| AC-ENTRY-1: Card click opens modal, not placeholder page | Met | CardDetailModal replaces CardDetailPlaceholderPage via nested route; 9 cardDetail.test.tsx tests pass |
| AC-HAPPY-1: Modal displays all card fields | Met | Title input, description textarea, date input, label chips all rendered; null-field placeholders confirmed by tests |
| AC-HAPPY-2: User can edit and save cards | Met | useUpdateCard hook with optimistic update; PATCH call verified in test; success toast fires |
| AC-HAPPY-3: Search bar filters cards by title | Met | SearchInput + filterCards; typing hides non-matching cards in boardView.test.tsx |
| AC-HAPPY-4: Label and due-date filter chips | Met | FiltersDropdown with FilterChip; AND semantics; overdue/due-soon logic in filterCards |
| AC-ERROR-1: Save failure keeps modal open with inline error | Met | role="alert" banner rendered on PATCH failure; Save button re-enabled; user edits preserved |
| AC-ERROR-2: Null fields show empty states | Met | Empty string for description/dueDate; placeholder text renders; no JS errors |
| AC-DATA-1: Card edits persist across page refresh | Met by design | useUpdateCard invalidates ['board', boardId] on settled; next GET returns updated values from DB |

### Code Quality Assessment

**Overall Rating**: Good

**Maintainability**: The two-phase split kept each build session focused. Phase 1 delivered a self-contained modal with no coupling to Phase 2 constructs. Phase 2 added filter state purely within `BoardView` — the rest of the component tree was unchanged except for the `isFiltering` prop added to `Column`. The `filterCards` pure function is the cleanest piece of new code in the task: 45 lines, no side effects, no imports except the domain type.

**Architecture**: The architectural highlight is the Q4 decision made in the creative phase. Moving `BoardHeader` from `AppShell` into `BoardView` resolved three problems simultaneously: it eliminated prop-drilling of board data through the layout shell; it made `AppShell` agnostic to board context (correct by single-responsibility); and it made filter state a straightforward `useState` in `BoardView` rather than a Zustand store entry. The GenericTopBar replacement is clean — a 10-line component that satisfies the non-board-page header requirement without any coupling to board data.

The CardDetailModal's strategy of resolving card data from the existing `useBoard` cache (via a flat-map find across columns) rather than creating a separate `useCard(cardId)` hook is a pragmatic optimization. The creative doc's Q1 note anticipated that Option B might need its own card fetch, but the cached board data is already complete — the modal never triggers a network call on open, which satisfies the < 200ms NFR.

**Error Handling**: The inline error pattern in `CardDetailModal` follows `AddCardForm` exactly: `role="alert"` banner, `setErrorMessage`, Save button re-enabled in `finally`. The `window.confirm` guard on close when `isDirty` is the correct MVP approach — it prevents accidental data loss without introducing a custom dialog component that would be disproportionate for MVP scale.

**Testing**: The test split between `cardDetail.test.tsx` (component behavior), `boardSearch.test.tsx` (pure function), and `boardView.test.tsx` extensions (integration) is architecturally sound. Testing `filterCards` in isolation without React rendering means the business logic of AND semantics, date boundary conditions, and label OR-within-AND semantics is locked before any component wiring. The `within(filterPanel)` scoping technique in `boardView.test.tsx` (used for label chip selection) is the correct solution to the ambiguity where the same label text appears on both a `FilterChip` button and a `CardTile` label chip.

One gap: the `applyCardUpdate` pure function in `useUpdateCard.ts` is exported but has no dedicated unit tests. It is indirectly exercised through the `cardDetail.test.tsx` integration test that mocks the API and checks the toast fires — but the update application logic itself (field-level conditional spreading) is not explicitly asserted. This is a minor gap given the function's simplicity, but it is inconsistent with the pattern established in TASK-003 where all optimistic transform functions had standalone unit tests.

### Technical Decisions

**Key Decisions:**

1. **Route-based modal (Outlet pattern) vs state-based modal** — The creative phase correctly selected Option B. `CardTile` already called `navigate()` to the card detail route; Option B was a zero-regression upgrade of the existing placeholder. The modal gains deep-linking and browser Back for free. The implementation confirmed this: `BoardView` needed four lines of change (`<div className="flex flex-col h-full">` wrapper + `<Outlet />`), and the CardDetailModal itself is self-contained at its route.

2. **Card data from board cache, not separate useCard hook** — The creative doc's Option B notes warned about needing a separate GET for card data. In practice, the board cache from `useBoard(boardId)` already contains full card data including description, dueDate, and labels (the `GET /api/boards/:id` response established in TASK-003 includes all fields). The `flatMap + find` resolution pattern in `CardDetailModal` is O(n) on total cards — acceptable at MVP scale — and avoids a second network round-trip.

3. **filterCards as a pure function in utils/** — Correct decision, consistent with the pattern established in TASK-003 for `applyMoveOptimistic` and `applyCreateOptimistic`. Pure functions in `utils/` are independently testable and reusable. The `boardSearch.test.tsx` suite proves this out: 9 tests cover all filter combinations without a single component render.

4. **BoardHeader moved into BoardView (Q4 creative override of roadmap)** — The roadmap text anticipated filter state going into `appStore.ts`. The creative phase correctly identified that this would be wrong: board-scoped transient UI state (search query, active filters) belongs in the component that owns the board data, not in a global store. This decision was vindicated by the implementation — no Zustand store changes were needed at all, and the resulting `BoardView` is self-contained.

5. **Filter state as typed union, not Set for date filters** — Using `activeDateFilter: 'none' | 'overdue' | 'due-soon'` (a discriminated union) rather than a generic `Set<string>` for date filters is a subtle but correct design. Date filters are mutually exclusive by nature — you cannot simultaneously filter for overdue AND due-soon. The union type encodes this constraint in the type system and makes the toggle logic a simple equality comparison.

**Trade-offs:**

- **window.confirm for unsaved-changes guard**: Simpler than a custom dialog, but blocks the main thread and has a browser-specific appearance. Acceptable for MVP; should be replaced with a design-system dialog in a future iteration.
- **No applyCardUpdate unit tests**: The pure function was extracted and exported but not independently tested. Given its simplicity (field-level spread based on presence), this is a low-risk gap, but it breaks the TASK-003 precedent of testing all optimistic transform functions in isolation.
- **useEffect missing dependency array on keydown handler**: `CardDetailModal`'s keydown `useEffect` omits the dependency array (runs on every render). This is intentional — the `handleClose` function captures the current `dirty` state which changes on every form update, and adding it to deps would require useCallback or restructuring. A missing deps array is a stable pattern for always-fresh event handler re-registration, but it can be surprising to future maintainers.

### What Went Well

1. **Creative phase fully prevented rework.** All five Q1–Q5 decisions were made before implementation began. None required reversal during the build. The creative doc's component tree sketch in Q4 matched the actual directory structure exactly.

2. **filterCards pure function is bug-free on first write.** The 9 unit tests in `boardSearch.test.tsx` all passed after Phase 2 code was written. No logic bugs were found in the AND semantics, date boundary conditions, or null-handling branches. This is a direct benefit of extracting the logic before wiring it into a component.

3. **Test isolation via `within()` resolved the ambiguity cleanly.** When `getByRole('button', { name: /bug/i })` matched both the FilterChip and the CardTile label, the fix — scope to `within(filterPanel)` using the `role="group"` + `aria-label` on the filter panel — is both correct and teaches an important pattern: ARIA landmarks on interactive groups are useful not only for accessibility but also for test isolation.

4. **Zero dependency additions.** The entire feature was implemented with existing libraries: React Router `<Outlet>`, TanStack Query, React `useState`/`useMemo`, native `<input type="date">`, native `<textarea>`, `createPortal`, `document.addEventListener`. No new packages were added to `package.json`.

5. **The AppShell test fragility was diagnosed and fixed quickly.** When `BoardHeader` moved from `AppShell` into `BoardView`, the existing `AppShell.test.tsx` test checking for the "New Card" button in the header correctly failed — it was testing an element that had moved. The fix (assert on "BanyanBoard" wordmark in `GenericTopBar` instead) was the right update and now correctly tests `AppShell`'s actual responsibility.

### Challenges Encountered

1. **Build context exhaustion mid-Phase 2** — The first Phase 2 build session created all new files (FilterChip, FiltersDropdown, SearchInput, GenericTopBar, board/BoardHeader, filterCards, boardSearch tests) but ran out of context before completing and validating the boardView test extensions. The second build session resumed from the failing-tests state and completed the work in a single focused pass. Resolution: execution state in TASK-004.md was current enough to enable clean resumption.

2. **Multiple DOM elements matching label button names** — `getByRole('button', { name: /bug/i })` was ambiguous: it matched both the FilterChip in the filter panel and the label chip rendered inside a CardTile. Resolution: added `role="group"` and `aria-label="Filter options"` to the filter panel div and used `within(filterPanel)` to scope queries. This also improved accessibility.

3. **ESLint exhaustive-deps on filteredColumns useMemo** — Initial implementation used an intermediate `filterState` object inside the `useMemo` callback to combine the three filter state variables. This violated `react-hooks/exhaustive-deps` because `filterState` was not in the dependency array. Resolution: inline the three state variables directly in the `useMemo` deps array, matching `[board, searchQuery, activeLabelIds, activeDateFilter, hasActiveFilters]`.

4. **Creative doc vs. task roadmap discrepancy on filter state location** — The task roadmap specified Zustand `appStore` for filter state; the creative doc (decided later) specified `useState` in `BoardView`. Resolution: the creative doc governs; this is the correct outcome of the creative phase purpose.

### Technical Debt & Future Work

- **`applyCardUpdate` unit tests missing**: Add 3–4 unit tests for the pure function in `useUpdateCard.ts`, consistent with the TASK-003 pattern for optimistic transform functions.
- **`window.confirm` unsaved-changes guard**: Replace with a design-system dialog component when one is available. The native confirm dialog is an MVP shortcut.
- **useEffect keydown handler missing deps array**: Consider refactoring to `useCallback` + explicit deps, or add a comment explaining the intentional omission, so future maintainers don't introduce a lint-suppression comment.
- **`CardDetailModal` does not support label assignment**: Labels are display-only in the modal per scope boundaries. Label assignment requires a backend endpoint that does not yet exist. This will be a future feature.
- **No mobile optimization for filter panel**: The filter panel uses `position: absolute` which overlays columns correctly on tablet but is untested on small viewports. A future iteration should verify behavior at < 640px.

---

## Dimension 2: Claude Code Ecosystem Effectiveness

### Build Session Analysis

**Note**: `.agent-logs/claude/by-task/` directory does not exist for this project. Session logs are not task-indexed. Run `/banyan-init` to upgrade. Metrics below are reconstructed from task execution state records in `TASK-004.md` and code artifact inspection.

**Build Sessions**: 3 total (1 planning/creative session; 1 Phase 1 build; 2 Phase 2 build — the second resuming from a context-exhausted first)
**Sub-Agents Spawned**: ~4 estimated (Spec Writer in plan phase; creative design agents; build coding agents per phase)
**Tool Calls**: Not available from logs; estimated 60–90 across the two phases based on file count (17 new files, 6 modified files)
**Errors Recovered**: 4 (AppShell test button assertion; within() scope fix; exhaustive-deps lint fix; context exhaustion requiring second Phase 2 session)

#### Tool Utilization (estimated from artifacts)

| Tool | Estimated Count | Notes |
|------|----------------|-------|
| Read | ~30 | Context loading: TASK-004.md, existing components, test fixtures, creative docs |
| Write | ~17 | New source files: CardDetailModal, filterCards, SearchInput, FilterChip, FiltersDropdown, GenericTopBar, board/BoardHeader, hooks/useUpdateCard, boardSearch.test, cardDetail.test |
| Edit | ~15 | Modifications: AppShell, BoardView, Column, router/index, boardView.test, AppShell.test, boardsApi |
| Bash | ~20 | Test runs (vitest), typecheck (tsc), lint, build |
| Grep | ~10 | Codebase discovery: finding existing patterns (AddCardForm error handling, CardTile label rendering) |
| Glob | ~5 | File discovery: component structure, test file locations |

#### Sub-Agent Performance

| Agent Type | Invocations | Effectiveness |
|------------|-------------|---------------|
| Spec Writer | 1 | Excellent — produced a detailed spec that caught the CardTile navigate() entry point precisely (HIGH confidence) |
| Creative Design Agent | 1 (5 questions) | Excellent — all 5 decisions proved correct; Q4 was the most impactful |
| Build Coding Agent (Phase 1) | 1 | Excellent — 9 tests, all implementation, clean on first pass |
| Build Coding Agent (Phase 2) | 2 | Good — first session exhausted context after file creation; second session diagnosed and completed cleanly |

### Command Workflow Evaluation

**Commands Used**:
- `/banyan-plan TASK-004` — 1 invocation
- `/banyan-creative TASK-004` — 1 invocation (resolved Q1–Q5)
- `/banyan-build TASK-004` — 3 invocations (Phase 1, Phase 2 first, Phase 2 second/resumption)
- `/banyan-reflect TASK-004` — current invocation

**Workflow Efficiency**: Good

**Assessment**:
- The Level 3 workflow (plan → creative → build per phase → reflect) was well-suited to this task. Having creative exploration before Phase 1 meant the Q4 architecture decision (BoardHeader in BoardView) was made before any code was written, saving what would otherwise have been a significant refactor mid-Phase 2.
- The two-phase build split was correct: Phase 1 (modal) and Phase 2 (search/filter) are genuinely independent — Phase 2 does not depend on Phase 1 features at the component level, and testing them separately kept each session focused.
- Context exhaustion in Phase 2 reveals a workflow gap: very large phases that create many new files (Phase 2 created ~10 new files + test files) can exhaust the build agent context window before reaching the verification step. The system recovered correctly via the execution-state resume mechanism, but the interruption was avoidable with a finer-grained phase split (e.g., splitting Phase 2 into 2a: filter utility + components, 2b: BoardView wiring + tests).
- The creative doc's "Implementation Guidelines" and "Component Structure" sections were so complete that they served as a near-direct specification for the build agent. This is the intended use of the creative phase and it worked well.

### Context File Effectiveness

**Files Loaded**: TASK-004.md, creative/TASK-004-card-detail-search-filter-uiux.md, creative/TASK-004-card-detail-search-filter-user-journey.md, techContext.md, systemPatterns.md, agent-rules/_learned/*.md

**Assessment**:
- **Helpful**: The UI/UX creative doc was the most load-bearing context file. Its "Design Specifications" and "Implementation Guidelines" sections provided component names, Tailwind class patterns, prop interfaces, and event-handler strategies. The creative doc functioned as a detailed implementation guide, not just a design artifact.
- **Helpful**: The `state-architecture.md` learned rule correctly prompted the agent to consider the three-layer contract when choosing where to put filter state. This rule had been extracted from TASK-002's reflection and applied correctly here.
- **Gaps**: The learned rules do not yet cover UI component decomposition heuristics. A rule like "extract dropdown open/close state into a dedicated component rather than hosting in a parent" would have been useful guidance for the `FiltersDropdown` implementation.
- **Gaps**: There is no context file covering testing patterns for route-based modals specifically. The `cardDetail.test.tsx` test setup (wrapping `CardDetailModal` in a `MemoryRouter` with `<Routes>` + `<Route>` + a `BoardShell` outlet wrapper) required bespoke scaffolding that future tasks will likely duplicate.

### Memory Bank Organization

**Assessment**:
- **Structure**: The separation of creative docs by task ID (`TASK-004-card-detail-search-filter-uiux.md`) works well for a task with a single creative phase. The doc is easily found from the task file.
- **Navigation**: The task file (`TASK-004.md`) is the authoritative hub — it references the creative doc, lists all implementation steps with checkboxes, and tracks execution state. This hub-and-spoke structure worked well.
- **Completeness**: The `progress.md` one-liner summaries for each build phase are sufficiently detailed to reconstruct what happened without reading all individual files. The reflection here confirms they accurately represent what was built.
- **Suggestion**: A `memory-bank/patterns/` directory for reusable UI patterns (e.g., "route-based modal test harness", "dropdown panel with outside-click close") would reduce per-task scaffolding work. Currently this knowledge is embedded in creative docs that are task-scoped and not easily discovered for future tasks.

### Suggested Improvements to Claude Code System

**High Priority**:
1. **Phase size estimation before build** — The build agent should estimate the number of new files to be created at the start of a phase and warn if the count exceeds ~8–10. Large phases can exhaust the context window before reaching the verification step. This warning would prompt the user to split the phase before starting, rather than discovering mid-build that resumption is needed.
2. **Route-based modal test harness in context library** — Add a reusable test harness pattern to a shared context file or learned rule: the `MemoryRouter` + `Routes` + `Route` + outlet wrapper structure used in `cardDetail.test.tsx` is boilerplate that every future route-rendered modal test will need. Embedding this pattern in a `testing-patterns` context file would save 20–30 lines of test scaffolding per task.

**Medium Priority**:
3. **Creative doc "gaps found during implementation" section** — Add a final section to creative doc templates for "post-implementation notes" where agents can record deviations from the creative decisions (e.g., "card data resolved from board cache rather than separate useCard hook as Q1 Option B note anticipated"). This closes the feedback loop between creative decisions and actual implementation.
4. **Learned rule for dropdown/panel pattern** — Extract the FiltersDropdown `useEffect` + `document.addEventListener('mousedown')` + `document.addEventListener('keydown')` outside-click-close pattern into a learned rule. This is the second time it has appeared (first was FiltersDropdown; the pattern also applies to any future tooltip or popover). A rule like "use a single useEffect with mousedown+keydown listeners for outside-click-close; condition on isOpen to avoid listener registration when panel is closed" would standardize the pattern.
5. **Agent logs task indexing** — The `.agent-logs/claude/by-task/` directory was not present for this project. Session metrics extraction during reflection depends on this directory. Running `/banyan-init` to enable task-indexed logs would make future reflections more data-driven.

**Low Priority / Nice to Have**:
6. **Filter state persistence to URL params** — The current design intentionally does not persist filter state across navigation. A future enhancement could encode `searchQuery` and `activeLabelIds` in URL search params to enable bookmarkable filtered board views. This aligns with the three-layer state contract (URL params for deep-linkable state).
7. **Creative phase checklist gate for scope-creep** — The task roadmap mentioned `appStore` for filter state; the creative doc correctly overrode this. A system prompt reminding creative agents to explicitly call out roadmap assumptions they are overriding (and why) would make these changes more visible in the creative doc output.

**Note**: These are suggestions only. Do NOT implement these changes — they are recommendations for future system enhancements.

---

## Key Learnings

### Extractable Learnings (for Continuous Learning)

- **ui-patterns** (`src/components/**/*.tsx`, `frontend/src/**/*.tsx`): Use `within(container)` to scope RTL queries to a specific ARIA group when the same text or role appears in both a filter panel and a content area — also drives you to add correct ARIA landmarks on interactive groups.
- **testing-patterns** (`*.test.tsx`, `frontend/src/__tests__/*.tsx`): For route-rendered components (e.g., modals at nested routes), wrap the test in `MemoryRouter` + `Routes` + `Route` + an outlet-bearing shell component so React Router context is present and `useParams` resolves correctly.
- **state-architecture** (`frontend/src/components/**/*.tsx`): Board-scoped transient UI state (search query, active filters) belongs in `useState` within the component that owns the server data (e.g., `BoardView`), not in a global Zustand store — avoids store pollution and eliminates cleanup requirements on unmount.
- **architecture** (`frontend/src/utils/*.ts`, `src/utils/*.ts`): When filter logic spans multiple conditions with AND semantics, represent date-filter modes as a discriminated string union (`'none' | 'overdue' | 'due-soon'`) rather than a Set entry — the union enforces mutual exclusivity in the type system and simplifies toggle logic to a single equality check.

**Level note**: Level 3 task — 4 learnings at the upper bound. All four represent genuinely new patterns not covered by existing learned rules.

### Learned Rules Applied

- **state-architecture.md**: The three-layer split contract rule was directly applicable. When deciding where to put filter state, the rule "TanStack Query for server data, Zustand for client UI state, URL params for deep-linkable state" was consulted — and the creative phase conclusion that `useState` in `BoardView` was more appropriate than Zustand for board-scoped transient state is a refinement of this rule (distinguishing between global UI state and component-scoped UI state).
- **optimistic-updates.md**: The `applyCardUpdate` pure function in `useUpdateCard.ts` directly follows the "extract optimistic state transformation as pure exported functions" rule. The function is exported alongside the hook and could have unit tests added.
- **testing-patterns.md**: The "reset Zustand store in beforeEach" rule was not applicable (no Zustand state changes in this task), but the "use ESLint + structural test for layering" rule was implicitly followed (no new violations introduced).
- **architecture.md**: The "isolate pure computation functions into utils/" rule was applied: `filterCards` was extracted to `frontend/src/utils/filterCards.ts` with its own test file, consistent with the rule's directive.
- **error-handling.md**: The `AddCardForm` inline-error pattern (role="alert", stay open on failure, re-enable Save) was explicitly referenced in the task spec and followed in `CardDetailModal`. The learned rule about AbortError filtering was not applicable here (no AbortController cancel-previous pattern in card saves).

### For Claude Code Workflow

1. **Phase scope limits should be estimated upfront** — When a build phase involves more than ~8 new files, split it before starting. The Phase 2 context exhaustion was predictable: 10+ new files is a lot for one session. Planning agents should flag this.
2. **Creative decisions that override roadmap text should be explicit** — The creative doc replaced the roadmap's `appStore` recommendation with `useState`. This was correct but required the build agent to know to follow the creative doc over the roadmap. A standard "this overrides roadmap assumption X" callout in creative docs would make the precedence unambiguous.
3. **Test scaffolding for new rendering patterns belongs in shared context** — Route-rendered modal tests require a specific harness that is not intuitive. Encoding this pattern once (in a learned rule or context file) prevents each future task from rediscovering it.

---

## Conclusion

TASK-004 is a successful Level 3 delivery. Both phases landed on a clean green test suite, all acceptance criteria were met, and the creative phase decisions held up under implementation without any reversals. The most technically interesting aspects — the route-based modal via `<Outlet>`, the pure `filterCards` function, and the `within()` test scoping fix — all represent patterns worth codifying for future tasks.

The primary process insight is phase granularity: a phase that creates 10+ new files should be split before the build session starts, not after context is exhausted. The interruption-recovery mechanism worked correctly, but the interruption was avoidable. The creative phase's Q4 decision (BoardHeader into BoardView) is the standout decision of this task — it is the kind of architecture choice that looks obvious in retrospect but required the creative exploration phase to surface.

**Overall Task Success**: Success

**Overall Workflow Effectiveness**: Moderately Effective (build phase granularity needs attention for larger phases)

**Recommendation**: Ready to archive
