---
name: "Learned: Error Handling — Graceful Shutdown Guard"
globs: ["src/index.ts", "src/config/db.ts", "*.ts"]
topics: ["error-handling", "process-management", "shutdown"]
priority: low
evidence_count: 1
last_updated: 2026-05-16
auto_generated: true
---

# Error Handling — Graceful Shutdown Guard

- Use a boolean double-shutdown guard on graceful shutdown handlers to prevent duplicate pool/server close calls on concurrent SIGTERM + SIGINT signals.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Without the guard, concurrent SIGTERM + SIGINT in index.ts would call server.close() and pool.end() twice, potentially hanging the process | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
