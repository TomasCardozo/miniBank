import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicOnlyRoute from './PublicOnlyRoute';
import SessionRedirect from './SessionRedirect';
import { useAuth } from './useAuth';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<SessionRedirect />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>Login</p>} />
          <Route path="/register" element={<p>Registro</p>} />
        </Route>
        <Route path="/dashboard" element={<p>Dashboard</p>} />
        <Route path="*" element={<SessionRedirect />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('session-based redirects', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['/', '/no-existe'])('sends %s to the login page without a session', (path) => {
    useAuth.mockReturnValue({ isAuthenticated: false });

    renderAt(path);

    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it.each(['/', '/no-existe', '/login', '/register'])('sends %s to the dashboard with an active session', (path) => {
    useAuth.mockReturnValue({ isAuthenticated: true });

    renderAt(path);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('keeps login and register available without a session', () => {
    useAuth.mockReturnValue({ isAuthenticated: false });

    renderAt('/register');

    expect(screen.getByText('Registro')).toBeInTheDocument();
  });
});
