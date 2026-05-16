# Product Brief

> This document captures the business and product context for development teams.
> It ensures all agents understand the product's purpose, users, and constraints.

## Product Overview

- **Name**: BanyanBoard
- **Value Proposition**: A simple, focused Kanban board for small teams who want to track work without the complexity of Jira or the cost of Trello premium. Cards move through columns; teams stay aligned.
- **Product Type**: Self-hosted web application (Docker Compose)
- **Stage**: MVP

## Key Functionality

- Create and manage boards with customizable columns (default: To Do, In Progress, Done)
- Create cards with titles, descriptions, due dates, and labels
- Drag-and-drop cards between columns
- Multiple boards per team
- Label-based filtering and organization

## Markets Serviced

- **Primary Market**: Small software and product teams (2–15 people) who want lightweight task tracking
- **Secondary Markets**: Freelancers managing client projects; internal ops teams at small companies
- **Geographic Focus**: Global (English-first)
- **Market Size**: Small — intentionally scoped; not competing with enterprise project management

## Competitive Landscape

- **Direct Competitors**: Trello (free tier), Linear (lightweight mode), GitHub Projects
- **Indirect Competitors**: Notion boards, spreadsheets, sticky notes
- **Key Differentiators**: Self-hosted (data stays local), zero configuration to start, no per-seat pricing
- **Competitive Advantages**: Simplicity — no sprints, epics, or story points unless the team adds them manually

## Key Personas

### Primary Users

| Persona | Role | Goals | Pain Points | Success Metrics |
|---------|------|-------|-------------|-----------------|
| Team Member | Individual contributor (dev, designer, PM) | Know what to work on next; update card status quickly | Context switching to update tickets; overly complex tools | Cards moved to Done per week; daily active use |
| Team Lead | Engineering or product lead | See team's work at a glance; spot bottlenecks in columns | No overview without drilling into each ticket; stale cards | Board usage weekly; cards in Done vs In Progress ratio |

### Secondary Users

| Persona | Role | Goals |
|---------|------|-------|
| Freelancer | Solo operator managing multiple client boards | Keep client work separated; track deliverables per project |

### Administrators/Operators

| Persona | Role | Responsibilities |
|---------|------|------------------|
| Self-hoster | DevOps / developer who deploys the app | Stand up Docker Compose stack; manage backups; add team members |

## User Flows

- **Primary Flow**: Open board → see columns → drag a card from In Progress → Done → feel satisfied
- **Onboarding**: Create account → create board → create first card → invite team member
- **Key Workflows**:
  - Daily standup: team opens board, reviews In Progress column, moves cards
  - Sprint planning: team creates cards in To Do, assigns labels and due dates
  - Retrospective: team reviews Done column count for the period

## Success Metrics & KPIs

### Business Metrics

- Not applicable (self-hosted, no monetization in MVP)

### Product Metrics

- Cards moved to Done per active board per week (target: ≥ 5)
- Daily active boards (at least one card interaction per day)
- Time-to-first-card: new user creates first card within 5 minutes of signup

### Technical Metrics

- API response time p95 < 200ms for card and board operations
- Frontend initial load < 2s on localhost (no CDN optimizations needed for MVP)
- Error rate < 1% on card CRUD and drag-and-drop operations

## Non-Functional Requirements

### Performance

- **Response Time**: p95 < 200ms for all API endpoints; drag-and-drop feels instant (optimistic UI update)
- **Throughput**: Not a concern for MVP — small teams, low concurrent load
- **Concurrent Users**: Designed for 2–15 simultaneous users per board
- **Page Load Time**: < 2s initial load on localhost; < 3s on local network

### Scalability

- **Users**: 2–50 users per deployment; not designed for multi-tenant SaaS scale in MVP
- **Data Volume**: Hundreds of cards per board, tens of boards — no pagination required for MVP
- **Growth Rate**: N/A — self-hosted; each deployment scales to the team's needs
- **Peak Load**: Not a concern; small team usage patterns

### Security

