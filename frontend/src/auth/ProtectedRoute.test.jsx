import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthContext } from './useAuth';
import ProtectedRoute from './ProtectedRoute';

describe('ProtectedRoute', () => {
  it('shows loading while auth is loading', () => {
    renderProtectedRoute({ loading: true, isAuthenticated: false });

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('redirects anonymous users to login', () => {
    renderProtectedRoute({ loading: false, isAuthenticated: false });

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
  });

  it('renders the protected outlet for authenticated users', () => {
    renderProtectedRoute({ loading: false, isAuthenticated: true });

    expect(screen.getByText('Private page')).toBeInTheDocument();
  });
});

function renderProtectedRoute(authValue) {
  return render(
    <AuthContext.Provider value={{ user: null, error: null, accessToken: null, ...authValue }}>
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Private page</p>} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}
