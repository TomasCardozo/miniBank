import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import AdminRoute from './AdminRoute';
import { AuthContext } from './useAuth';

describe('AdminRoute', () => {
  it('redirects anonymous users to login', () => {
    renderAdminRoute({ loading: false, isAuthenticated: false, user: null });

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects customer users to me', () => {
    renderAdminRoute({ loading: false, isAuthenticated: true, user: { role: 'CUSTOMER' } });

    expect(screen.getByText('Me page')).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  it('renders admin routes for admin users', () => {
    renderAdminRoute({ loading: false, isAuthenticated: true, user: { role: 'ADMIN' } });

    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });

  it('shows auth errors when there is no loaded user', () => {
    renderAdminRoute({
      loading: false,
      isAuthenticated: true,
      user: null,
      error: { status: 403, message: 'No tiene permisos' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos');
  });
});

function renderAdminRoute(authValue) {
  return render(
    <AuthContext.Provider value={{ error: null, accessToken: null, ...authValue }}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<p>Admin page</p>} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/me" element={<p>Me page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}
