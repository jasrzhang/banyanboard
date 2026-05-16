---
name: "Learned: Observability — Synchronous Logger Streams in Tests"
globs: ["src/config/logger.ts", "src/__tests__/*.ts", "*.test.ts"]
topics: ["observability", "testing-patterns", "logging", "pino"]
priority: low
evidence_count: 1
last_updated: 2026-05-16
auto_generated: true
---

# Observability — Synchronous Logger Streams in Tests

- In tests, configure pino with a synchronous `Writable` stream rather than the async pino-pretty transport — async transport writes to a worker thread, making output non-deterministic in assertions.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| logger.test.ts uses `new Writable({ write(chunk, _enc, cb) {...} })` injected into createLogger — assertions on emitted lines are deterministic because writes are synchronous | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
