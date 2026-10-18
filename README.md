# Invoice System

A web application for creating and managing export invoices: importers and their locations, invoices with line items and automatic totals, product lists with per-importer prices, PDF / Excel / ZIP documents, a dashboard, and a Recycle Bin.

To run it, see [RUNNING.md](RUNNING.md).

## Features

- **Invoices**: create, edit, copy and soft-delete. Totals, round-off and amount in words are calculated.
- **Invoice types**: Normal, Party, Custom, or Both (a party page and a custom page on one invoice). An "Actual" copy can be made of an invoice.
- **Importers and locations**: each importer has landing and loading locations and a default currency.
- **Profiles**: exporter, bank, signature and declaration profiles fill in the invoice.
- **Products and product lists**: a general list, plus lists per importer, currency and location. Choosing a list prices the invoice lines. A line with no price is highlighted.
- **Target total**: type the total you want and the line rates are adjusted to match it.
- **Documents**: one-page A4 PDF, Excel, and a ZIP of many invoices. Share by email or WhatsApp on macOS.
- **Filters and search**: filter by importer, currency, date, amount, ports, product, exporter and type. Select many invoices to download, share or delete.
- **Dashboard**: revenue per month and per importer in a reporting currency, using the exchange rate of each invoice's date (or a manual rate).
- **Recycle Bin**: restore or permanently delete invoices and importers.
- **Login**: JWT sessions, with a "keep me signed in" option.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Backend | Node.js 20+, Express 5, TypeScript, Prisma, Winston |
| Database | SQL Server 2022 (Docker) |
| Validation | Zod schemas shared by frontend and backend |
| Documents | pdf-lib, ExcelJS, JSZip |
| Tests | Jest + ts-jest (backend), Vitest + React Testing Library (frontend) |
| Quality | TypeScript strict mode, ESLint 9 (flat config) |

## Project layout

```
InvoiceSystem/
├── backend/    Express API, Prisma schema and migrations, document generation
├── frontend/   React app (feature folders under src/features)
├── shared/     Zod schemas and types used by both
├── docker-compose.yml   SQL Server
└── RUNNING.md  Steps and commands to run everything
```

Backend request flow: route → Zod validation → controller → service → Prisma. Every response has the shape `{ success, data, error, meta }`.

## Data structures and performance notes

- Dashboard and summary numbers are added up in the database (`GROUP BY`) and only the grouped rows are converted, so memory does not grow with the number of invoices.
- Exchange-rate lookup uses binary search (`backend/src/utils/binarySearch.ts`).
- The top importers use a bounded min-heap (`backend/src/utils/topN.ts`).
- Bulk delete and ZIP load/update all invoices in a constant number of queries.
- The frontend uses a `Set` for "is this invoice selected" and a `Map` for product price lookup.
- Search uses `LIKE '%text%'`, which cannot use an index. It is fine for thousands of invoices. For far more, add SQL Server Full-Text Search, which the default Docker image does not include.

## Testing

```bash
pnpm test        # backend and frontend
pnpm typecheck
pnpm lint        # frontend (the backend is checked by typecheck)
```
