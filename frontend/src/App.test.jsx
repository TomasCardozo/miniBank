import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useAuth } from './auth/useAuth';

vi.mock('./auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('App routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['/', '/ruta-que-no-existe'])('redirects %s to the login page', (path) => {
    useAuth.mockReturnValue({ isAuthenticated: false, login: vi.fn() });

    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /ingresar|iniciar sesi/i })).toBeInTheDocument();
  });
});
