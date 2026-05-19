---
name: "Learned: Architecture — Interface-First Design + Utility Extraction"
globs: ["src/types/*.ts", "src/config/*.ts", "*.ts", "frontend/src/**/*.ts", "frontend/src/**/*.tsx"]
topics: ["architecture", "typescript", "interface-design", "utility-extraction", "frontend"]
priority: low
evidence_count: 2
last_updated: 2026-05-19
auto_generated: true
---

# Architecture — Interface-First Design + Utility Extraction

- Define cross-cutting concerns as interfaces first in `types/`, bind concrete implementations in `config/`, so all call sites import only the interface.
- Isolate pure computation functions (position math, date formatting, array transformations) that emerge from component implementations into a dedicated `utils/` module with unit tests for all cases; do not embed computation logic inside React components.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Logger interface in types/logger.ts decoupled from pino impl in config/logger.ts — all middleware imports only the interface, making OTel migration mechanical | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
| `computeNewPosition` helper embedded in `BoardView.tsx` had no unit tests; extracting to `positionUtils.ts` would allow isolated testing of insert-at-start/end/between edge cases | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
