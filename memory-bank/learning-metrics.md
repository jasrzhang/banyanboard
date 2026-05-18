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

## Rule Effectiveness

| File | Topics | Evidence Count | Priority | Last Updated |
|------|--------|---------------:|:--------:|:------------:|
| architecture.md | architecture, typescript | 1 | low | 2026-05-16 |
| testing-patterns.md | testing-patterns, eslint, zustand | 2 | low | 2026-05-18 |
| error-handling.md | error-handling, shutdown | 1 | low | 2026-05-16 |
| observability.md | observability, logging | 1 | low | 2026-05-16 |
| toolchain-setup.md | toolchain-setup, vitest, npm, frontend | 1 | low | 2026-05-18 |
| state-architecture.md | state-architecture, react, zustand | 1 | low | 2026-05-18 |

## Consolidation History

| Date | Rules Before | Rules After | Merged | Expired | Promoted |
|------|------------:|------------:|-------:|--------:|---------:|
| 2026-05-18 | 6 | 6 | 0 | 0 | 0 |
