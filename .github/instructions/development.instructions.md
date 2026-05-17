---
description: "Use when setting up the project, scaffolding new features, running dev servers, managing dependencies, or understanding the development workflow for the Invoice Management System."
---

# Development Workflow

## Project Setup

### Prerequisites
- Node.js 20+ (use `.nvmrc` or `.node-version` to pin)
- PostgreSQL 15+ running locally or via Docker
- `pnpm` as the package manager (workspace monorepo)

### Initial Setup
```bash
# Install all dependencies (monorepo)
pnpm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Run DB migrations
cd backend && pnpm prisma migrate dev

# Seed development data (optional)
cd backend && pnpm prisma db seed

# Start both servers concurrently
pnpm dev
```

### Individual Dev Servers
```bash
# Frontend only (http://localhost:5173)
cd frontend && pnpm dev

# Backend only (http://localhost:3000)
cd backend && pnpm dev
```

## Monorepo Structure (pnpm workspaces)
```json
// root package.json
{
  "name": "manage-system",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter frontend dev\" \"pnpm --filter backend dev\"",
    "build": "pnpm --filter frontend build && pnpm --filter backend build",
    "test": "pnpm --filter frontend test && pnpm --filter backend test",
    "lint": "pnpm --filter frontend lint && pnpm --filter backend lint"
  },
  "workspaces": ["frontend", "backend", "shared"]
}
```

## Scaffolding a New Feature

### 1. Add the Prisma model
```bash
# Edit backend/src/prisma/schema.prisma
# Then run:
cd backend && pnpm prisma migrate dev --name add_<feature>
```

### 2. Add Zod schema to shared/
```
shared/schemas/<feature>.schema.ts
```

### 3. Create backend layers
```
backend/src/
├── controllers/<feature>.controller.ts
├── routes/<feature>-routes.ts
├── services/<feature>.service.ts
```

### 4. Register route in app.ts
```typescript
app.use('/api/v1/<feature>', featureRouter);
```

### 5. Create frontend feature module
```
frontend/src/features/<feature>/
├── components/
├── hooks/use<Feature>.ts
├── pages/<Feature>Page.tsx
├── services/<feature>Service.ts
└── store/<feature>Store.ts
```

### 6. Add route to router
```typescript
// frontend/src/routes.ts
{ path: '/<feature>', element: <FeaturePage /> }
```

## Git Conventions
- Branch: `feature/<ticket>-<short-desc>`, `fix/<ticket>-<short-desc>`
- Commits: `feat: add invoice PDF export`, `fix: handle null client on invoice list`
- Never commit `.env` files — they are git-ignored
- Run `pnpm lint && pnpm test` before committing

## Environment Files
```
backend/.env          # Local development secrets (git-ignored)
backend/.env.example  # Template committed to git (no real secrets)
frontend/.env         # Vite env vars (VITE_ prefix)
frontend/.env.example # Template
```

## Useful Commands
```bash
# Generate Prisma client after schema changes
pnpm --filter backend prisma generate

# Open Prisma Studio (visual DB browser)
pnpm --filter backend prisma studio

# Run all tests
pnpm test

# Run tests with coverage
pnpm --filter backend test:coverage
pnpm --filter frontend test:coverage

# Lint all packages
pnpm lint

# Type-check all packages
pnpm typecheck
```
