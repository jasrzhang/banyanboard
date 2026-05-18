---
name: "Learned: Toolchain Setup — Vite + Vitest + npm Workspace"
globs: ["frontend/vitest.config.*", "frontend/tsconfig*.json", "frontend/.npmrc", "frontend/package.json"]
topics: ["toolchain-setup", "vitest", "typescript", "frontend", "npm"]
priority: low
evidence_count: 1
last_updated: 2026-05-18
auto_generated: true
---

# Toolchain Setup — Vite + Vitest + npm Workspace

- When using Vitest 2 globals, set BOTH `globals: true` in `vitest.config.ts` AND `"types": ["vitest/globals"]` in `tsconfig.json` — either alone is insufficient and will produce `expect is not defined` errors.
- Add `.npmrc` with `workspaces=false` to any `frontend/` subdirectory to prevent npm from auto-detecting the root `package.json` as a workspace root and injecting a spurious self-referential dependency.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Vitest globals: both vitest.config.ts `globals: true` and tsconfig `"types": ["vitest/globals"]` required | [reflection-TASK-002.md](../reflection/reflection-TASK-002.md) | 2026-05-18 |
| npm workspace auto-detection in subdirectory: fixed by `.npmrc workspaces=false` | [reflection-TASK-002.md](../reflection/reflection-TASK-002.md) | 2026-05-18 |
