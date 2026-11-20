import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from '../api/accountsApi';
import { useAuth } from '../auth/useAuth';
import MePage from './MePage';

vi.mock('../api/accountsApi', () => ({
  getAccounts: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('MePage', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the user identity with translated status and role', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([]);

    renderMePage();

    const hero = screen.getByRole('region', { name: 'Resumen del usuario' });

    expect(screen.getByRole('heading', { level: 1, name: 'Mi usuario' })).toBeInTheDocument();
    expect(within(hero).getByText('Alice Customer')).toBeInTheDocument();
    expect(within(hero).getByText('AC')).toBeInTheDocument();
    expect(within(hero).getByText('Activo')).toBeInTheDocument();
    expect(within(hero).getByText('Cliente')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Datos tecnicos')).getByText('user-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    expect(await screen.findByText('Todavia no tenes cuentas')).toBeInTheDocument();
  });

  it('summarizes the customer accounts in the accesses', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([{ status: 'ACTIVE' }, { status: 'BLOCKED' }, { status: 'ACTIVE' }]);

    renderMePage();

    const accesses = screen.getByRole('navigation', { name: 'Accesos del usuario' });

    expect(await within(accesses).findByText('3 cuentas · 1 bloqueada')).toBeInTheDocument();
    expect(within(accesses).getByRole('link', { name: /Mis cuentas/ })).toHaveAttribute('href', '/accounts');
  });

  it('keeps a generic description when the accounts cannot be loaded', async () => {
    mockAuth();
    getAccounts.mockRejectedValue(new Error('boom'));

    renderMePage();

    expect(await screen.findByText('Saldos y movimientos')).toBeInTheDocument();
  });

  it('shows the admin accesses without loading accounts', () => {
    mockAuth({ role: 'ADMIN' });

    renderMePage();

    const accesses = screen.getByRole('navigation', { name: 'Accesos del usuario' });

    expect(within(accesses).getByRole('link', { name: /Usuarios/ })).toHaveAttribute('href', '/admin/users');
    expect(within(accesses).getByRole('link', { name: /Auditoria/ })).toHaveAttribute('href', '/admin/audit-logs');
    expect(within(screen.getByRole('region', { name: 'Resumen del usuario' })).getByText('Administrador')).toBeInTheDocument();
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it('copies the personal data', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([]);
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderMePage();

    await userEvent.click(screen.getByRole('button', { name: 'Copiar todo' }));

    expect(writeText).toHaveBeenCalledWith('Nombre: Alice Customer\nEmail: alice@minibank.local\nDocumento: 90000002');
    expect(await screen.findByText('Copiamos tus datos al portapapeles.')).toBeInTheDocument();
  });

  it('shows an error when the user could not be loaded', () => {
    useAuth.mockReturnValue({ accessToken: 'token-1', user: null, loading: false, error: new Error('Sesion invalida') });

    renderMePage();

    expect(screen.getByText('No se pudieron cargar los datos del usuario.')).toBeInTheDocument();
  });

  function renderMePage() {
    return render(
      <MemoryRouter initialEntries={['/me']}>
        <MePage />
      </MemoryRouter>,
    );
  }

  function mockAuth(overrides = {}) {
    useAuth.mockReturnValue({
      accessToken: 'token-1',
      loading: false,
      error: null,
      user: {
        id: 'user-1',
        firstName: 'Alice',
        lastName: 'Customer',
        email: 'alice@minibank.local',
        documentNumber: '90000002',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: '2026-07-28T23:11:38Z',
        ...overrides,
      },
    });
  }
});
