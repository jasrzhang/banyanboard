---
name: "Learned: Optimistic Updates — Pure Function Extraction"
globs: ["frontend/src/hooks/*.ts", "frontend/src/hooks/*.tsx", "src/hooks/*.ts", "src/hooks/*.tsx"]
topics: ["optimistic-updates", "react", "tanstack-query", "testing-patterns", "frontend"]
priority: low
evidence_count: 1
last_updated: 2026-05-19
auto_generated: true
---

# Optimistic Updates — Pure Function Extraction

- Extract optimistic state transformation logic as pure exported functions (e.g., `applyMoveOptimistic`, `replaceCard`) alongside the mutation hook so each can be unit-tested in isolation without rendering components.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `applyMoveOptimistic`, `applyCreateOptimistic`, `replaceCard` extracted as pure functions enabled fast, focused unit tests without React rendering overhead — all 3 caught correctness bugs before integration | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
