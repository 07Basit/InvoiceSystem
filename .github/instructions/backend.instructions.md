---
description: "Use when creating or editing backend Node.js/Express controllers, routes, services, middleware, or any backend TypeScript files. Covers Controller-Service-Repository pattern, error handling, Zod validation middleware, and Winston logging for the Invoice Management System."
applyTo: "backend/**"
---

# Backend Development Guidelines

## Architecture Pattern: Controller → Service → Repository

```
Request → Route → Middleware (Zod validate) → Controller → Service → Prisma (DB)
                                                                 ↓
Response ←────────────────────────────────── Controller ← Service
```

- **Controller**: Parses validated request, calls service, returns HTTP response
- **Service**: Contains all business logic, orchestrates operations
- **Repository**: Raw DB access via Prisma (keep in service for simple cases; extract only if reused)

## Controller Rules

```typescript
// ✅ Correct controller structure
export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreateInvoiceDto; // already validated by middleware
  const invoice = await invoiceService.create(data);
  
  logger.info('Invoice created', { invoiceId: invoice.id, action: 'create_invoice' });
  
  res.status(201).json({
    success: true,
    data: invoice,
    error: null,
    meta: null,
  });
});
```

## Response Shape — Always Return This Structure
```typescript
// Success (single resource)
{ success: true, data: T, error: null, meta: null }

// Success (list)
{ success: true, data: T[], error: null, meta: { page, limit, total, totalPages } }

// Error
{ success: false, data: null, error: { code: string, message: string }, meta: null }
```

## Error Handling
- All async route handlers wrapped with `asyncHandler` utility (prevents try-catch repetition)
- A global error handler middleware catches and formats all errors
- Never expose stack traces in responses (`NODE_ENV !== 'development'`)
- Use a custom `AppError` class for known business errors with HTTP status codes

```typescript
// Custom error class
throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
```

## Zod Validation Middleware
- Every route that accepts a body/params/query must have a Zod validation middleware
- Import schemas from `shared/` to share with frontend
- Validation errors return 400 with field-level error details

```typescript
router.post('/', validate(createInvoiceSchema), createInvoice);
```

## Winston Logging
- Import `logger` from `utils/logger.ts` — never use `console.log`
- Log levels: `info` (success ops), `warn` (non-critical issues), `error` (exceptions)
- Always include context: `{ userId, resourceId, action, duration }`
- Never log passwords, tokens, or PII

```typescript
logger.info('Invoice created', { invoiceId: id, userId: req.user?.id, action: 'create' });
logger.warn('Invoice not found, returning 404', { invoiceId: id });
logger.error('Failed to generate PDF', { error: err.message, invoiceId: id });
```

## Route File Conventions
- Filename: kebab-case (`invoice-routes.ts`)
- Mount at `/api/v1/<resource>`
- Group CRUD + custom actions together

```typescript
const router = Router();
router.get('/', validate(listInvoicesSchema), listInvoices);
router.get('/:id', getInvoice);
router.post('/', validate(createInvoiceSchema), createInvoice);
router.put('/:id', validate(updateInvoiceSchema), updateInvoice);
router.delete('/:id', deleteInvoice);
router.get('/:id/download/pdf', downloadInvoicePdf);
router.get('/:id/download/excel', downloadInvoiceExcel);
export default router;
```

## Environment Variables
- All secrets and config via `.env` — never hardcode
- Type-safe env access using a validated config module (`src/config.ts` with Zod)
- Required env vars: `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET` (later), `CORS_ORIGIN`

## Security Middleware (always apply)
```typescript
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '10mb' }));
```

## File Upload Handling
- Use `multer` for file uploads (PDF import, Excel import)
- Validate MIME type and file size before processing
- Store uploads temporarily in `/tmp` — never persist raw uploads to DB
