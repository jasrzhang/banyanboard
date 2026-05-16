# System Architecture Patterns

This file documents the architectural patterns, design patterns, and system structure used in this project.

## Guiding Principles

| Principle | Description |
|-----------|-------------|
| Clean Architecture | Controllers → Services → Repositories. No business logic in route handlers. No database calls in controllers. |
| Simplicity over Cleverness | Prefer explicit, readable code. Avoid patterns that require explanation to understand. |
| No Premature Abstractions | Don't create a shared abstraction until there are 3+ concrete implementations. Three similar functions are better than one over-generalized helper. |
| 12-Factor Config | All environment-specific values (DB URL, port, JWT secret) via environment variables. No hardcoded config in source. |
| Optimistic UI | Card drag-and-drop updates the UI immediately, then confirms with the server. Rollback on error. |

## System Architecture

### High-Level Architecture

```
┌─────────────────────┐     HTTP/REST      ┌──────────────────────┐
│   React Frontend    │ ─────────────────▶ │  Express Backend     │
│   (TypeScript)      │ ◀───────────────── │  (TypeScript)        │
│   Vite dev server   │     JSON           │  Port 3001           │
└─────────────────────┘                    └──────────┬───────────┘
                                                      │ pg / SQL
                                                      ▼
                                           ┌──────────────────────┐
                                           │   PostgreSQL 15       │
                                           │   Port 5432           │
                                           └──────────────────────┘

All services orchestrated via Docker Compose for local development.
```

### Component Responsibilities

- **React Frontend**: Renders boards, columns, and cards. Handles drag-and-drop interactions. Calls REST API. No business logic beyond UI state.
- **Express Backend**: Routes → Controllers → Services → Repositories. Validates input, enforces auth, delegates to service layer.
- **Service Layer**: Business logic — e.g., column ordering, due date validation, label management.
- **Repository Layer**: SQL queries via `pg`. One repository per domain entity (BoardRepository, ColumnRepository, CardRepository).
- **PostgreSQL**: Source of truth for all boards, columns, cards, users, and labels.

### Data Flow Patterns

#### Card Move (Drag and Drop)

```
User drags card → React updates local state (optimistic) →
PATCH /api/cards/:id { columnId, position } →
Controller validates → CardService.moveCard() →
CardRepository.updatePosition() → DB →
200 OK → React confirms state
          (on error: React reverts to previous state)
```

#### Board Load

```
User opens board → GET /api/boards/:id →
Controller → BoardService.getBoardWithColumns() →
BoardRepository.findWithColumnsAndCards() →
JOIN query (boards + columns + cards) →
JSON response → React renders columns and cards
```

## Design Patterns Used

### Repository Pattern — Data Access

- **Problem**: Decouple business logic from SQL queries
- **Implementation**: One class per entity (BoardRepository, CardRepository, etc.) with typed methods
- **Trade-offs**: Slight boilerplate; prevents query logic from leaking into services

### Service Layer — Business Logic

- **Problem**: Route handlers becoming bloated with logic
- **Implementation**: Service classes called by controllers; no Express req/res in services
- **Trade-offs**: Extra indirection for simple CRUD; pays off as logic grows

## Integration Patterns

[To be documented as integrations are built — no external integrations in MVP]

## Testing Patterns

### Test Organization

- **Test location**: [To be defined]
- **File mapping**: [To be defined]
- **Naming convention**: [To be defined]

### Test Grouping

- **Within-file structure**: [To be defined]
- **Describe/context nesting**: [To be defined]
- **Setup sharing**: [To be defined]

### Test Framework & Style

- **Framework**: [To be defined]
- **Assertion style**: [To be defined]
- **Mocking approach**: [To be defined]

### Test Scope Preferences

- **Emphasis**: [To be defined]
- **Typical test-to-source ratio**: [To be defined]
- **What is NOT typically tested**: [To be defined]

<!-- AUTO-MANAGED: c4-architecture-start -->
## C4 Architecture

<!--
  This section is auto-managed by /banyan-c4. Run /banyan-c4 to populate or refresh.
  Until /banyan-c4 has been run for the first time, this section is a placeholder.
  Do not hand-edit between the AUTO-MANAGED markers — edits will be overwritten.
-->

C4 architecture documentation has not been generated for this project yet.

To populate this section, run `/banyan-c4`.

<!-- AUTO-MANAGED: c4-architecture-end -->
