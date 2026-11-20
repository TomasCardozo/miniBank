import { Navigate, Outlet, useLocation } from 'react-router';
import Loading from '../components/Loading';
import { useAuth } from './useAuth';

export default function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <Loading />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
