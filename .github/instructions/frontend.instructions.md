---
description: "Use when creating or editing React components, pages, hooks, stores, or any frontend TypeScript/TSX files. Covers component patterns, state management, styling with TailwindCSS, and shadcn/ui usage for the Invoice Management System."
applyTo: "frontend/**"
---

# Frontend Development Guidelines

## Component Rules
- **Functional components only** — no class components ever
- Always type props explicitly with an interface or type alias
- Use `React.FC<Props>` for components with props
- Co-locate tests alongside the component file in the same folder
- One component per file; filename matches the component name (PascalCase)

```tsx
// ✅ Correct
interface InvoiceCardProps {
  invoice: Invoice;
  onEdit: (id: string) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onEdit }) => {
  return <div>...</div>;
};
export default InvoiceCard;
```

## File Structure per Feature
```
features/invoices/
├── components/       # UI components specific to invoices
├── hooks/            # useInvoices, useInvoiceForm, etc.
├── pages/            # InvoicesPage, InvoiceDetailPage
├── services/         # invoiceService.ts (axios calls)
├── store/            # invoiceStore.ts (Zustand – UI state only)
├── types/            # Invoice types (or import from shared/)
└── utils/            # Invoice-specific helpers
```

## State Management Rules
- **TanStack Query** for ALL server/async state — do not use `useState` + `useEffect` for data fetching
- **Zustand** only for client-side UI state (modals open, filters, sidebar state)
- Never put server data into Zustand stores

```tsx
// ✅ TanStack Query for server state
const { data: invoices, isLoading } = useQuery({
  queryKey: ['invoices', filters],
  queryFn: () => invoiceService.getAll(filters),
});

// ✅ Zustand for UI state only
const { isModalOpen, openModal } = useInvoiceUIStore();
```

## Styling — TailwindCSS + shadcn/ui
- Use TailwindCSS utility classes — no inline styles, no CSS modules unless unavoidable
- Use shadcn/ui components as the base (Button, Dialog, Table, Form, etc.)
- Extend shadcn/ui components; never rewrite them from scratch
- Use `cn()` utility from `lib/utils` for conditional classnames

```tsx
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

<Button className={cn('w-full', isLoading && 'opacity-50')} disabled={isLoading}>
  Save Invoice
</Button>
```

## Forms
- Use **React Hook Form** + **Zod** resolver for all forms
- Import Zod schemas from `shared/` — do not duplicate schema definitions
- Show validation errors inline beneath fields using shadcn/ui `FormMessage`

## Error Handling
- Wrap pages in an `ErrorBoundary` component
- Handle TanStack Query errors with `onError` callbacks or `isError` state
- Display user-friendly error messages — never expose raw error objects to the UI

## Routing
- Use **React Router v6** with `createBrowserRouter`
- Lazy-load page components with `React.lazy` + `Suspense`
- Route paths defined in a central `routes.ts` constants file

## Imports
- Use absolute imports via `@/` alias (configured in `vite.config.ts`)
- Order: React → third-party → internal → styles

## Performance
- Memoize expensive calculations with `useMemo`
- Stabilize callback references with `useCallback` when passed as props
- Virtualize long lists (invoices table) with `@tanstack/react-virtual`
