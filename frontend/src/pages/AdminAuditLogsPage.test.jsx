import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminAuditLogs } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminAuditLogsPage from './AdminAuditLogsPage';

vi.mock('../api/adminApi', () => ({
  getAdminAuditLogs: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const USER_ID = '11111111-2222-4333-8444-555555555555';
const ENTITY_ID = '7f3e9a10-0000-4000-8000-000000000001';

const DEFAULT_QUERY = {
  userId: '',
  action: '',
  entityType: '',
  entityId: '',
  from: '',
  to: '',
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

describe('AdminAuditLogsPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the first page with the default query', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage();

    await waitFor(() => expect(getAdminAuditLogs).toHaveBeenCalledWith('token', DEFAULT_QUERY));
    expect(screen.getByRole('heading', { level: 1, name: 'Logs de auditoría' })).toBeInTheDocument();
  });

  it('applies the filters from the URL', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage(`/admin/audit-logs?entityType=ACCOUNT&entityId=${ENTITY_ID}`);

    await waitFor(() =>
      expect(getAdminAuditLogs).toHaveBeenCalledWith('token', { ...DEFAULT_QUERY, entityType: 'ACCOUNT', entityId: ENTITY_ID })
    );
    expect(screen.getByText('· Entidad: Cuenta')).toBeInTheDocument();
    expect(screen.getByText('· ID entidad: 7f3e9a10…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Listado' })).not.toBeInTheDocument();
  });

  it('renders rows with toned action badges, short ids and parsed details', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue({
      content: [
        auditLog('log-1', {
          action: 'ACCOUNT_CREDITED',
          entityType: 'ACCOUNT',
          details: `accountId=${ENTITY_ID},userId=${USER_ID},amount=500,previousBalance=100,newBalance=600`,
        }),
        auditLog('log-2', { action: 'LOGIN_FAILURE', entityType: 'AUTH', details: 'Invalid credentials' }),
        auditLog('log-3', {
          action: 'ACCOUNT_BLOCKED',
          entityType: 'ACCOUNT',
          details: `accountId=${ENTITY_ID},previousStatus=ACTIVE,newStatus=BLOCKED`,
        }),
        auditLog('log-4', { action: 'TRANSFER_CREATED', entityType: 'TRANSFER', details: null }),
      ],
      page: 0,
      size: 20,
      totalElements: 4,
      totalPages: 1,
    });

    renderPage();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Cuenta acreditada')).toHaveClass('ds-badge', 'ds-badge-success');
    expect(within(table).getByText('Inicio de sesión fallido')).toHaveClass('ds-badge', 'ds-badge-danger');
    expect(within(table).getByText('Cuenta bloqueada')).toHaveClass('ds-badge', 'ds-badge-warning');
    const neutralBadge = within(table).getByText('Transferencia creada');
    expect(neutralBadge).toHaveClass('ds-badge');
    expect(neutralBadge.className).not.toMatch(/ds-badge-(success|danger|warning)/);
    expect(within(table).getByText('ACCOUNT_CREDITED')).toBeInTheDocument();

    expect(within(table).getAllByRole('button', { name: `Copiar el ID de usuario ${USER_ID}` })).toHaveLength(4);
    expect(within(table).getAllByText('11111111…').length).toBeGreaterThanOrEqual(4);
    expect(within(table).getByText('Invalid credentials')).toBeInTheDocument();
    expect(within(table).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(table).getByText('BLOCKED')).toBeInTheDocument();
    expect(within(table).getByText('Ver todo')).toBeInTheDocument();
    expect(screen.getByText('4 eventos')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1. Total: 4')).toBeInTheDocument();
  });

  it('offers ACCOUNT_CREDITED as an action filter', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage();

    const actionSelect = await screen.findByLabelText('Acción');
    expect(within(actionSelect).getByRole('option', { name: 'Cuenta acreditada' })).toHaveValue('ACCOUNT_CREDITED');
  });

  it('applies filters and resets to the first page', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage();
    await screen.findByText('No hay eventos con estos filtros.');

    await userEvent.selectOptions(screen.getByLabelText('Acción'), 'ACCOUNT_CREDITED');
    await userEvent.selectOptions(screen.getByLabelText('Tipo de entidad'), 'ACCOUNT');
    await userEvent.type(screen.getByLabelText('Usuario (UUID)'), USER_ID);
    await userEvent.selectOptions(screen.getByLabelText('Orden'), 'action,ASC');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token', {
        ...DEFAULT_QUERY,
        userId: USER_ID,
        action: 'ACCOUNT_CREDITED',
        entityType: 'ACCOUNT',
        sort: 'action,ASC',
      })
    );
  });

  it('does not request the API with a malformed UUID', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage();
    await screen.findByText('No hay eventos con estos filtros.');

    await userEvent.type(screen.getByLabelText('Entidad (UUID)'), 'not-a-uuid');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(getAdminAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state with a clear-filters action when filters are applied', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue(emptyPage);

    renderPage();
    expect(await screen.findByText('No hay eventos con estos filtros.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Acción'), 'LOGIN_FAILURE');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token', DEFAULT_QUERY));
    expect(screen.getByLabelText('Acción')).toHaveValue('');
  });

  it('shows API errors', async () => {
    mockAuth();
    getAdminAuditLogs.mockRejectedValue({ status: 500, message: 'Error interno' });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a permissions message on 403', async () => {
    mockAuth();
    getAdminAuditLogs.mockRejectedValue({ status: 403, message: 'Forbidden' });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tenés permisos de administrador');
    expect(alert).not.toHaveTextContent('Forbidden');
  });

  it('requests the next page when pagination advances', async () => {
    mockAuth();
    getAdminAuditLogs.mockResolvedValue({
      content: [auditLog('log-1')],
      page: 0,
      size: 20,
      totalElements: 25,
      totalPages: 2,
    });

    renderPage();
    await screen.findByText('Página 1 de 2. Total: 25');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token', { ...DEFAULT_QUERY, page: 1 }));
  });
});

function renderPage(path = '/admin/audit-logs') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminAuditLogsPage />
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

function auditLog(id, overrides = {}) {
  return {
    id,
    userId: USER_ID,
    action: 'LOGIN_SUCCESS',
    entityType: 'AUTH',
    entityId: ENTITY_ID,
    details: 'Login successful',
    ipAddress: '127.0.0.1',
    createdAt: '2026-11-19T10:02:00Z',
    ...overrides,
  };
}
