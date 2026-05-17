---
description: "Use when designing or implementing REST API endpoints, request/response schemas, pagination, filtering, or API versioning for the Invoice Management System backend."
applyTo: "backend/src/routes/**"
---

# API Design Guidelines

## URL Structure
```
/api/v1/<resource>
/api/v1/<resource>/:id
/api/v1/<resource>/:id/<sub-resource>
```

## HTTP Methods
| Action | Method | Path | Status |
|---|---|---|---|
| List all | GET | `/api/v1/invoices` | 200 |
| Get one | GET | `/api/v1/invoices/:id` | 200 |
| Create | POST | `/api/v1/invoices` | 201 |
| Full update | PUT | `/api/v1/invoices/:id` | 200 |
| Partial update | PATCH | `/api/v1/invoices/:id` | 200 |
| Delete (soft) | DELETE | `/api/v1/invoices/:id` | 200 |
| Download PDF | GET | `/api/v1/invoices/:id/download/pdf` | 200 |
| Download Excel | GET | `/api/v1/invoices/:id/download/excel` | 200 |
| Bulk import | POST | `/api/v1/invoices/import` | 200 |
| Export all | GET | `/api/v1/invoices/export` | 200 |

## List Endpoints — Required Query Params
All `GET /api/v1/<resource>` list endpoints MUST support:
```
?page=1          # default: 1
?limit=20        # default: 20, max: 100
?search=keyword  # search across relevant fields
?sort=createdAt  # field to sort by
?order=desc      # asc | desc (default: desc)
?filter[status]=paid  # field-level filters
```

## Pagination Response Meta
```typescript
{
  success: true,
  data: Invoice[],
  error: null,
  meta: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8,
    hasNext: true,
    hasPrev: false,
  }
}
```

## Error Response Codes
| Scenario | Status | Code |
|---|---|---|
| Validation error | 400 | `VALIDATION_ERROR` |
| Not found | 404 | `<RESOURCE>_NOT_FOUND` |
| Conflict (duplicate) | 409 | `<RESOURCE>_EXISTS` |
| Unauthenticated | 401 | `UNAUTHORIZED` |
| Forbidden | 403 | `FORBIDDEN` |
| Server error | 500 | `INTERNAL_ERROR` |

## File Download Endpoints
```typescript
// Always set correct headers for file downloads
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
res.send(pdfBuffer);
```

## API Resources for This Project
```
/api/v1/invoices          # Invoice CRUD + actions
/api/v1/clients           # Client management
/api/v1/products          # Products/line items catalog
/api/v1/pdf               # PDF editor operations
/api/v1/documents         # Word document management
/api/v1/dashboard         # Dashboard stats/analytics (read-only)
/api/v1/auth              # Authentication (future)
```
