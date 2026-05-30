# Learning Log

Chronological record of pattern extraction and consolidation events from task reflections.

---

## 2026-05-16 - TASK-001 Reflection

### Extracted Patterns
- **architecture** → created `agent-rules/_learned/architecture.md` (evidence count: 1) — Interface-first design for cross-cutting concerns
- **testing-patterns** → created `agent-rules/_learned/testing-patterns.md` (evidence count: 1) — Dual-layer enforcement (ESLint + structural test)
- **error-handling** → created `agent-rules/_learned/error-handling.md` (evidence count: 1) — Boolean double-shutdown guard
- **observability** → created `agent-rules/_learned/observability.md` (evidence count: 1) — Synchronous Writable stream for deterministic logger tests

### systemPatterns.md Updates
- None (patterns already captured in design docs during Phase 5; structural test pattern is a novel code-level practice, not an architecture pattern)

---

## 2026-05-18 - TASK-002 Reflection

### Extracted Patterns
- **toolchain-setup** → created `agent-rules/_learned/toolchain-setup.md` (evidence count: 1) — Vitest globals dual-config + npm `.npmrc workspaces=false`
- **testing-patterns** → amended `agent-rules/_learned/testing-patterns.md` (evidence count: 2) — Zustand `beforeEach` reset for state isolation
- **state-architecture** → created `agent-rules/_learned/state-architecture.md` (evidence count: 1) — Three-layer state split contract (TanStack Query / Zustand / URL params)

### systemPatterns.md Updates
- None (state-layer split is a frontend-specific architectural contract; recommended for `systemPatterns.md` Frontend section — deferred per reflection recommendation)

---

## 2026-05-18 - Consolidation (during TASK-002 archive)

- Files before: 6, Files after: 6
- Merged: 0 files
- Expired: 0 bullets (0 files deleted)
- Promoted: 0 files to medium priority
- Pruned: 0 excess bullets

---

## 2026-05-19 - TASK-003 Reflection

### Extracted Patterns
- **optimistic-updates** → created `agent-rules/_learned/optimistic-updates.md` (evidence count: 1) — Pure function extraction alongside mutation hooks for isolated unit testing
- **data-access** → created `agent-rules/_learned/data-access.md` (evidence count: 1) — Atomic single-statement INSERT subquery for auto-assigned positions
- **error-handling** → amended `agent-rules/_learned/error-handling.md` (evidence count: 2) — AbortError filtering in mutation onError handlers with cancel-previous pattern
- **architecture** → amended `agent-rules/_learned/architecture.md` (evidence count: 2) — Utility extraction: isolate pure computation functions in `utils/` module with unit tests

### systemPatterns.md Updates
- None (patterns are coding practices, not system-level architecture patterns)

---

## 2026-05-19 - Consolidation (during TASK-003 archive)

- Files before: 8, Files after: 8
- Merged: 0 files
- Expired: 0 bullets (0 files deleted)
- Promoted: 0 files to medium priority
- Pruned: 0 excess bullets

---

## 2026-05-19 - TASK-004 Reflection

### Extracted Patterns
- **ui-patterns** → created `agent-rules/_learned/ui-patterns.md` (evidence count: 1) — Use `within(container)` for RTL query scoping to ARIA groups
- **testing-patterns** → amended `agent-rules/_learned/testing-patterns.md` (evidence count: 3) — Route-rendered modal test harness: MemoryRouter + Routes + Route + outlet shell
- **state-architecture** → amended `agent-rules/_learned/state-architecture.md` (evidence count: 2) — Component-scoped `useState` preferred over Zustand for board-scoped transient UI state
- **architecture** → amended `agent-rules/_learned/architecture.md` (evidence count: 3) — Discriminated union for mutually exclusive filter modes vs `Set<string>`

### systemPatterns.md Updates
- None (patterns are frontend-specific coding practices, not system-level architecture patterns)

