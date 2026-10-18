# Running the Invoice System

Steps and commands for a fresh machine (macOS or Linux; on Windows use PowerShell with the same commands).

## 1. Install the tools

- Node.js 20 or newer (`node -v`)
- pnpm 10 (`npm i -g pnpm@10`, or prefix commands with `npx pnpm@10`)
- Docker Desktop, running (for SQL Server)

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

- `DATABASE_URL`: the SQL Server connection string. Its password must match `MSSQL_SA_PASSWORD` below.
- `JWT_SECRET`: generate one with `openssl rand -hex 32`.
- `EXCHANGERATE_API_KEY`: optional, for currencies the ECB does not publish.

`.env` files are git-ignored. Never commit them.

## 4. Start the database

Docker Compose reads `MSSQL_SA_PASSWORD` from the environment or a root `.env` file.

```bash
export MSSQL_SA_PASSWORD='choose-a-strong-password'
docker compose up -d sqlserver
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
| `docker compose stop sqlserver` | Stop the database |
| `docker compose down` | Remove the container (data stays in the `sqlserver_data` volume) |

## Troubleshooting

- **Cannot connect to the database**: check `docker compose ps` shows `healthy` and the password in `DATABASE_URL` matches `MSSQL_SA_PASSWORD`.
- **"Login failed"**: create a user with `pnpm db:create-user`.
- **Port already in use**: stop the other process on 5173 or 3000, or change `PORT` in `backend/.env`.
- **Prisma client errors after pulling changes**: run `pnpm db:generate && pnpm db:migrate`.
