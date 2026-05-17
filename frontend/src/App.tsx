import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const InvoicesPage = lazy(() => import('@/features/invoices/pages/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/pages/InvoiceDetailPage'));
const ImportersPage = lazy(() => import('@/features/clients/pages/ClientsPage'));
const DocumentsPage = lazy(() => import('@/features/documents/pages/DocumentsPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'importers', element: <ImportersPage /> },
      { path: 'documents', element: <DocumentsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
