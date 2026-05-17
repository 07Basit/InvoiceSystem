---
description: "Use when creating Prisma schema models, migrations, queries, or database-related code. Covers schema design, indexing, soft-delete pattern, and Prisma best practices for the Invoice Management System."
applyTo: "backend/src/prisma/**"
---

# Database Guidelines

## Prisma Schema Conventions

### Naming
- Model names: **PascalCase singular** (`Invoice`, `Client`, `LineItem`)
- Field names: **camelCase** (`createdAt`, `invoiceNumber`, `clientId`)
- Table names: **snake_case plural** (set via `@@map("invoices")`)
- Enum names: **PascalCase** (`InvoiceStatus`, `DocumentType`)

### Required Fields on Every Model
```prisma
model Invoice {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime? // Soft-delete — never hard delete

  // ... other fields
}
```

### Soft Delete — Always Use
- **Never** use `DELETE` in Prisma queries for user-owned data
- Set `deletedAt` on delete operations
- Filter `deletedAt: null` on all read queries
- Add a global Prisma middleware or helper to enforce this

### Indexing Rules
- Always index foreign key fields: `@@index([clientId])`
- Index fields used in `WHERE` clauses frequently: `@@index([status])`, `@@index([invoiceNumber])`
- Unique constraints where business logic requires: `@@unique([invoiceNumber])`
- Compound indexes for common filter combinations: `@@index([status, deletedAt])`

## Core Schema (Reference)

```prisma
model Client {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  phone     String?
  address   String?
  invoices  Invoice[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@map("clients")
  @@index([email])
  @@index([deletedAt])
}

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique
  status        InvoiceStatus @default(DRAFT)
  clientId      String
  client        Client        @relation(fields: [clientId], references: [id])
  lineItems     LineItem[]
  subtotal      Decimal       @db.Decimal(10, 2)
  tax           Decimal       @db.Decimal(10, 2)
  total         Decimal       @db.Decimal(10, 2)
  dueDate       DateTime?
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  @@map("invoices")
  @@index([clientId])
  @@index([status])
  @@index([status, deletedAt])
  @@index([invoiceNumber])
}

model LineItem {
  id          String  @id @default(cuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id])
  description String
  quantity    Decimal @db.Decimal(10, 2)
  unitPrice   Decimal @db.Decimal(10, 2)
  total       Decimal @db.Decimal(10, 2)

  @@map("line_items")
  @@index([invoiceId])
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}
```

## Migration Rules
- **Only** change schema via `prisma migrate dev` — never edit the DB directly
- Migration names should be descriptive: `add_invoice_pdf_url`, `add_client_company_field`
- Test rollback strategy before merging to main
- Never drop columns in the same migration as removing the code that uses them (two-step)

## Query Patterns

```typescript
// ✅ Always filter soft-deleted records
const invoices = await prisma.invoice.findMany({
  where: { deletedAt: null, status: 'PAID' },
  include: { client: true, lineItems: true },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});

// ✅ Soft delete
await prisma.invoice.update({
  where: { id },
  data: { deletedAt: new Date() },
});

// ✅ Use transactions for multi-step operations
await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: invoiceData });
  await tx.lineItem.createMany({ data: lineItems.map(item => ({ ...item, invoiceId: invoice.id })) });
  return invoice;
});
```

## Security
- Never return `deletedAt`, `password`, or internal fields in API responses
- Use Prisma `select` or `omit` to strip sensitive fields before returning
