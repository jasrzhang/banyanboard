---
name: "Learned: Error Handling — Graceful Shutdown + Mutation Error Filtering"
globs: ["src/index.ts", "src/config/db.ts", "*.ts", "frontend/src/hooks/*.ts", "frontend/src/hooks/*.tsx"]
topics: ["error-handling", "process-management", "shutdown", "abort-error", "mutations"]
priority: low
evidence_count: 2
last_updated: 2026-05-19
auto_generated: true
---

# Error Handling — Graceful Shutdown + Mutation Error Filtering

- Use a boolean double-shutdown guard on graceful shutdown handlers to prevent duplicate pool/server close calls on concurrent SIGTERM + SIGINT signals.
- Filter `AbortError` explicitly in mutation `onError` handlers (`!(err instanceof DOMException && err.name === 'AbortError')`) when an `AbortController` cancel-previous pattern is in use, to prevent spurious error toasts from user-initiated cancellations.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Without the guard, concurrent SIGTERM + SIGINT in index.ts would call server.close() and pool.end() twice, potentially hanging the process | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
| `useMoveCard.onError` without AbortError filter showed spurious toast.error when users initiated a new drag (cancelling the previous AbortController) | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
