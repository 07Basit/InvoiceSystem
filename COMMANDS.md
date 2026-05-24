# Manage System Commands

## Prerequisites
- Node.js 22+
- pnpm 10+
- Docker Desktop running (required for PostgreSQL)

## Initial Setup
```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
pnpm install
Copy-Item backend\.env.example backend\.env -Force
Copy-Item frontend\.env.example frontend\.env -Force
```

## Start Database (PostgreSQL)
```powershell
cd "c:\Users\508826\OneDrive - Aker Solutions\Desktop\Manage System"
docker compose up -d postgres
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
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

## Production Preview (Frontend)
```powershell
pnpm --filter frontend preview
```

## Stop Services
### Stop app dev servers
Press Ctrl+C in the running terminal.

### Stop PostgreSQL container
```powershell
docker compose stop postgres
```

## Netlify Build (Monorepo)
- Netlify uses `netlify.toml` from repo root.
- Effective build command:
```powershell
pnpm --filter frontend build
```
- Publish directory: `frontend/dist`
