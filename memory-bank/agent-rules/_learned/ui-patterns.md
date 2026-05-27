---
name: "Learned: UI Patterns — ARIA Groups + Test Isolation"
globs: ["src/components/**/*.tsx", "frontend/src/components/**/*.tsx", "*.test.tsx"]
topics: ["ui-patterns", "accessibility", "testing-patterns", "aria", "react"]
priority: low
evidence_count: 2
last_updated: 2026-05-28
auto_generated: true
---

# UI Patterns — ARIA Groups + Test Isolation

- Use `within(container)` to scope RTL queries to a specific ARIA group when the same text or role appears in both a filter panel and a content area (e.g., label chip text in both a FilterChip button and a CardTile) — also drives you to add correct `role="group"` + `aria-label` on interactive groups for accessibility.
- Implement ARIA attributes (aria-expanded, aria-controls, aria-checked, aria-invalid, aria-live) in the same phase that implements the interactive component — do not defer to a separate accessibility-audit phase.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `getByRole('button', { name: /bug/i })` matched FilterChip in filter panel AND CardTile label chip — fixed by adding `role="group"` + `aria-label="Filter options"` to filter panel and scoping with `within(filterPanel)` | [reflection-TASK-004.md](../reflection/reflection-TASK-004.md) | 2026-05-19 |
| LabelPickerSection Phase 3 omitted aria attribute tests; Phase 4 added 7 aria tests (aria-expanded, aria-controls, panel id/label, aria-checked, aria-invalid, aria-live) that belonged in Phase 3 — co-location rule now explicit | [reflection-TASK-006.md](../reflection/reflection-TASK-006.md) | 2026-05-28 |
