import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminTransfers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminTransfersPage from './AdminTransfersPage';

vi.mock('../api/adminApi', () => ({
  getAdminTransfers: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const DEFAULT_QUERY = {
  status: '',
  from: '',
  to: '',
  accountId: '',
  size: '20',
  sort: 'createdAt,DESC',
  page: 0,
};

const emptyPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

describe('AdminTransfersPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the first page with default filters', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(emptyPage);

    renderPage();

    await waitFor(() => expect(getAdminTransfers).toHaveBeenCalledWith('token', DEFAULT_QUERY));
    expect(screen.getByRole('heading', { level: 1, name: 'Transferencias del sistema' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver auditoría' })).toHaveAttribute('href', '/admin/audit-logs');
    expect(screen.getByRole('link', { name: 'Volver a admin' })).toHaveAttribute('href', '/admin');
  });

  it('applies the filters from the URL', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(emptyPage);

    renderPage('/admin/transfers?status=REJECTED&from=2026-11-18T10%3A00');

    await waitFor(() =>
      expect(getAdminTransfers).toHaveBeenCalledWith('token', { ...DEFAULT_QUERY, status: 'REJECTED', from: '2026-11-18T10:00' })
    );
  });

  it('renders rows with a short id, spanish status and failure reason', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(page([transfer({ status: 'REJECTED', failureReason: 'Límite excedido' })], { totalElements: 134 }));

    renderPage();

    const row = (await screen.findAllByRole('row'))[1];
    expect(within(row).getByText('3f2a9c1d…')).toHaveAttribute('title', '3f2a9c1d-0000-4000-8000-000000000001');
    expect(within(row).getByText('Rechazada')).toHaveClass('ds-badge-danger');
    expect(within(row).getByText('Límite excedido')).toBeInTheDocument();
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('134 transferencias')).toBeInTheDocument();
    expect(within(row).queryByText('REJECTED')).not.toBeInTheDocument();
  });

  it('shows pagination and requests the next page', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(page([transfer()], { totalElements: 25, totalPages: 2 }));

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getAdminTransfers).toHaveBeenLastCalledWith('token', { ...DEFAULT_QUERY, page: 1 }));
  });

  it('shows an empty state', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(emptyPage);

    renderPage();

    expect(await screen.findByText('No hay transferencias para los filtros aplicados.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpiar filtros' })).toHaveLength(1);
  });

  it('shows loading errors while keeping filters usable', async () => {
    mockAuth();
    getAdminTransfers.mockRejectedValue({ status: 500, message: 'Error interno' });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeEnabled();
  });

  it('shows a permissions message on 403', async () => {
    mockAuth();
    getAdminTransfers.mockRejectedValue({ status: 403, message: 'Forbidden' });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tenés permisos de administrador');
    expect(within(alert).getByRole('link', { name: 'Ver mi usuario' })).toHaveAttribute('href', '/me');
  });

  it('applies filters and resets to the first page', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(page([transfer()], { totalElements: 25, totalPages: 2 }));

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(getAdminTransfers).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 1 })));

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');
    await userEvent.type(screen.getByLabelText('Cuenta (UUID)'), 'account-uuid');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(getAdminTransfers).toHaveBeenLastCalledWith('token', {
        ...DEFAULT_QUERY,
        status: 'COMPLETED',
        accountId: 'account-uuid',
        page: 0,
      })
    );
  });

  it('filters by the source account when its number is clicked and clears it from the chip', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValue(page([transfer()], { totalElements: 25, totalPages: 2 }));

    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Estado'), 'PENDING');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(getAdminTransfers).toHaveBeenLastCalledWith('token', expect.objectContaining({ status: 'PENDING' })));

    await userEvent.click(await screen.findByRole('button', { name: 'Filtrar por cuenta origen 000001000001' }));

    await waitFor(() =>
      expect(getAdminTransfers).toHaveBeenLastCalledWith('token', {
        ...DEFAULT_QUERY,
        status: 'PENDING',
        accountId: 'source-account-id',
        page: 0,
      })
    );
    expect(screen.getByLabelText('Cuenta (UUID)')).toHaveValue('source-account-id');
    expect(screen.getByText('Filtro activo:')).toBeInTheDocument();
    expect(screen.getByTitle('source-account-id')).toHaveTextContent('cuenta 000001000001');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtro de cuenta' }));

    await waitFor(() =>
      expect(getAdminTransfers).toHaveBeenLastCalledWith('token', {
        ...DEFAULT_QUERY,
        status: 'PENDING',
        page: 0,
      })
    );
    expect(screen.queryByText('Filtro activo:')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta (UUID)')).toHaveValue('');
  });

  it('keeps the table and pagination visible while reloading', async () => {
    mockAuth();
    getAdminTransfers.mockResolvedValueOnce(page([transfer()], { totalElements: 25, totalPages: 2 }));
    getAdminTransfers.mockReturnValueOnce(new Promise(() => {}));

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Cargando...');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});

function renderPage(path = '/admin/transfers') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminTransfersPage />
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

function page(content, overrides = {}) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    ...overrides,
  };
}

function transfer(overrides = {}) {
  return {
    id: '3f2a9c1d-0000-4000-8000-000000000001',
    sourceAccountId: 'source-account-id',
    sourceAccountNumber: '000001000001',
    targetAccountId: 'target-account-id',
    targetAccountNumber: '000001000002',
    amount: 1500,
    currency: 'ARS',
    status: 'COMPLETED',
    description: 'Pago',
    createdAt: '2026-07-28T10:30:00Z',
    failureReason: null,
    ...overrides,
  };
}
