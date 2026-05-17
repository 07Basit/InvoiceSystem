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
| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| State Management | Zustand + React Query (TanStack Query) |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| PDF handling | pdf-lib, react-pdf, pdfjs-dist |
| Word docs | docx (npm package) |
| Excel export | xlsx (SheetJS) |
| Logging | Winston (backend), structured JSON logs |
| Validation | Zod (shared schemas) |
| Testing | Vitest (frontend), Jest + Supertest (backend) |
| Auth (later) | JWT + bcryptjs |

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
| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `InvoiceForm.tsx` |
| Hooks | camelCase with `use` prefix | `useInvoices.ts` |
| Services/utils | camelCase | `invoiceService.ts` |
| Types/interfaces | PascalCase | `Invoice.ts` |
| Route files | kebab-case | `invoice-routes.ts` |
| DB migrations | Prisma auto | Prisma handles naming |
