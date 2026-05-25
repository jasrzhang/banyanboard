---
name: "Learned: SSE — Testing and Fan-Out Patterns"
globs: ["backend/src/__tests__/*.test.ts", "*.test.ts", "src/controllers/*.ts", "src/events/*.ts"]
topics: ["sse", "server-sent-events", "testing-patterns", "event-emitter", "realtime"]
priority: low
evidence_count: 2
last_updated: 2026-05-25
auto_generated: true
---

# SSE — Testing and Fan-Out Patterns

- In SSE integration tests, call `res.end()` or equivalent on all open response objects in `afterAll` — otherwise the test runner hangs waiting for the connection to close.
- For in-process SSE fan-out, call `setMaxListeners(0)` on the `EventEmitter` in the constructor to prevent MaxListenersExceededWarning when many SSE clients connect concurrently.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `closeAllConnections()` in `afterAll` was required in activitySSE.test.ts — without it the Vitest runner hung after Phase 2 tests completed | [reflection-TASK-005.md](../reflection/reflection-TASK-005.md) | 2026-05-25 |
| `setMaxListeners(0)` applied in `ActivityEventEmitter` constructor — anticipated in architecture creative and correctly implemented to prevent runtime warning under multi-client load | [reflection-TASK-005.md](../reflection/reflection-TASK-005.md) | 2026-05-25 |
