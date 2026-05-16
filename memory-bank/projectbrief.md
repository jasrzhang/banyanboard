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

## Security Debt (Auto-Generated)

### Dependency Upgrade: node-pg-migrate
- **Current Version**: 7.9.1
- **Target Version**: 8.0.4
- **Security Issue**: HIGH — transitive `glob@11.0.x` CLI command injection (GHSA-5j98-mcp5-4vw2, CWE-78). Attack surface is CLI-only, not the server runtime.
- **Scope**: 1 file (package.json); `migrate` and `migrate:down` npm scripts
- **Breaking Changes**: Yes — v8 has new migration file API and config format; low impact until Phase 4 writes migration files
- **Recommended Priority**: HIGH — upgrade before Phase 4 to avoid migration file format conversion debt
- **Generated From**: Task TASK-001, Phase 1, Date 2026-05-16

### Dependency Upgrade: vitest
- **Current Version**: 2.1.9
- **Target Version**: 4.1.6
- **Security Issue**: MODERATE — transitive `esbuild@<=0.24.2` origin check bypass (GHSA-67mh-4wv8-2f99). Dev-only; requires developer to visit a malicious page while dev server is running.
- **Scope**: Dev dependency; all test files under `backend/src/__tests__/`
- **Breaking Changes**: Yes — Vitest 2→3 and 3→4 both have breaking config/API changes
- **Recommended Priority**: MEDIUM — upgrade after Phase 6 when all test files are written, to avoid mid-flight API breakage
- **Generated From**: Task TASK-001, Phase 1, Date 2026-05-16
