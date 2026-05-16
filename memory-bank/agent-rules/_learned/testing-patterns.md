---
name: "Learned: Testing Patterns — Layering Enforcement"
globs: ["src/__tests__/*.ts", "*.test.ts", "eslint.config.*"]
topics: ["testing-patterns", "architecture", "eslint", "layering"]
priority: low
evidence_count: 1
last_updated: 2026-05-16
auto_generated: true
---

# Testing Patterns — Layering Enforcement

- Use ESLint `no-restricted-imports` as primary layering enforcement and a Vitest structural test with `readdirSync` + regex as a safety net for template-literal SQL that lint cannot catch.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| ESLint catches import violations at lint time; structural test in layering.test.ts catches raw SQL strings that escape import rules | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
