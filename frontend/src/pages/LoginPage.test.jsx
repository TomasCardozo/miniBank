import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/useAuth';
import LoginPage from './LoginPage';

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('LoginPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('redirects to dashboard after a successful login', async () => {
    const login = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesion' }));

    expect(login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'password123' });
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows a short invalid credentials message for login 401 errors', async () => {
    const login = vi.fn().mockRejectedValue({
      status: 401,
      message: 'Invalid email or password',
      code: 'UNAUTHORIZED',
      path: '/auth/login',
      details: {
        timestamp: '2026-08-01T13:54:22.875722Z',
        status: 401,
        fieldErrors: [],
      },
    });
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesion' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales Incorrectas');
    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
    expect(screen.queryByText(/Status HTTP:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Codigo:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Path:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Detalle:')).not.toBeInTheDocument();
  });

  it('shows a spinner in place of the submit button while login is loading', async () => {
    const login = vi.fn(() => new Promise(() => {}));
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesion' }));

    expect(screen.queryByRole('button', { name: 'Iniciar sesion' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Iniciando sesion' })).toBeInTheDocument();
  });

  it('shows the submit button again when login fails', async () => {
    const login = vi.fn().mockRejectedValue({ status: 401 });
    useAuth.mockReturnValue({ login });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesion' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesion' })).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales Incorrectas');
  });
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
      </Routes>
    </MemoryRouter>
  );
}
