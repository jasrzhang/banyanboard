# Product Roadmap

## Summary
- **Total Features**: 7
- **Complete Features**: 6 (FEAT-001, FEAT-002, FEAT-003, FEAT-004, FEAT-005, FEAT-006)
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
- **Features**:
  - FEAT-005: Realtime Activity Feed [Level 3]
  - FEAT-006: Card Labels [Level 3]
  - FEAT-007: Card Workflow Automation [Level 3]

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

### FEAT-005: Realtime Activity Feed
- **Version**: next
- **Status**: complete
- **Priority**: medium
- **Complexity**: Level 3
- **Description**: Track and display a realtime activity feed — capture board events (card created, moved, updated, deleted) and surface them in a live-updating feed panel. Requires decisions on realtime transport (WebSocket vs SSE vs polling), activity event schema, and feed UI/UX.
- **Linked Tasks**: TASK-005 (complete)
- **Branch**: feature/FEAT-005-realtime-activity-feed (merged 2026-05-25)
- **Created**: 2026-05-25
- **Completed**: 2026-05-25

---

### FEAT-006: Card Labels
- **Version**: next
- **Status**: complete
- **Priority**: medium
- **Complexity**: Level 3
- **Description**: Add color-coded labels to cards with filtering support. Includes label creation and management (name + color), label badge display on card tiles, inline label assignment from the card detail modal, and label filter chips in the board header. Requires design decisions on the color picker UX, label CRUD API, card-label data model, and client-side filter integration.
- **Linked Tasks**: TASK-006 (complete)
- **Branch**: feature/FEAT-006-card-labels (merged 2026-05-28)
- **Created**: 2026-05-27
- **Completed**: 2026-05-28

---

### FEAT-007: Card Workflow Automation
- **Version**: next
- **Status**: planned
- **Priority**: medium
- **Complexity**: Level 3
- **Description**: Simple trigger/action rules on cards: when a card moves to a column or gets a label/due date, automatically fire a configurable action (assign a label, move to another column, send a notification). Rules defined inline per-board with no separate automation page.
- **Linked Tasks**: None
- **Branch**: feature/FEAT-007-card-workflow-automation
- **Created**: 2026-05-28

---

### FEAT-004: Card Detail Modal + Search/Filter
- **Version**: v0.2.0
- **Status**: complete
- **Priority**: medium
- **Complexity**: Level 3
- **Description**: Card detail modal (click card → modal with full title, description, due date, labels; inline edit and save). Board-level search bar (filter cards by title text). Label and due-date filter chips in the board header. All filters applied client-side against TanStack Query cache.
- **Linked Tasks**: TASK-004 (complete)
- **Branch**: feature/FEAT-004-card-detail-search-filter (merged 2026-05-19)
- **Created**: 2026-05-16
- **Completed**: 2026-05-19
