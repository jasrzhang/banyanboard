---
name: "Learned: Data Access — Atomic Position Assignment"
globs: ["backend/src/repositories/*.ts", "src/repositories/*.ts"]
topics: ["data-access", "postgresql", "repositories", "race-conditions"]
priority: low
evidence_count: 1
last_updated: 2026-05-19
auto_generated: true
---

# Data Access — Atomic Position Assignment

- Assign auto-increment positions with a single-statement INSERT subquery (`INSERT ... VALUES (..., COALESCE((SELECT MAX(position) FROM t WHERE col = $x), 0) + $gap)`) rather than two separate SELECT + INSERT round-trips, to eliminate the theoretical race condition under concurrent writes.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `CardRepository.create` used SELECT max position then INSERT in two round-trips — creates a race condition window for concurrent inserts into the same column; single-statement subquery is the correct pattern | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
