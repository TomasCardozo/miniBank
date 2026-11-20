import { Navigate } from 'react-router';
import { useAuth } from './useAuth';

export default function SessionRedirect() {
  const auth = useAuth();

  return <Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />;
}
