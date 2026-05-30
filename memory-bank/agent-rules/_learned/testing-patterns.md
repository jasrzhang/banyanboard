---
name: "Learned: Testing Patterns — Layering Enforcement + State Isolation"
globs: ["src/__tests__/*.ts", "*.test.ts", "*.test.tsx", "eslint.config.*", "src/store/*.test.*"]
topics: ["testing-patterns", "architecture", "eslint", "layering", "zustand", "react-router"]
priority: medium
evidence_count: 6
last_updated: 2026-05-30
auto_generated: true
---

# Testing Patterns — Layering Enforcement + State Isolation

- Use ESLint `no-restricted-imports` as primary layering enforcement and a Vitest structural test with `readdirSync` + regex as a safety net for template-literal SQL that lint cannot catch.
- Reset Zustand store state in `beforeEach` using `useAppStore.setState(initialState)` (partial merge) to prevent state leak between test cases; do not rely on module re-import for isolation.
- For route-rendered components (e.g., modals at nested routes), wrap the test subject in `MemoryRouter` + `Routes` + `Route` + an outlet-bearing shell component so React Router context is present and `useParams`/`useNavigate` resolve correctly without navigation side-effects.
- When testing a popover or disclosure component, assert `aria-expanded` state on the trigger, `aria-controls` pointing to the panel id, and `aria-checked`/`aria-pressed` on each interactive item — these attributes are the accessibility contract and must be tested at the component level, not deferred to an audit phase.
- When validation error text matches a `<select>` placeholder option text, use `getByText(..., { selector: 'span' })` or `getByDisplayValue()` to target the error span specifically — `getByText` fails with "Found multiple elements" when the same string appears in both an error span and an option element.
- Test mutually exclusive panel state as an invariant, not just a render check: after opening panel A, assert that panel B is absent from the DOM, then open panel B and assert panel A is absent — verifies the mutual exclusion logic, not just that one panel renders.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| ESLint catches import violations at lint time; structural test in layering.test.ts catches raw SQL strings that escape import rules | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
| Zustand `beforeEach` reset: `setState(initialState)` resets data while preserving action functions — module re-import is insufficient isolation | [reflection-TASK-002.md](../reflection/reflection-TASK-002.md) | 2026-05-18 |
| Route-rendered modal (`CardDetailModal`) required MemoryRouter + Routes + Route + outlet shell in cardDetail.test.tsx — bespoke scaffolding that future route-modal tests will need | [reflection-TASK-004.md](../reflection/reflection-TASK-004.md) | 2026-05-19 |
| LabelPickerSection popover required 7 separate aria attribute tests (trigger aria-expanded/aria-controls, panel id/label, chip aria-checked, input aria-invalid, preview aria-live) — these are the accessibility contract and belong in the component's own test file | [reflection-TASK-006.md](../reflection/reflection-TASK-006.md) | 2026-05-28 |
| AutomationRuleForm Phase 3: "Select a column to watch" error text matched both `<option>` placeholder and `<span>` error — fixed with `{ selector: 'span' }` / `getByDisplayValue()` | [reflection-TASK-007.md](../reflection/reflection-TASK-007.md) | 2026-05-30 |
| Automations+Activity mutual exclusion verified via round-trip: open A→assert B absent, then open B→assert A absent — state invariant test, not just render test | [reflection-TASK-007.md](../reflection/reflection-TASK-007.md) | 2026-05-30 |
