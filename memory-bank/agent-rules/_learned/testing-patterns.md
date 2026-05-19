---
name: "Learned: Testing Patterns — Layering Enforcement + State Isolation"
globs: ["src/__tests__/*.ts", "*.test.ts", "*.test.tsx", "eslint.config.*", "src/store/*.test.*"]
topics: ["testing-patterns", "architecture", "eslint", "layering", "zustand", "react-router"]
priority: medium
evidence_count: 3
last_updated: 2026-05-19
auto_generated: true
---

# Testing Patterns — Layering Enforcement + State Isolation

- Use ESLint `no-restricted-imports` as primary layering enforcement and a Vitest structural test with `readdirSync` + regex as a safety net for template-literal SQL that lint cannot catch.
- Reset Zustand store state in `beforeEach` using `useAppStore.setState(initialState)` (partial merge) to prevent state leak between test cases; do not rely on module re-import for isolation.
- For route-rendered components (e.g., modals at nested routes), wrap the test subject in `MemoryRouter` + `Routes` + `Route` + an outlet-bearing shell component so React Router context is present and `useParams`/`useNavigate` resolve correctly without navigation side-effects.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| ESLint catches import violations at lint time; structural test in layering.test.ts catches raw SQL strings that escape import rules | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
| Zustand `beforeEach` reset: `setState(initialState)` resets data while preserving action functions — module re-import is insufficient isolation | [reflection-TASK-002.md](../reflection/reflection-TASK-002.md) | 2026-05-18 |
| Route-rendered modal (`CardDetailModal`) required MemoryRouter + Routes + Route + outlet shell in cardDetail.test.tsx — bespoke scaffolding that future route-modal tests will need | [reflection-TASK-004.md](../reflection/reflection-TASK-004.md) | 2026-05-19 |
