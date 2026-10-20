# Roadmap

Changes and improvements worth making, in rough priority order. Each item says why it matters and how big it is (S: under a day, M: a few days, L: a week or more).

## 1. Storage and scale

| Item | Why | Size |
|---|---|---|
| Stop storing a full signature image on every invoice | Signatures are about 101 KB of the 118 KB an invoice takes. At 100,000 invoices the database would be about 11.8 GB, which makes backups slow and free hosting plans too small. | S |
| Option A: shrink the image on upload (about 15 KB) | Keeps the per-invoice snapshot, cuts growth about 5x. | S |
| Option B: store each signature once and point to it | Smallest database (about 1.7 GB at 100,000 invoices), but editing a signature would change old invoices unless versions are kept. | M |
| Move uploaded files and images out of the database | Keeps the database small and backups fast. | M |
| Choose a production PostgreSQL plan with room | Free tiers are small (often around 0.5 GB). Pick a host and plan that fits the expected size, and watch the database size. | S |

## 2. Performance

| Item | Why | Size |
|---|---|---|
| Faster text search for invoices | `ILIKE '%text%'` scans every row. Fine for thousands, slow for hundreds of thousands. Add a `pg_trgm` index or PostgreSQL full-text search. | M |
| Index the product filter | The "product" filter joins on a text column with no index. Store a short searchable product code or hash. | M |
| Cache the dashboard | Cache the converted totals for a minute and clear it when an invoice changes. | S |
| Stream large ZIP downloads | The whole ZIP is built in memory. Stream it, and cap the memory used. | M |
| Generate PDFs in a worker | Rendering blocks the server for about 0.6 ms per line. A worker thread keeps the API responsive. | M |
| Load the dashboard and airports data lazily | The two biggest frontend chunks are 410 kB and 283 kB. | S |
| Virtualise very long lists | The invoice list is paged, but the product and filter lists are not. | S |

## 3. Reliability and safety

| Item | Why | Size |
|---|---|---|
| Wrap multi-step writes in one transaction | Creating a Both invoice makes two rows and cleans up by hand if the second fails. | S |
| Unique invoice numbers ignoring capitals, in the database | The app refuses "rg 1" when "RG 1" exists, but only with a check before saving. Add a unique index on `lower("invoiceNumber")` so two simultaneous saves cannot slip through. | S |
| Make the invoice number unique per year or series | A global unique number makes copies and recycled numbers awkward. | M |
| Audit trail | Record who changed which field and when. The notification table is a start. | M |
| Roles and permissions | Today every user can do everything. Add admin, editor and viewer. | M |
| Password reset and account lockout | Only an admin script can reset a password. | M |
| Scheduled backups and a restore test | Docker volume only; no backup exists. | S |
| Automatic cleanup of the Recycle Bin | Permanently delete items after 30 days. | S |
| Error reporting | Send server and browser errors to a service such as Sentry. | S |

## 4. Product features

| Item | Why | Size |
|---|---|---|
| Invoice numbering rules | Auto-generate the next number from a pattern per importer. | M |
| Payment tracking | Paid, partly paid and overdue states, with payment dates. | L |
| Credit notes and invoice revisions | Correct an issued invoice without losing the original. | L |
| Email an invoice from the server | Send the PDF or Excel as an attachment, not only from the Mac share sheet. | M |
| Import invoices from Excel | Bring in past invoices in bulk. | M |
| Templates for PDFs | Let the user change the layout, logo and colours without code. | L |
| Multi-language documents | Print the invoice in the importer's language. | M |
| Reports | Revenue by product, by country, by month, with export. | M |
| Reminders | Notify before a due date. | S |

## 5. Quality and developer experience

| Item | Why | Size |
|---|---|---|
| ESLint for the backend | Only the frontend is linted today; the backend relies on type checks. | S |
| End-to-end tests (Playwright) | Cover create invoice, download PDF, bulk delete and login. | M |
| Tests against a real database | The unit tests mock Prisma, so SQL such as `GROUP BY` and the raw `EXTRACT(MONTH ...)` query is not exercised. Run a small suite against a throwaway PostgreSQL container. | M |
| Continuous integration | Run typecheck, lint, tests and build on every push and pull request. | S |
| Split the biggest components | `InvoiceForm.tsx` is about 1,100 lines. Break out the page, line-item table and totals. | M |
| Production Dockerfiles and deployment guide | Only the database runs in Docker today. | M |
| API documentation | Generate an OpenAPI file from the Zod schemas. | M |
| Dependency updates | Several packages are deprecated (for example multer 1.x). | S |
| Accessibility pass | Keyboard use, screen-reader labels and colour contrast on the dropdowns and dialogs. | M |
| Remove the unused clipboard endpoints | `/invoices/share/native` and `/invoices/zip/clipboard` (and the native share code behind them) are no longer called by the frontend, since Copy file was removed. They only worked when the server ran on the user's own Mac or Windows PC. Delete the routes, controller handlers, service code, `NATIVE_SHARE` setting and their tests. | S |
| Logo on the exporter profile | The invoice PDF and Excel print one built-in logo and tagline (`backend/src/assets/branding.ts`). Let each exporter profile carry its own logo and tagline, the same way it carries a signature. | M |

## 6. Suggested order

1. Signature storage (section 1), before the database grows.
2. Continuous integration, backend lint and real-database tests (section 5).
3. Backups, transactions and roles (section 3).
4. Full-text search and caching (section 2).
5. Feature work from section 4, starting with invoice numbering and email.
