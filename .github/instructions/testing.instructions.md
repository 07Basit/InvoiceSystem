---
description: "Use when writing tests for frontend (Vitest/React Testing Library) or backend (Jest/Supertest). Covers test structure, naming, mocking, and coverage expectations for the Invoice Management System."
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx"
---

# Testing Guidelines

## Frontend Tests — Vitest + React Testing Library

### What to Test
- Component rendering with different props/states
- User interactions (click, type, submit)
- TanStack Query integration (use `wrapper` with `QueryClient`)
- Error boundary behavior
- Custom hooks with `renderHook`

### Test File Location
Co-locate tests with the component:
```
features/invoices/components/InvoiceCard.tsx
features/invoices/components/InvoiceCard.test.tsx
```

### Test Structure
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InvoiceCard from './InvoiceCard';

const mockInvoice: Invoice = {
  id: '1',
  invoiceNumber: 'INV-001',
  status: 'DRAFT',
  total: 1500.00,
  client: { name: 'Acme Corp' },
};

describe('InvoiceCard', () => {
  it('renders invoice number and client name', () => {
    render(<InvoiceCard invoice={mockInvoice} onEdit={vi.fn()} />);
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('calls onEdit with invoice id when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<InvoiceCard invoice={mockInvoice} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});
```

## Backend Tests — Jest + Supertest

### What to Test
- Controller endpoints (integration tests via Supertest)
- Service logic (unit tests with mocked Prisma)
- Middleware (validation, error handling)
- Utility functions

### Test File Location
```
backend/src/controllers/__tests__/invoice.controller.test.ts
backend/src/services/__tests__/invoice.service.test.ts
```

### Integration Test Structure
```typescript
import request from 'supertest';
import app from '../../app';
import { prismaMock } from '../../__mocks__/prisma';

describe('POST /api/v1/invoices', () => {
  it('creates an invoice and returns 201', async () => {
    prismaMock.invoice.create.mockResolvedValue(mockInvoice);

    const response = await request(app)
      .post('/api/v1/invoices')
      .send(validInvoicePayload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.invoiceNumber).toBe('INV-001');
  });

  it('returns 400 for invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .send({ invoiceNumber: '' }) // invalid
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Prisma Mocking
- Use `jest-mock-extended` with a singleton Prisma mock
- Mock at the service layer — don't hit the real database in unit/integration tests
- Use a separate test DB (via `DATABASE_URL_TEST`) for e2e tests only

## Naming Conventions
- Test files: `<Component>.test.tsx` or `<module>.test.ts`
- Test blocks: `describe` = unit under test, `it` = plain English behavior description
- Use `it('does X when Y')` format — readable without code context

## Coverage Targets
- Controllers: 80%+ line coverage
- Services: 90%+ line coverage
- Critical paths (invoice create/edit/download): 100% coverage
- Run coverage: `npm run test:coverage`
