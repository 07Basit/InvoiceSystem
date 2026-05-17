---
description: "Scaffold a new backend API endpoint: controller, service, route, and Zod schema for the Invoice Management System"
---

Create a complete backend endpoint for the resource: `$RESOURCE_NAME`

## What to Generate

1. **Zod schema** in `shared/schemas/$RESOURCE_NAME.schema.ts`
   - `create${Resource}Schema`
   - `update${Resource}Schema`
   - `list${Resource}QuerySchema` (page, limit, search, sort, order)
   - Exported TypeScript types via `z.infer<>`

2. **Prisma model** (if not yet in schema) in `backend/src/prisma/schema.prisma`
   - Include `id`, `createdAt`, `updatedAt`, `deletedAt`
   - Add indexes on foreign keys and status fields
   - Migration command to run after

3. **Service** in `backend/src/services/$RESOURCE_NAME.service.ts`
   - `list(query)` — paginated, filtered, soft-delete-aware
   - `getById(id)` — throws `AppError` if not found
   - `create(dto)` — returns created record
   - `update(id, dto)` — returns updated record
   - `softDelete(id)` — sets `deletedAt`

4. **Controller** in `backend/src/controllers/$RESOURCE_NAME.controller.ts`
   - `list`, `getOne`, `create`, `update`, `remove` handlers
   - All wrapped with `asyncHandler`
   - Winston `logger.info/warn/error` on all operations
   - Returns `{ success, data, error, meta }` shape

5. **Route file** in `backend/src/routes/$RESOURCE_NAME-routes.ts`
   - Full CRUD routes with Zod validation middleware
   - Export `router` as default

6. **Register route** in `backend/src/app.ts`:
   ```typescript
   app.use('/api/v1/$RESOURCE_NAME', $RESOURCE_NAMERouter);
   ```

## Follow These Standards
- Soft delete only — never hard delete
- All list endpoints paginated with meta
- All async handlers use `asyncHandler`
- Import Zod schemas from `shared/` — not locally
- Log every operation with context (`id`, `action`)
