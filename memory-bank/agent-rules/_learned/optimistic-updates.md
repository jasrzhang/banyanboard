---
name: "Learned: Optimistic Updates — Pure Function Extraction"
globs: ["frontend/src/hooks/*.ts", "frontend/src/hooks/*.tsx", "src/hooks/*.ts", "src/hooks/*.tsx"]
topics: ["optimistic-updates", "react", "tanstack-query", "testing-patterns", "frontend"]
priority: low
evidence_count: 2
last_updated: 2026-05-28
auto_generated: true
---

# Optimistic Updates — Pure Function Extraction

- Extract optimistic state transformation logic as pure exported functions (e.g., `applyMoveOptimistic`, `replaceCard`) alongside the mutation hook so each can be unit-tested in isolation without rendering components.
- For replace-all mutation semantics (full-set swap, not individual-item toggle), use a single snapshot/rollback/invalidate TanStack Query mutation rather than per-item mutations — eliminates parallel-request race conditions and aligns with last-write-wins user intent.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `applyMoveOptimistic`, `applyCreateOptimistic`, `replaceCard` extracted as pure functions enabled fast, focused unit tests without React rendering overhead — all 3 caught correctness bugs before integration | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
| `useReplaceCardLabels` used replace-all semantics (PUT with full labelIds array) rather than per-label toggle mutations — single snapshot/rollback/invalidate eliminated race conditions; hook is a near-clone of `useUpdateCard` | [reflection-TASK-006.md](../reflection/reflection-TASK-006.md) | 2026-05-28 |
