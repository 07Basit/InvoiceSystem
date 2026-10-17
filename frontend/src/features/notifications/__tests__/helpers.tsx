import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/confirm';
import type { NotificationDto } from 'shared';

export const make = (over: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 'n1', type: 'success', category: 'invoice', title: 'Invoice INV-1 created', message: 'INV-1 for ABC, USD 100.00',
  details: [{ label: 'Invoice No', value: 'INV-1' }, { label: 'Total', value: 'USD 100.00' }],
  link: '/invoices/inv1', linkLabel: 'Open invoice', actorName: 'Basit', readAt: null, createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), ...over,
});

export const page = (items: NotificationDto[], over: Record<string, unknown> = {}) => ({
  success: true, data: items, error: null,
  meta: { page: 1, limit: 10, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / 10)), hasNext: false, hasPrev: false, ...over },
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

// The page under test lives at /start so that navigating anywhere else lands on the "where am I" probe.
export function renderWithApp(ui: ReactElement, { route = '/start', path = '/start' }: { route?: string; path?: string } = {}): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
