---
name: "Learned: UI Patterns — ARIA Groups + Test Isolation"
globs: ["src/components/**/*.tsx", "frontend/src/components/**/*.tsx", "*.test.tsx"]
topics: ["ui-patterns", "accessibility", "testing-patterns", "aria", "react"]
priority: low
evidence_count: 1
last_updated: 2026-05-19
auto_generated: true
---

# UI Patterns — ARIA Groups + Test Isolation

- Use `within(container)` to scope RTL queries to a specific ARIA group when the same text or role appears in both a filter panel and a content area (e.g., label chip text in both a FilterChip button and a CardTile) — also drives you to add correct `role="group"` + `aria-label` on interactive groups for accessibility.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| `getByRole('button', { name: /bug/i })` matched FilterChip in filter panel AND CardTile label chip — fixed by adding `role="group"` + `aria-label="Filter options"` to filter panel and scoping with `within(filterPanel)` | [reflection-TASK-004.md](../reflection/reflection-TASK-004.md) | 2026-05-19 |
