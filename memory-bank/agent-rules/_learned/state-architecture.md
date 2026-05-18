---
name: "Learned: State Architecture — Three-Layer Split Contract"
globs: ["src/store/*.ts", "src/store/*.tsx", "src/api/*.ts", "frontend/src/**/*.ts", "frontend/src/**/*.tsx"]
topics: ["state-architecture", "react", "zustand", "tanstack-query", "frontend"]
priority: low
evidence_count: 1
last_updated: 2026-05-18
auto_generated: true
---

# State Architecture — Three-Layer Split Contract

- Divide React application state into three non-overlapping layers: TanStack Query for server-fetched data, Zustand for client-only UI state, and URL params for deep-linkable state — document the contract explicitly so future features don't duplicate server state into the Zustand store.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| CE-4b state-layer split: TanStack Query / Zustand / URL params / useState — each layer has a distinct, non-overlapping responsibility | [reflection-TASK-002.md](../reflection/reflection-TASK-002.md) | 2026-05-18 |
