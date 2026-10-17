import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <LoadingSpinner fullScreen />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
