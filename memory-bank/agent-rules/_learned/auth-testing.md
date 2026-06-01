---
name: "Learned: Auth Testing — Session Seeding + Hook Mutation Patterns"
globs: ["frontend/src/__tests__/*.test.tsx", "frontend/src/__tests__/*.test.ts", "frontend/src/router/*.ts", "frontend/src/router/*.tsx"]
topics: ["auth-testing", "testing-patterns", "react-router", "localStorage", "react-hooks"]
priority: low
evidence_count: 1
last_updated: 2026-06-01
auto_generated: true
---

# Auth Testing — Session Seeding + Hook Mutation Patterns

- When router tests share an app-wide auth guard, seed a valid session into localStorage in `beforeEach` (or use a dedicated `withSession()` test wrapper) — failing to do so breaks all protected-route tests whenever a new guard wraps a route.
- Use `renderHook` + `act()` for custom hook mutations that update React state — calling `result.current.setUser()` outside `act()` produces act() warnings and may miss state updates in assertions.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `routes.test.tsx` broke in Phase 3 when `RequireAuth` was added to the AppShell root — tests navigating to board routes without a seeded session started redirecting to `/login`; fix required seeding localStorage or asserting the redirect | [reflection-TASK-008.md](../reflection/reflection-TASK-008.md) | 2026-06-01 |
