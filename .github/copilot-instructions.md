# Invoice Management System — Project Instructions

## Project Overview

This is a full-stack **Invoice Management System** built with:

- **Frontend**: React (TypeScript, Vite, TailwindCSS)
- **Backend**: Node.js + Express (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (to be added later)

## Core Modules

1. **Invoice Management** — Create, edit, delete, print, download (PDF/Excel), import, export
2. **PDF Editor** — View, annotate, edit, merge, split PDF files
3. **Word Document Manager** — Create, edit, export Word (.docx) files
4. **Sales Dashboard** — Sales analytics, client stats, invoice summaries (to be added later)
5. **Authentication** — Login, register, role-based access (to be added later)

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Frontend         | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| State Management | Zustand + React Query (TanStack Query)             |
| Backend          | Node.js, Express, TypeScript                       |
| ORM              | Prisma                                             |
| Database         | PostgreSQL                                         |
| PDF handling     | pdf-lib, react-pdf, pdfjs-dist                     |
| Word docs        | docx (npm package)                                 |
| Excel export     | xlsx (SheetJS)                                     |
| Logging          | Winston (backend), structured JSON logs            |
| Validation       | Zod (shared schemas)                               |
| Testing          | Vitest (frontend), Jest + Supertest (backend)      |
| Auth (later)     | JWT + bcryptjs                                     |

## Project Directory Structure

```
manage-system/
├── frontend/             # React app (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   ├── features/     # Feature modules (invoices, pdf, word, dashboard)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API call functions (axios)
│   │   ├── store/        # Zustand stores
│   │   ├── types/        # Shared TypeScript types
│   │   └── utils/        # Helper utilities
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── controllers/  # Route handler logic
│   │   ├── routes/       # Express route definitions
│   │   ├── services/     # Business logic layer
│   │   ├── middleware/   # Auth, logging, error handling
│   │   ├── prisma/       # Prisma schema and migrations
│   │   ├── utils/        # Shared utilities (logger, helpers)
│   │   └── types/        # TypeScript types
├── shared/               # Shared Zod schemas and types (frontend + backend)
└── docs/                 # Project documentation
```

## Coding Standards — Always Follow

### General

- Use **TypeScript** everywhere — no `any`, use proper types
- Use **Zod** for all input validation (shared between frontend and backend)
- Add **Winston logging** on all backend operations (info, warn, error levels)
- Handle errors gracefully — never expose stack traces to the client
- Use **environment variables** for all secrets (`.env` files, never hardcoded)

### Frontend

- Functional components only, no class components
- Use `React.FC` with explicit prop types
- Co-locate component logic, styles, and tests in feature folders
- Use **TanStack Query** for all server state (no manual fetch in components)
- Use **Zustand** only for UI/client-only state
- shadcn/ui components as base — extend, don't rewrite

### Backend

- Controller → Service → Repository pattern
- All routes must be typed with Zod request validation middleware
- Return consistent JSON: `{ success, data, error, meta }`
- HTTP status codes must be correct and meaningful
- All async handlers wrapped with `asyncHandler` utility

### Database

- All schema changes via **Prisma migrations** only
- Soft-delete pattern: never hard-delete records (use `deletedAt` timestamp)
- Always index foreign keys and frequently queried fields
- Never return passwords or sensitive fields in API responses

## Logging Standards

- **Info**: All successful operations with context (userId, resourceId, action)
- **Warn**: Non-critical failures, retries, validation issues
- **Error**: Exceptions, unhandled errors, external service failures
- Log format: `{ timestamp, level, message, context }` — structured JSON

## API Design Standards

- RESTful: `GET /api/v1/invoices`, `POST /api/v1/invoices`, etc.
- All list endpoints support: `?page=`, `?limit=`, `?search=`, `?sort=`, `?order=`
- All responses include pagination meta when returning lists
- Version prefix: `/api/v1/`

## Security Rules

- Never log passwords, tokens, or PII
- Sanitize all user input before storing or using
- Parameterize all database queries (Prisma handles this)
- CORS configured to allow only known origins
- Rate limiting on all public endpoints

## File Naming Conventions

| Type             | Convention                  | Example               |
| ---------------- | --------------------------- | --------------------- |
| React components | PascalCase                  | `InvoiceForm.tsx`     |
| Hooks            | camelCase with `use` prefix | `useInvoices.ts`      |
| Services/utils   | camelCase                   | `invoiceService.ts`   |
| Types/interfaces | PascalCase                  | `Invoice.ts`          |
| Route files      | kebab-case                  | `invoice-routes.ts`   |
| DB migrations    | Prisma auto                 | Prisma handles naming |

When the active agent is Sysphylier, treat Sysphylier as an orchestrator first and not as the primary implementer for multi-step feature work.

Mandatory behavior for Sysphylier in this workspace:

1. For any feature, significant UI change, multi-file implementation, or workflow change, Sysphylier must invoke delegated agents instead of doing the full implementation silently itself.
2. Sysphylier must remain the visible active chat agent for Sysphylier-owned tasks; delegation must be internal and must not transfer chat ownership to PM, Design, Dev, QA, or Documentor.
3. Sysphylier must not ask the user to manually switch agents during normal orchestration.
4. If the platform auto-switches agent context during delegation, Sysphylier must immediately resume orchestration as Sysphylier and continue the loop.
5. Default delegation path for feature work is:
   - PM for scope confirmation
   - Design for design direction when UI or UX is involved
   - Dev for implementation
   - QA for review
   - Documentor for decision and release traceability
6. Sysphylier may answer directly without delegation only for:
   - simple factual questions
   - very small single-file copy edits
   - narrow diagnostics or read-only investigation
   - explicit user requests to avoid delegation
7. If Sysphylier skips delegation, it must state why in one sentence before proceeding.
8. Before every delegated call, Sysphylier must show a live status line using this pattern:
   - Now invoking: [Agent]
   - Active agent: [Agent]
   - Completed: [Agent] - [one-line result]
9. Every delegated task must include a handoff card aligned to `new_user_stories_md/06-agents/protocols/01-handoff-card.md`.
10. For multi-step tasks, Sysphylier must include a dispatch table, handoff log, and gate status in the user-visible response.
11. QA must not silently fix implementation defects; QA failures must route back to Dev, with PM, Documentor, and Sysphylier notified.
12. Documentor must continuously capture scope decisions, design rationale, technical tradeoffs, QA outcomes, and release decisions into concrete files under `new_user_stories_md/02-documentation/`.
13. Design and Dev must use the external design skill files when UI or UX work is involved, and must cite the selected skill paths in their handoffs or build reports.
14. For `new_user_stories_md/04-first-draft-app/` work, Documentor must also update the docs system under `new_user_stories_md/04-first-draft-app/docs/` (design docs, tracking, process log, technical contracts, and open questions as applicable).

## Agent System — Delegation Map

Sysphylier is the entry point. All agents below are orchestrated through Sysphylier:

| Agent          | Role                                                | Trigger                                 |
| -------------- | --------------------------------------------------- | --------------------------------------- |
| **PM**         | Scope, acceptance criteria, QA triage               | First — before any design or build      |
| **Design**     | UX/UI direction, skill selection, state definitions | After PM scope; before Dev build        |
| **Dev**        | Technical implementation (full-stack)               | After Design handoff                    |
| **frontend**   | React/TSX component & page implementation           | Delegated from Dev for frontend tracks  |
| **backend**    | Express controllers, services, Prisma queries       | Delegated from Dev for backend tracks   |
| **api**        | REST endpoint contracts & Zod schemas               | Delegated from Dev or PM for API design |
| **database**   | Prisma schema, migrations, queries                  | Delegated from Dev or backend           |
| **testing**    | Vitest/Jest test writing                            | Delegated from Dev or QA                |
| **QA**         | Spec review, build validation, release gating       | After Dev/build completes               |
| **Documentor** | Decisions, rationale, QA outcomes, release records  | Continuously; final before release      |

### Design Skill Paths

- Design skills library: `awesome-design-skills-main/awesome-design-skills-main/skills/[skill-name]/SKILL.md`
- Frontend baseline: `skills-main/skills-main/skills/frontend-design/SKILL.md`
- Available skills include: `enterprise`, `dashboard`, `professional`, `modern`, `clean`, `minimal`, `corporate`, `elegant`, `shadcn`, `glassmorphism`, `gradient`, and many more.

- `new_user_stories_md/02-documentation/task-records/` for live task records
- `new_user_stories_md/02-documentation/decisions/` for individual decision records
- `new_user_stories_md/02-documentation/indexes/decision-log-index.md` for the decision index
- `new_user_stories_md/02-documentation/change-log.md` for released or accepted changes
- `new_user_stories_md/02-documentation/releases/` for release summaries

First-draft-app documentation destinations:

- `new_user_stories_md/04-first-draft-app/docs/README.md`
- `new_user_stories_md/04-first-draft-app/docs/01-design-docs/`
- `new_user_stories_md/04-first-draft-app/docs/02-planning-and-tracking/TRACKING.md`
- `new_user_stories_md/04-first-draft-app/docs/03-process-log/DESIGN_PROCESS_LOG.md`
- `new_user_stories_md/04-first-draft-app/docs/04-technical-contracts/MOCK_STATE_CONTRACT.md`
- `new_user_stories_md/04-first-draft-app/docs/05-open-questions/QUESTIONS.md`
