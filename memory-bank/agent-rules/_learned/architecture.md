---
name: "Learned: Architecture — Interface-First Design"
globs: ["src/types/*.ts", "src/config/*.ts", "*.ts"]
topics: ["architecture", "typescript", "interface-design"]
priority: low
evidence_count: 1
last_updated: 2026-05-16
auto_generated: true
---

# Architecture — Interface-First Design

- Define cross-cutting concerns as interfaces first in `types/`, bind concrete implementations in `config/`, so all call sites import only the interface.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Logger interface in types/logger.ts decoupled from pino impl in config/logger.ts — all middleware imports only the interface, making OTel migration mechanical | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
