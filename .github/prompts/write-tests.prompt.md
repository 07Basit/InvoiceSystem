---
description: "Write tests for a frontend component or backend endpoint in the Invoice Management System — covers unit tests, integration tests, and edge cases"
---

Write comprehensive tests for: `$TARGET` (component name, endpoint, or service method)

## Information Needed
- Is this a **frontend component** or **backend endpoint/service**?
- File path of the source code to test
- Known edge cases or error scenarios to cover

## What to Generate

### If Frontend Component (`$TARGET.tsx`)
Test file: `$TARGET.test.tsx` (co-located)

Cover:
- Renders correctly with default/minimal props
- Renders correctly with all props populated
- User interactions (click, input, form submit)
- Loading state (while TanStack Query is fetching)
- Error state (when query fails)
- Empty state (no data)
- Form validation messages appear on invalid submit

Use:
- `renderWithQuery` wrapper from `__tests__/utils/render.tsx`
- `vi.fn()` for callback props
- `screen.getByRole` / `getByLabelText` — NOT `getByTestId`
- `userEvent` from `@testing-library/user-event` for realistic interactions

### If Backend Endpoint (`POST /api/v1/$RESOURCE`)
Test file: `backend/src/controllers/__tests__/$RESOURCE.controller.test.ts`

Cover:
- 201/200 success with valid payload
- 400 validation error with missing required fields
- 400 validation error with invalid field types
- 404 when resource not found (for GET/PUT/DELETE)
- 409 conflict if duplicate (where applicable)
- Soft delete returns 200 and hides record from subsequent GET

Use:
- `supertest` against the Express `app`
- `prismaMock` from `__mocks__/prisma.ts`
- Test data factories from `__tests__/factories/`

### If Backend Service Method
Test file: `backend/src/services/__tests__/$RESOURCE.service.test.ts`

Cover:
- Returns correct data on success
- Throws `AppError` with correct status/code on failure
- Calls Prisma with correct arguments (verify mock call args)
- Applies soft-delete filter on list/get queries
- Uses transaction for multi-table writes

## Test Naming Format
```typescript
describe('$TARGET', () => {
  describe('when valid data is provided', () => {
    it('creates the resource and returns 201', ...);
  });
  describe('when required fields are missing', () => {
    it('returns 400 with VALIDATION_ERROR code', ...);
  });
});
```

## Coverage Goal
All generated tests should reach **90%+ line coverage** on the target file.
