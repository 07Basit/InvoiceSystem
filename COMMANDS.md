# Manage System Commands

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker Desktop running (required for SQL Server)

## Initial Setup

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm install
Copy-Item backend\.env.example backend\.env -Force
Copy-Item frontend\.env.example frontend\.env -Force
```

## Start Database (SQL Server)

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
docker compose up -d sqlserver
docker compose ps
```

## Run the Application (Frontend + Backend)

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm dev
```

## Run Frontend Only

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm --filter frontend dev
```

## Run Backend Only

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm --filter backend dev
```

## Build Commands

### Build everything

```powershell
pnpm build
```

### Build frontend only

```powershell
pnpm --filter frontend build
```

### Build backend only

```powershell
pnpm --filter backend build
```

## Typecheck, Lint, Test

### Typecheck all

```powershell
pnpm typecheck
```

### Lint all

```powershell
pnpm lint
```

### Test all

```powershell
pnpm test
```

### Coverage

```powershell
pnpm test:coverage
```

## Prisma / Database Utilities

```powershell
pnpm db:generate   # Regenerate Prisma client after schema changes
pnpm db:migrate    # Apply pending migrations (creates DB tables)
pnpm db:seed       # Seed the database with sample data
pnpm db:studio     # Open Prisma Studio (browser UI) at http://localhost:5555
```

### Prisma Studio — Database UI

Prisma Studio is a visual browser-based editor to view, filter, and edit your database records.

```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm db:studio
```

Then open **http://localhost:5555** in your browser.
You can browse all tables (invoices, importers, line items, documents, etc.), edit records, and run filters without writing SQL.

## Production Preview (Frontend)

```powershell
pnpm --filter frontend preview
```

## Stop Services

### Stop app dev servers

Press Ctrl+C in the running terminal.

### Stop SQL Server container

```powershell
docker compose stop sqlserver
```

## Netlify Build (Monorepo)

- Netlify uses `netlify.toml` from repo root.
- Effective build command:

```powershell
pnpm --filter frontend build
```

- Publish directory: `frontend/dist`
