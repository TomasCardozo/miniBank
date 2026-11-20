import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser, loginUser, registerUser } from '../api/authApi';
import { setUnauthorizedHandler } from '../api/client';
import AuthProvider from './AuthProvider';
import { useAuth } from './useAuth';

vi.mock('../api/authApi', () => ({
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}));

const TOKEN_STORAGE_KEY = 'minibank.accessToken';

describe('AuthProvider', () => {
  afterEach(() => {
    localStorage.clear();
    setUnauthorizedHandler(null);
    vi.resetAllMocks();
  });

  it('loads the current user from a persisted token', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'ada@example.com', role: 'CUSTOMER' });

    renderAuthProvider();

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(getCurrentUser).toHaveBeenCalledWith('stored-token');
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('token')).toHaveTextContent('stored-token');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
  });

  it('clears the persisted token when loading the current user returns 401', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    getCurrentUser.mockRejectedValue({ status: 401, message: 'Unauthorized' });

    renderAuthProvider();

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('anonymous'));
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('keeps non-401 load errors visible without clearing the token', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    getCurrentUser.mockRejectedValue({ status: 500, message: 'Backend caido' });

    renderAuthProvider();

    expect(await screen.findByText('Backend caido')).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('stored-token');
  });

  it('saves session data after login', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'ada@example.com', role: 'CUSTOMER' });
    loginUser.mockResolvedValue({
      accessToken: 'login-token',
      user: { id: 'user-1', email: 'ada@example.com', role: 'CUSTOMER' },
    });

    renderAuthProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    expect(loginUser).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'password123' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('login-token');
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
  });

  it('saves session data after register', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'new@example.com', role: 'CUSTOMER' });
    registerUser.mockResolvedValue({
      accessToken: 'register-token',
      user: { id: 'user-1', email: 'new@example.com', role: 'CUSTOMER' },
    });

    renderAuthProvider();
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(registerUser).toHaveBeenCalledWith({ email: 'new@example.com', password: 'password123' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('register-token');
    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
  });

  it('clears session data on logout', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stored-token');
    getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'ada@example.com', role: 'CUSTOMER' });

    renderAuthProvider();
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('authenticated')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });
});

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>
  );
}

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <p data-testid="loading">{auth.loading ? 'loading' : 'idle'}</p>
      <p data-testid="authenticated">{auth.isAuthenticated ? 'authenticated' : 'anonymous'}</p>
      <p data-testid="token">{auth.accessToken || 'no-token'}</p>
      <p data-testid="user">{auth.user?.email || 'no-user'}</p>
      {auth.error ? <p>{auth.error.message}</p> : null}
      <button type="button" onClick={() => auth.login({ email: 'ada@example.com', password: 'password123' })}>
        Login
      </button>
      <button type="button" onClick={() => auth.register({ email: 'new@example.com', password: 'password123' })}>
        Register
      </button>
      <button type="button" onClick={auth.logout}>
        Logout
      </button>
    </div>
  );
}