---

## 2026-05-19 - Consolidation (during TASK-004 archive)

- Files before: 9, Files after: 9
- Merged: 0 files
- Expired: 0 bullets (0 files deleted)
- Promoted: 2 files to medium priority (architecture.md, testing-patterns.md — both reached evidence_count 3)
- Pruned: 0 excess bullets

---

## 2026-05-25 - TASK-005 Reflection

### Extracted Patterns
- **sse** → created `agent-rules/_learned/sse.md` (evidence count: 2) — SSE test runner hang prevention + setMaxListeners(0) for fan-out
- **architecture** → amended `agent-rules/_learned/architecture.md` (evidence count: 5) — Module-level singleton export pattern + event hooks belong in service layer

### systemPatterns.md Updates
- None (SSE patterns are coding practices; singleton pattern is an extension of the existing `pool` precedent already documented; event-hook placement is technical debt, not a positive pattern to codify)

---

## 2026-05-25 - Consolidation (during TASK-005 archive)

- Files before: 10, Files after: 10
- Merged: 0 files (no >50% topic overlap found)
- Expired: 0 bullets (all learnings from 2026-05-16 to 2026-05-25, well within 90-day window)
- Promoted: 0 files (sse.md at ec:2, below threshold of 3; architecture.md already at medium)
- Pruned: 0 excess bullets (max file has 5 bullets, below 15-bullet limit)

---

## 2026-05-28 - Consolidation (during TASK-006 archive)

- Files before: 10, Files after: 10
- Merged: 0 files (no >50% topic overlap found)
- Expired: 0 bullets (all learnings 2026-05-16 to 2026-05-28, well within 90-day window)
- Promoted: 0 files (architecture.md ec:6 and testing-patterns.md ec:4 already at medium; others below threshold of 3)
- Pruned: 0 excess bullets (max file has 6 bullets, below 15-bullet limit)

---

## 2026-05-28 - TASK-006 Reflection

### Extracted Patterns
- **ui-patterns** → amended `agent-rules/_learned/ui-patterns.md` (evidence count: 2) — Implement ARIA attributes in the same phase as the interactive component; do not defer to a separate audit phase
- **testing-patterns** → amended `agent-rules/_learned/testing-patterns.md` (evidence count: 4) — Popover/disclosure components require aria-expanded, aria-controls, aria-checked/aria-pressed tests at the component level
- **architecture** → amended `agent-rules/_learned/architecture.md` (evidence count: 6) — Export new resource controller from its own route module and import in existing route module to keep service singleton single-sourced
- **optimistic-updates** → amended `agent-rules/_learned/optimistic-updates.md` (evidence count: 2) — Replace-all mutation semantics (single snapshot/rollback/invalidate) for full-set swap surfaces

### systemPatterns.md Updates
- None (patterns are component-level coding practices, not system-level architecture patterns)

---

## 2026-05-30 - TASK-007 Reflection

### Extracted Patterns
- **testing-patterns** → amended `agent-rules/_learned/testing-patterns.md` (evidence count: 6) — Disambiguate validation error text vs `<select>` placeholder using `{ selector: 'span' }` / `getByDisplayValue()`
- **testing-patterns** → amended `agent-rules/_learned/testing-patterns.md` (evidence count: 6) — Test mutually exclusive panels as a round-trip state invariant (open A→assert B absent, open B→assert A absent)
- **architecture** → amended `agent-rules/_learned/architecture.md` (evidence count: 7) — Delegate resource position calculation to the resource's own repository; never reimplement MAX+gap inline in service-layer move methods
- **ui-patterns** → amended `agent-rules/_learned/ui-patterns.md` (evidence count: 3) — Add `deleteEmpty()` to API client for DELETE endpoints returning 204 No Content; calling `.json()` on 204 throws

### systemPatterns.md Updates
- None (patterns are coding-level practices, not novel system-level architectural boundaries)
