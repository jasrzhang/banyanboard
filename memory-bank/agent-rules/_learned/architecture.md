---
name: "Learned: Architecture — Interface-First Design + Utility Extraction + Singleton + Event Hooks"
globs: ["src/types/*.ts", "src/config/*.ts", "src/events/*.ts", "*.ts", "frontend/src/**/*.ts", "frontend/src/**/*.tsx"]
topics: ["architecture", "typescript", "interface-design", "utility-extraction", "frontend", "singleton", "event-hooks"]
priority: medium
evidence_count: 7
last_updated: 2026-05-30
auto_generated: true
---

# Architecture — Interface-First Design + Utility Extraction + Singleton + Event Hooks

- Define cross-cutting concerns as interfaces first in `types/`, bind concrete implementations in `config/`, so all call sites import only the interface.
- Isolate pure computation functions (position math, date formatting, array transformations) that emerge from component implementations into a dedicated `utils/` module with unit tests for all cases; do not embed computation logic inside React components.
- When filter logic has mutually exclusive modes, represent them as a discriminated string union (`'none' | 'overdue' | 'due-soon'`) rather than a `Set<string>` entry — the union enforces mutual exclusivity in the type system and reduces toggle logic to a single equality check.
- Export shared singletons (emitters, pools, clients) as module-level `const` exports from a dedicated module file — this is simpler than parameterizing `createApp()` and avoids introducing a DI container for a single shared object.
- Place event emission hooks (activity, audit, side-effects) in service methods rather than controllers so hooks are testable without Express context and survive transport-layer changes.
- When a new resource's assignment endpoint belongs under an existing resource route (e.g., PUT /cards/:cardId/labels wired in cardsRouter), export the new controller as a named export from the new resource's route module and import it in the existing route module — keeps the service singleton single-sourced without modifying the existing module's DI wiring.
- Delegate position calculation (append at MAX+gap, insert between) to the resource's own repository — never reimplement MAX+gap inline in a service that calls `move` or `reorder`, as duplicated position logic diverges across tasks.

## Evidence

| Learning | Source | Date |
|----------|--------|------|
| Logger interface in types/logger.ts decoupled from pino impl in config/logger.ts — all middleware imports only the interface, making OTel migration mechanical | [reflection-TASK-001.md](../reflection/reflection-TASK-001.md) | 2026-05-16 |
| `computeNewPosition` helper embedded in `BoardView.tsx` had no unit tests; extracting to `positionUtils.ts` would allow isolated testing of insert-at-start/end/between edge cases | [reflection-TASK-003.md](../reflection/reflection-TASK-003.md) | 2026-05-19 |
| `activeDateFilter` as `'none' \| 'overdue' \| 'due-soon'` union encodes mutual exclusivity at the type level — no runtime guard needed; toggle is a simple string comparison | [reflection-TASK-004.md](../reflection/reflection-TASK-004.md) | 2026-05-19 |
| `activityEmitter` exported as module-level `const` from `src/events/ActivityEventEmitter.ts` (mirroring the `pool` pattern from `config/db.ts`) — zero change to `createApp()` signature | [reflection-TASK-005.md](../reflection/reflection-TASK-005.md) | 2026-05-25 |
| Event hooks placed in `ColumnController`/`CardController` rather than service layer — created a layering concern; service-layer placement is more testable and transport-agnostic | [reflection-TASK-005.md](../reflection/reflection-TASK-005.md) | 2026-05-25 |
| `cardLabelController` exported from `routes/labels.ts` and imported in `routes/cards.ts` (same pattern as `activityService`) — the new controller is a named export from the new resource's route module, keeping `LabelService` singleton single-sourced | [reflection-TASK-006.md](../reflection/reflection-TASK-006.md) | 2026-05-28 |
| `moveCardToColumn` in AutomationService initially appended at position 1 (bug). Correct pattern: read MAX position from repository, append at MAX+1000 — duplicate of TASK-003 insight; confirmed the rule applies to service-layer moves, not just controller-level moves | [reflection-TASK-007.md](../reflection/reflection-TASK-007.md) | 2026-05-30 |
