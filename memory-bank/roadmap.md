# Product Roadmap

## Summary
- **Total Features**: 4
- **Complete Features**: 3 (FEAT-001, FEAT-002, FEAT-003)
- **Released Versions**: 0
- **Active Versions**: 0
- **Planning Versions**: 2

---

## Versions

### v0.1.0 — Foundation (Planning)
- **Status**: planning
- **Target Date**: TBD
- **Description**: Establishes the complete project skeleton — TypeScript/Express API, Docker Compose with PostgreSQL, health check endpoint with tests, and layered project structure. Every subsequent feature builds on this version.
- **Features**:
  - FEAT-001: Project Foundation [Level 4]

---

### v0.2.0 — Frontend Application (Planning)
- **Status**: planning
- **Target Date**: TBD
- **Description**: Delivers the complete BanyanBoard React frontend — app shell, full Kanban board UI with drag-and-drop, and card detail/search/filter interactions. Integrates with the v0.1.0 Express API.
- **Features**:
  - FEAT-002: Frontend Foundation [Level 3]
  - FEAT-003: Kanban Board UI [Level 4]
  - FEAT-004: Card Detail Modal + Search/Filter [Level 3]

---

### next (Backlog)
- **Status**: planning
- **Features**: None

---

## Features

### FEAT-001: Project Foundation
- **Version**: v0.1.0
- **Status**: complete
- **Priority**: high
- **Complexity**: Level 4
- **Description**: Set up the complete project skeleton for BanyanBoard. Includes: Express API with TypeScript (strict mode), Docker Compose service for PostgreSQL, health check endpoint (`GET /health`) with integration tests, and a clean layered project structure (controllers → services → repositories). This is the foundation every future feature depends on.
- **Linked Tasks**: TASK-001 (complete)
- **Branch**: feature/FEAT-001-project-foundation (merged 2026-05-16)
- **Created**: 2026-05-16
- **Completed**: 2026-05-16

---

### FEAT-002: Frontend Foundation
- **Version**: v0.2.0
- **Status**: complete
- **Priority**: high
- **Complexity**: Level 3
- **Description**: Scaffold the React + TypeScript + Vite + TailwindCSS frontend project. Deliver the app shell — left sidebar (board navigation), board header (title + "New Card" button placeholder), main content area with routing. Includes type-safe API client layer stub, TanStack Query setup, and Zustand/Context global state wiring. No board data yet — layout and navigation only.
- **Linked Tasks**: TASK-002 (complete)
- **Branch**: feature/FEAT-002-frontend-foundation (merged 2026-05-18)
- **Created**: 2026-05-16
- **Completed**: 2026-05-18

---

### FEAT-003: Kanban Board UI
- **Version**: v0.2.0
- **Status**: complete
- **Priority**: high
- **Complexity**: Level 4
- **Description**: Full Kanban board rendering: fetch and display columns with card tiles (title, description preview, due date, labels), drag-and-drop between columns using dnd-kit with optimistic UI updates via TanStack Query mutations, column card-count badge, add-card affordance per column, and sticky column headers. Integrates with the board/column/card REST API from v0.1.0 backend.
- **Linked Tasks**: TASK-003 (complete)
- **Branch**: feature/FEAT-003-kanban-board-ui (merged 2026-05-19)
- **Created**: 2026-05-16
- **Completed**: 2026-05-19

---

### FEAT-004: Card Detail Modal + Search/Filter
- **Version**: v0.2.0
- **Status**: planned
- **Priority**: medium
- **Complexity**: Level 3
- **Description**: Card detail modal (click card → modal with full title, description, due date, labels; inline edit and save). Board-level search bar (filter cards by title text). Label and due-date filter chips in the board header. All filters applied client-side against TanStack Query cache.
- **Linked Tasks**: None
- **Branch**: feature/FEAT-004-card-detail-search-filter
- **Created**: 2026-05-16
