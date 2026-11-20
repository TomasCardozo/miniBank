import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminAuditLogs, getAdminTransfers, getAdminUsers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminHomePage from './AdminHomePage';

vi.mock('../api/adminApi', () => ({
  getAdminUsers: vi.fn(),
  getAdminTransfers: vi.fn(),
  getAdminAuditLogs: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const NOW = new Date(2026, 10, 19, 15, 30);
const SINCE = '2026-11-18T15:30';

function page(content = [], totalElements = content.length) {
  return { content, page: 0, size: 20, totalElements, totalPages: totalElements > 0 ? 1 : 0 };
}

function mockApis({ blocked = 2, rejected = 3, failedLogins = 1 } = {}) {
  getAdminUsers.mockImplementation((_token, query) => Promise.resolve(page([], query.status === 'BLOCKED' ? blocked : 42)));
  getAdminTransfers.mockImplementation((_token, query) => {
    if (query.status === 'COMPLETED') {
      return Promise.resolve(page([], 12));
    }
    if (query.status === 'REJECTED') {
      return Promise.resolve(page([], rejected));
    }
    return Promise.resolve(
      page([
        {
          id: 'aaaaaaaa-0000-4000-8000-000000000001',
          sourceAccountNumber: '000000000001',
          targetAccountNumber: '000000000003',
          amount: '1500.00',
          currency: 'ARS',
          status: 'REJECTED',
          createdAt: '2026-11-19T12:00:00Z',
        },
      ])
    );
  });
  getAdminAuditLogs.mockImplementation((_token, query) => {
    if (query.action === 'LOGIN_FAILURE') {
      return Promise.resolve(page([], failedLogins));
    }
    return Promise.resolve(
      page([
        {
          id: 'bbbbbbbb-0000-4000-8000-000000000001',
          action: 'ACCOUNT_BLOCKED',
          entityType: 'ACCOUNT',
          entityId: 'cccccccc-0000-4000-8000-000000000001',
          createdAt: '2026-11-19T11:00:00Z',
        },
      ])
    );
  });
}

describe('AdminHomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    useAuth.mockReturnValue({ accessToken: 'token', user: { firstName: 'Ada' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('greets the admin and requests the summary counts for the last 24 hours', async () => {
    mockApis();

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Buenas tardes, Ada' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Usuarios: 42/ })).toHaveAttribute('href', '/admin/users');
    expect(getAdminUsers).toHaveBeenCalledWith('token', { page: 0, size: 1, status: 'BLOCKED' });
    expect(getAdminTransfers).toHaveBeenCalledWith('token', { page: 0, size: 1, status: 'COMPLETED', from: SINCE });
    expect(getAdminTransfers).toHaveBeenCalledWith('token', { page: 0, size: 1, status: 'REJECTED', from: SINCE });
    expect(getAdminAuditLogs).toHaveBeenCalledWith('token', { page: 0, size: 1, action: 'LOGIN_FAILURE', from: SINCE });
  });

  it('links each summary card to the filtered list', async () => {
    mockApis();

    renderPage();

    expect(await screen.findByRole('link', { name: /Bloqueados: 2/ })).toHaveAttribute('href', '/admin/users?status=BLOCKED');
    expect(screen.getByRole('link', { name: /Transferencias 24 h: 12/ })).toHaveAttribute(
      'href',
      '/admin/transfers?status=COMPLETED&from=2026-11-18T15%3A30'
    );

    const rejections = screen.getByRole('article', { name: 'Rechazos 24 h' });
    expect(await within(rejections).findByText('4')).toBeInTheDocument();
    expect(within(rejections).getByRole('link', { name: '3 transferencias' })).toHaveAttribute(
      'href',
      '/admin/transfers?status=REJECTED&from=2026-11-18T15%3A30'
    );
    expect(within(rejections).getByRole('link', { name: '1 login fallido' })).toHaveAttribute(
      'href',
      '/admin/audit-logs?action=LOGIN_FAILURE&from=2026-11-18T15%3A30'
    );
  });

  it('shows recent audit activity, recent transfers and the section shortcuts', async () => {
    mockApis();

    renderPage();

    const activity = screen.getByRole('region', { name: 'Actividad reciente' });
    expect(await within(activity).findByText('Cuenta bloqueada')).toHaveClass('ds-badge-warning');
    expect(within(activity).getByRole('link', { name: 'Ver todos' })).toHaveAttribute('href', '/admin/audit-logs');

    const transfers = screen.getByRole('region', { name: 'Últimas transferencias' });
    expect(await within(transfers).findByText('Rechazada')).toHaveClass('ds-badge-danger');
    expect(within(transfers).getByText('aaaaaaaa…')).toHaveAttribute('title', 'aaaaaaaa-0000-4000-8000-000000000001');

    const sections = screen.getByRole('navigation', { name: 'Accesos' });
    expect(within(sections).getByRole('link', { name: /Acciones de cuentas/ })).toHaveAttribute('href', '/admin/accounts/actions');
    expect(within(sections).getAllByRole('link')).toHaveLength(4);
  });

  it('keeps the other cards working when one count fails', async () => {
    mockApis();
    getAdminUsers.mockImplementation((_token, query) =>
      query.status === 'BLOCKED' ? Promise.reject({ status: 500, message: 'Boom' }) : Promise.resolve(page([], 42))
    );

    renderPage();

    expect(await screen.findByRole('link', { name: /Bloqueados: —/ })).toHaveTextContent('No se pudo cargar');
    expect(screen.getByRole('link', { name: /Usuarios: 42/ })).toBeInTheDocument();
  });

  it('shows empty states and a permission message', async () => {
    mockApis();
    getAdminAuditLogs.mockImplementation((_token, query) =>
      query.action ? Promise.resolve(page([], 0)) : Promise.reject({ status: 403, message: 'Forbidden' })
    );
    getAdminTransfers.mockResolvedValue(page([], 0));

    renderPage();

    const activity = screen.getByRole('region', { name: 'Actividad reciente' });
    expect(await within(activity).findByRole('alert')).toHaveTextContent('No tenés permisos de administrador.');

    const transfers = screen.getByRole('region', { name: 'Últimas transferencias' });
    expect(await within(transfers).findByText('Todavía no hay transferencias.')).toBeInTheDocument();
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminHomePage />
    </MemoryRouter>
  );
}
