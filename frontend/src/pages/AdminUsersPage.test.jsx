import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminUsers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminUsersPage from './AdminUsersPage';

vi.mock('../api/adminApi', () => ({
  getAdminUsers: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const emptyPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

describe('AdminUsersPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the first page with the default filters', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue(emptyPage);

    renderPage();

    await waitFor(() =>
      expect(getAdminUsers).toHaveBeenCalledWith('token', {
        role: '',
        status: '',
        size: '20',
        sort: 'createdAt,DESC',
        page: 0,
      })
    );
    expect(screen.getByRole('link', { name: '← Volver a admin' })).toHaveAttribute('href', '/admin');
  });

  it('applies the filters from the URL', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue(emptyPage);

    renderPage('/admin/users?status=BLOCKED&ignored=x');

    await waitFor(() =>
      expect(getAdminUsers).toHaveBeenCalledWith('token', {
        role: '',
        status: 'BLOCKED',
        size: '20',
        sort: 'createdAt,DESC',
        page: 0,
      })
    );
    expect(screen.getByLabelText('Estado')).toHaveValue('BLOCKED');
  });

  it('renders user rows with Spanish labels and a detail link', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue(page([user(), user({ id: 'user-2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', role: 'ADMIN', status: 'BLOCKED' })]));

    renderPage();

    const row = (await screen.findByText('Ada Lovelace')).closest('tr');

    expect(within(row).getByText('AL')).toBeInTheDocument();
    expect(within(row).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(row).getByText('12345678')).toBeInTheDocument();
    expect(within(row).getByText('Cliente')).toBeInTheDocument();
    expect(within(row).getByText('Activo')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Ver detalle de Ada Lovelace' })).toHaveAttribute('href', '/admin/users/user-1');
    expect(within(row).getByRole('link', { name: 'Ver cuentas de Ada Lovelace' })).toHaveAttribute(
      'href',
      '/admin/accounts/actions?userId=user-1'
    );

    const adminRow = screen.getByText('Grace Hopper').closest('tr');
    expect(within(adminRow).getByText('Administrador')).toBeInTheDocument();
    expect(within(adminRow).getByText('Bloqueado')).toBeInTheDocument();

    expect(screen.getByText('2 usuarios · Rol: Todos · Estado: Todos')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1. Total: 2')).toBeInTheDocument();
  });

  it('requests the next page when pagination advances', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue({ ...page([user()]), totalElements: 25, totalPages: 2 });

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 1 })));
  });

  it('applies filters and resets the query to the first page', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue({ ...page([user()]), totalElements: 25, totalPages: 2 });

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 1 })));

    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'ADMIN');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'BLOCKED');
    await userEvent.selectOptions(screen.getByLabelText('Orden'), 'lastName,ASC');
    await userEvent.selectOptions(screen.getByLabelText('Tamaño de página'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(getAdminUsers).toHaveBeenLastCalledWith('token', {
        role: 'ADMIN',
        status: 'BLOCKED',
        size: '50',
        sort: 'lastName,ASC',
        page: 0,
      })
    );
    expect(await screen.findByText('25 usuarios · Rol: Administrador · Estado: Bloqueado')).toBeInTheDocument();
  });

  it('shows an empty state that clears the filters', async () => {
    mockAuth();
    getAdminUsers.mockResolvedValue(emptyPage);

    renderPage();
    await screen.findByText('No hay usuarios con estos filtros.');

    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith('token', expect.objectContaining({ role: 'ADMIN' })));

    const emptyState = (await screen.findByText('No hay usuarios con estos filtros.')).parentElement;
    await userEvent.click(within(emptyState).getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(getAdminUsers).toHaveBeenLastCalledWith('token', expect.objectContaining({ role: '', page: 0 })));
    expect(screen.getByLabelText('Rol')).toHaveValue('');
  });

  it('shows loading errors', async () => {
    mockAuth();
    getAdminUsers.mockRejectedValue({ status: 500, message: 'Error interno' });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    expect(screen.getByText('Status HTTP: 500')).toBeInTheDocument();
    expect(screen.queryByText('No hay usuarios con estos filtros.')).not.toBeInTheDocument();
  });

  it('shows a permissions message on 403', async () => {
    mockAuth();
    getAdminUsers.mockRejectedValue({ status: 403, message: 'Forbidden' });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tenés permisos de administrador');
    expect(within(alert).getByRole('link', { name: 'Ir al dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByText('Status HTTP: 403')).not.toBeInTheDocument();
  });
});

function renderPage(path = '/admin/users') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminUsersPage />
    </MemoryRouter>
  );
}

function mockAuth() {
  useAuth.mockReturnValue({
    accessToken: 'token',
    user: { role: 'ADMIN' },
    isAuthenticated: true,
    loading: false,
  });
}

function page(content) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
  };
}

function user(overrides = {}) {
  return {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    documentNumber: '12345678',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdAt: '2026-07-27T12:00:00Z',
    updatedAt: '2026-07-28T12:00:00Z',
    ...overrides,
  };
}
