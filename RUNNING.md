# Running the Invoice System

Steps and commands for a fresh machine (macOS or Linux; on Windows use PowerShell with the same commands).

## 1. Install the tools

- Node.js 20 or newer (`node -v`)
- pnpm 10 (`npm i -g pnpm@10`, or prefix commands with `npx pnpm@10`)
- Docker Desktop, running (for PostgreSQL)

## 2. Install dependencies

```bash
pnpm install
```

## 3. Create the environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Open `backend/.env` and set:

- `DATABASE_URL`: the PostgreSQL connection string. Its user, password and database name must match `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` in the root `.env` (step 4). A password with special characters must be URL-encoded.
- `JWT_SECRET`: generate one with `openssl rand -hex 32`.
- `EXCHANGERATE_API_KEY`: optional, for currencies the ECB does not publish.

`.env` files are git-ignored. Never commit them.

## 4. Start the database

Docker Compose reads the database settings from a root `.env` file.

```bash
cp .env.example .env      # then set POSTGRES_PASSWORD to a strong password
docker compose up -d postgres
docker compose ps
```

Wait until the container shows `healthy`.

## 5. Create the tables

```bash
pnpm db:generate
pnpm db:migrate
```

Optional sample data and a login:

```bash
pnpm db:seed
pnpm db:create-user -- <username> <password> "Display Name"
```

## 6. Start the application

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1

To run one side only:

```bash
pnpm --filter frontend dev
pnpm --filter backend dev
```

## 7. Check that it works

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Other commands

| Command | What it does |
|---|---|
| `pnpm build` | Production build of frontend and backend |
| `pnpm --filter frontend preview` | Serve the built frontend |
| `pnpm test:coverage` | Tests with coverage |
| `pnpm db:studio` | Database browser at http://localhost:5555 |
| `docker compose stop postgres` | Stop the database |
| `docker compose down` | Remove the container (data stays in the `postgres_data` volume) |

## Troubleshooting

- **Cannot connect to the database**: check `docker compose ps` shows `healthy` and the password in `DATABASE_URL` matches `POSTGRES_PASSWORD`.
- **"Login failed"**: create a user with `pnpm db:create-user`.
- **Port already in use**: stop the other process on 5173 or 3000, or change `PORT` in `backend/.env`.
- **Prisma client errors after pulling changes**: run `pnpm db:generate && pnpm db:migrate`.

## Production database

Any PostgreSQL 14 or newer works (Neon, Supabase, Render, Azure Database for PostgreSQL, or your own server). Put its connection string in the backend's `DATABASE_URL` and create the tables once with:

```bash
cd backend && npx prisma migrate deploy
```

Use a connection string that requires SSL (for most hosts it ends with `?sslmode=require`).
