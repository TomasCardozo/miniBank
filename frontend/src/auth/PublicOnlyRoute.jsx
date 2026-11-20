import { Navigate, Outlet } from 'react-router';
import { useAuth } from './useAuth';

export default function PublicOnlyRoute() {
  const auth = useAuth();

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
