---
name: "Learned: Data Access — Atomic Position Assignment + Idempotent Upserts"
globs: ["backend/src/repositories/*.ts", "src/repositories/*.ts"]
topics: ["data-access", "postgresql", "repositories", "race-conditions", "upserts"]
priority: low
evidence_count: 2
last_updated: 2026-06-01
auto_generated: true
---

# Data Access — Atomic Position Assignment + Idempotent Upserts

- Assign auto-increment positions with a single-statement INSERT subquery (`INSERT ... VALUES (..., COALESCE((SELECT MAX(position) FROM t WHERE col = $x), 0) + $gap)`) rather than two separate SELECT + INSERT round-trips, to eliminate the theoretical race condition under concurrent writes.
- Use `INSERT ... ON CONFLICT (col) DO UPDATE SET col = EXCLUDED.col RETURNING *` for idempotent upserts — the no-op update forces PostgreSQL to return the existing row on conflict, avoiding a separate SELECT round-trip.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `CardRepository.create` used SELECT max position then INSERT in two round-trips — creates a race condition window for concurrent inserts into the same column; single-statement subquery is the correct pattern | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
| `UserRepository.findOrCreate` uses `ON CONFLICT (first_name) DO UPDATE SET first_name = EXCLUDED.first_name RETURNING id, first_name` — single round-trip, no separate SELECT, correct behavior on both first insert and repeated calls | [reflection-TASK-008.md](../reflection/reflection-TASK-008.md) | 2026-06-01 |
