# Technology Context

This file documents the technology stack, infrastructure, and tooling used in this project.

## Component Structure

### Components/Modules

```
frontend/
- Path: frontend/
- Language: TypeScript (React)
- Test Directory: frontend/src/__tests__
- Test Framework: Vitest (TBD)

backend/
- Path: backend/
- Language: TypeScript (Node.js / Express)
- Test Directory: backend/src/__tests__
- Test Framework: Jest or Vitest (TBD)

db/
- Path: db/
- Language: SQL (PostgreSQL migrations)
- Test Directory: N/A
```

### Shared/Common Code

- Shared TypeScript types (Card, Board, Column) — location TBD (`shared/` or inlined per layer)

## Development Commands

### Local Development

```bash
# Start all services (frontend, backend, postgres)
docker compose up

# Start in detached mode
docker compose up -d

# Rebuild after dependency changes
docker compose up --build

# Tear down (preserves volumes)
docker compose down

# Tear down and wipe database
docker compose down -v
```

### Backend

```bash
# Install dependencies
npm install --prefix backend

# Run in dev mode (ts-node-dev or tsx watch)
npm run dev --prefix backend

# Build
npm run build --prefix backend

# Run tests
npm test --prefix backend
```

### Frontend

```bash
# Install dependencies
npm install --prefix frontend

# Run dev server (Vite)
npm run dev --prefix frontend

# Build for production
npm run build --prefix frontend

# Run tests
npm test --prefix frontend
```

### Database

```bash
# Run migrations
npm run migrate --prefix backend

# Seed development data
npm run seed --prefix backend
```

### Linting & Type Checking

```bash
# Lint backend
npm run lint --prefix backend

# Lint frontend
npm run lint --prefix frontend

# Type check backend
npm run typecheck --prefix backend

# Type check frontend
npm run typecheck --prefix frontend
```

## Technology Stack

### Runtime Environment

- Node.js 20 LTS — backend runtime
- Docker + Docker Compose — local development and deployment

### Languages & Frameworks

- TypeScript 5.x — both frontend and backend
- React 18 — frontend UI framework
- Express 4.x — backend REST API framework
- PostgreSQL 15 — primary database

### Data Layer

- PostgreSQL 15 — relational database for boards, columns, cards, users
- node-postgres (`pg`) or Prisma — database client (TBD during setup)
- SQL migrations — schema versioning (migration tool TBD: Flyway, node-pg-migrate, or Prisma migrate)

### API & Communication

- REST API — TypeScript/Express, JSON payloads
- No WebSockets in MVP — card state refreshed on action or manual reload

### Infrastructure & Deployment

- Docker Compose — orchestrates frontend dev server, backend, and PostgreSQL
- No cloud infrastructure in MVP — fully self-hosted

### Development Tools

- Vite — frontend build tool and dev server
- ts-node-dev or tsx — backend TypeScript hot-reload in development
- ESLint + Prettier — linting and formatting (TBD configuration)
- Jest or Vitest — unit and integration testing (TBD per component)

### External Services

- None in MVP

<!-- AUTO-MANAGED: c4-references-start -->
## C4 References

<!--
  This section is auto-managed by /banyan-c4. Run /banyan-c4 to populate or refresh.
  Until /banyan-c4 has been run for the first time, this section is a placeholder.
  Do not hand-edit between the AUTO-MANAGED markers — edits will be overwritten.
-->

C4 architecture documentation has not been generated for this project yet.

After `/banyan-c4` runs, this section will contain pointers to the Container-level diagram and per-container detail docs.

<!-- AUTO-MANAGED: c4-references-end -->

## Architecture Principles

- **Clean architecture** — controllers → services → repositories; no business logic in route handlers
- **Simplicity over cleverness** — prefer explicit, readable code over clever abstractions
- **No premature abstractions** — don't abstract until there are 3+ concrete cases
- **12-Factor config** — all environment-specific values via environment variables

## Recent Technology Changes

### 2026-05-16 — Initial stack defined

- **What Changed**: Technology stack established for BanyanBoard MVP
- **Reason**: React + TypeScript frontend, Express backend, PostgreSQL for a familiar, well-supported stack suited to small team Kanban
- **Impact**: All new components should follow this stack

---

## Notes

- Specific library choices (DnD library, ORM, test runner) TBD during first implementation task — record the decision here when made
- Docker Compose service names: `frontend`, `backend`, `db` (or similar — finalize in docker-compose.yml)
- Keep Development Commands updated as build scripts are added to package.json files
