# Project Brief

## Project Overview

- **Name**: BanyanBoard
- **Description**: A simple Kanban board for small teams. Users create boards with columns (To Do, In Progress, Done) and move cards between them. Cards have titles, descriptions, due dates, and labels.
- **Goals**:
  - Ship a working Kanban board that small teams can self-host with Docker Compose
  - Keep the codebase simple and readable — clean architecture without over-engineering
  - Deliver the MVP feature set: boards, columns, cards, drag-and-drop

## Repository Structure

- **Type**: Poly-repo
- **Workspace Tool**: None (single repo, multiple layers)
- **Workspace Root**: N/A
- **Apps/Services**:
  - `frontend/` — React + TypeScript SPA
  - `backend/` — TypeScript + Express REST API
  - `db/` — PostgreSQL migrations and seed scripts
- **Shared Packages**: N/A (shared types may live in `shared/` or be inlined)

## Git Configuration

- **Repository**: Yes
- **Provider**: None (local only)
- **CLI Available**: none
- **Remote URL**: none
- **Default Branch**: master
- **Archive Strategy**: local-merge
