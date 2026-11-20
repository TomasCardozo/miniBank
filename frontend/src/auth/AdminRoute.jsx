import { Navigate, Outlet, useLocation } from 'react-router';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { useAuth } from './useAuth';

export default function AdminRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <Loading />;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (auth.error && !auth.user) {
    return <ErrorMessage error={auth.error} />;
  }

  if (auth.user?.role !== 'ADMIN') {
    return <Navigate to="/me" replace />;
  }

  return <Outlet />;
}