- **Authentication**: Username/password with JWT or session cookies — to be decided during design
- **Authorization**: Board-level access control (members can only see boards they belong to)
- **Compliance**: None required for MVP (self-hosted, no PII regulation beyond basic account data)
- **Data Classification**: Internal only — no public data exposure
- **Encryption**: HTTPS in production (user-configured); bcrypt for password hashing

### Availability & Reliability

- **Uptime Target**: Best-effort for MVP (self-hosted; no SLA)
- **Recovery Time Objective (RTO)**: N/A for MVP
- **Recovery Point Objective (RPO)**: Daily PostgreSQL backup recommended in runbook
- **Disaster Recovery**: Docker volume backup — documented, not automated in MVP
- **Backup Strategy**: User-managed (`docker compose exec db pg_dump`)

### Data & Privacy

- **Data Residency**: Self-hosted — data stays on the operator's infrastructure
- **Data Retention**: No automated deletion; operator-managed
- **Privacy Requirements**: GDPR not in scope for MVP (no cloud processing of user data)
- **PII Handling**: Email and name stored for accounts; no third-party analytics
- **Data Portability**: JSON export of boards is a post-MVP feature
- **Right to Deletion**: Account deletion removes all user data — must be implemented

### Accessibility

- **Target Compliance**: WCAG 2.1 AA (best-effort for MVP)
- **Key Requirements**:
  - [x] Keyboard navigation for card creation and column navigation
  - [ ] Screen reader compatibility (post-MVP)
  - [x] Color contrast compliance for labels and status indicators
  - [x] Focus indicators on interactive elements
  - [x] Alt text for any icons used
  - [ ] Captions for video/audio (N/A — no media)

### Internationalization (i18n)

- **Supported Languages**: English only for MVP
- **Localization Needs**: None for MVP

### Browser/Platform Support

- **Browsers**: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+
- **Mobile**: Responsive layout on mobile browsers; drag-and-drop may be limited on touch (post-MVP)
- **Desktop**: macOS, Windows, Linux via Docker Compose

## Integration Points

### External Systems

| System | Purpose | Protocol | Direction |
|--------|---------|----------|-----------|
| PostgreSQL | Persistent storage for boards, columns, cards | TCP/SQL | Internal |

### APIs Consumed

| API | Provider | Purpose |
|-----|----------|---------|
| None | — | No external APIs in MVP |

### APIs Provided

| API | Purpose | Consumers |
|-----|---------|-----------|
| REST API (Express) | CRUD for boards, columns, cards; auth | React frontend |

### Data Sources

| Source | Type | Frequency |
|--------|------|-----------|
| PostgreSQL | Relational database | Real-time (per request) |

## Constraints & Assumptions

### Business Constraints

- MVP scope: boards, columns, cards with title/description/due date/labels, drag-and-drop — nothing else
- Self-hosted only; no cloud hosting in MVP
- Small team focus — no org hierarchy, no roles beyond member

### Technical Constraints

- React frontend, TypeScript/Express backend, PostgreSQL database
- Docker Compose for local development and deployment
- Clean architecture — layered (controllers → services → repositories) but no clever abstractions; favor readability
- No real-time sync (WebSockets) in MVP — page refresh or polling acceptable

### Assumptions

- Teams using BanyanBoard have a developer who can run Docker Compose
- All team members use the same deployment (no multi-tenant)
- English is sufficient for the initial user base

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Drag-and-drop UX is hard to get right | Medium | High | Use a proven DnD library (react-beautiful-dnd or dnd-kit) |
| Schema migrations break existing data | Medium | High | Use a migration tool (e.g., node-postgres-migrate or Flyway) from day one |
| Scope creep beyond simple Kanban | High | Medium | Strict MVP gate — features not in productBrief require a roadmap entry |

## Open Questions

- [ ] Authentication: JWT (stateless) or session cookies (simpler)? Decide before auth implementation
- [ ] Column ordering: fixed (To Do / In Progress / Done) or user-customizable in MVP?
- [ ] Card ordering within columns: manual drag-order preserved, or last-updated sort?

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-16 | /banyan-init | Initial creation |
| 2026-05-16 | User | Populated with BanyanBoard context — Kanban board for small teams |

## Last Refreshed

2026-05-16
