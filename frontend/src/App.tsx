import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import { useAuthStore } from '@/features/auth/store/authStore';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const ProfilePage = lazy(() => import('@/features/auth/pages/ProfilePage'));
const ProductsPage = lazy(() => import('@/features/products/pages/ProductsPage'));
const ProductListPage = lazy(() => import('@/features/products/pages/ProductListPage'));
const ExporterPage = lazy(() => import('@/features/exporter/pages/ExporterPage'));
const InvoicesPage = lazy(() => import('@/features/invoices/pages/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('@/features/invoices/pages/InvoiceDetailPage'));
const ImportersPage = lazy(() => import('@/features/clients/pages/ClientsPage'));
const DocumentsPage = lazy(() => import('@/features/documents/pages/DocumentsPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const RecycleBinPage = lazy(() => import('@/features/recycle-bin/pages/RecycleBinPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'));
const NotificationDetailPage = lazy(() => import('@/features/notifications/pages/NotificationDetailPage'));

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'invoices', element: <InvoicesPage /> },
          { path: 'invoices/:id', element: <InvoiceDetailPage /> },
          { path: 'importers', element: <ImportersPage /> },
          { path: 'exporter', element: <ExporterPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'products/:listId', element: <ProductListPage /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'recycle-bin', element: <RecycleBinPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'notifications/:id', element: <NotificationDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
