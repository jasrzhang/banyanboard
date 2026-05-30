# Learning Metrics

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Max learned rule files | 10 | Hard cap on files in `agent-rules/_learned/` |
| Expiry period (days) | 90 | Remove unreinforced bullets after this period |
| Promotion threshold | 3 | Promote to `medium` priority at this evidence count |
| Max bullets per file | 15 | Prune to 10 most-evidenced when exceeded |

## Task History

| Task ID | Date | Learnings Extracted | Rules Amended | Rules Created |
|---------|------|--------------------:|-------------:|-------------:|
| TASK-001 | 2026-05-16 | 4 | 0 | 4 |
| TASK-002 | 2026-05-18 | 4 | 1 | 2 |
| TASK-003 | 2026-05-19 | 4 | 2 | 2 |
| TASK-004 | 2026-05-19 | 4 | 3 | 1 |
| TASK-005 | 2026-05-25 | 4 | 1 | 1 |
| TASK-006 | 2026-05-28 | 4 | 4 | 0 |
| TASK-007 | 2026-05-30 | 4 | 3 | 0 |

## Rule Effectiveness

| File | Topics | Evidence Count | Priority | Last Updated |
|------|--------|---------------:|:--------:|:------------:|
| architecture.md | architecture, typescript, utility-extraction, singleton, event-hooks | 7 | **medium** | 2026-05-30 |
| testing-patterns.md | testing-patterns, eslint, zustand, react-router | 6 | **medium** | 2026-05-30 |
| sse.md | sse, server-sent-events, testing-patterns, realtime | 2 | low | 2026-05-25 |
| error-handling.md | error-handling, shutdown, abort-error | 2 | low | 2026-05-19 |
| state-architecture.md | state-architecture, react, zustand | 2 | low | 2026-05-19 |
| optimistic-updates.md | optimistic-updates, tanstack-query, frontend | 2 | low | 2026-05-28 |
| ui-patterns.md | ui-patterns, accessibility, aria, react, api-client | 3 | low | 2026-05-30 |
| observability.md | observability, logging | 1 | low | 2026-05-16 |
| toolchain-setup.md | toolchain-setup, vitest, npm, frontend | 1 | low | 2026-05-18 |
| data-access.md | data-access, postgresql, repositories | 1 | low | 2026-05-19 |

## Consolidation History

| Date | Rules Before | Rules After | Merged | Expired | Promoted |
|------|------------:|------------:|-------:|--------:|---------:|
| 2026-05-18 | 6 | 6 | 0 | 0 | 0 |
| 2026-05-19 | 8 | 8 | 0 | 0 | 0 |
| 2026-05-19 | 9 | 9 | 0 | 0 | 2 |
| 2026-05-25 | 10 | 10 | 0 | 0 | 0 |
| 2026-05-28 | 10 | 10 | 0 | 0 | 0 |
| 2026-05-30 | 10 | 10 | 0 | 0 | 0 |
