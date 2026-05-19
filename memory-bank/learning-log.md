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
