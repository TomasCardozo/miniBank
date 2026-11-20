import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activateAdminAccount, blockAdminAccount, creditAdminAccount, getAdminAccounts, getAdminAuditLogs } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminAccountActionsPage from './AdminAccountActionsPage';

vi.mock('../api/adminApi', () => ({
  getAdminAccounts: vi.fn(),
  blockAdminAccount: vi.fn(),
  activateAdminAccount: vi.fn(),
  creditAdminAccount: vi.fn(),
  getAdminAuditLogs: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const ACCOUNT_ID = '1f3a9c2e-4b5d-4e6f-8a7b-9c0d1e2f3a4b';
const USER_ID = '10000000-0000-4000-8000-000000000002';
const DEFAULT_ACCOUNTS_QUERY = { userId: '', status: '', currency: '', size: '20', sort: 'createdAt,DESC', page: 0 };

describe('AdminAccountActionsPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ accessToken: 'token-1', user: { id: 'admin-1', role: 'ADMIN' } });
    getAdminAuditLogs.mockResolvedValue({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
    getAdminAccounts.mockResolvedValue(accountsPage([listedAccount()]));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('lists every account by default and shows the actions only after picking one', async () => {
    renderPage();

    await waitFor(() => expect(getAdminAccounts).toHaveBeenCalledWith('token-1', DEFAULT_ACCOUNTS_QUERY));
    const list = screen.getByRole('region', { name: 'Cuentas' });
    expect(await within(list).findByText('655351282615')).toBeInTheDocument();
    expect(within(list).getByText('Alice Customer')).toBeInTheDocument();
    expect(within(list).getByText('alice@minibank.local')).toBeInTheDocument();
    expect(within(within(list).getByRole('table')).getByText('Activa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear cuenta' })).not.toBeInTheDocument();
    expect(getAdminAuditLogs).not.toHaveBeenCalled();

    await selectAccount();

    const hero = screen.getByRole('region', { name: 'Cuenta seleccionada' });
    expect(within(hero).getByText('$12,000.00 ARS')).toBeInTheDocument();
    expect(within(list).getByText('Alice Customer')).toBeInTheDocument();
    expect(within(list).queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloquear cuenta' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Activar cuenta' })).toBeDisabled();
    expect(within(list).getByRole('button', { name: 'Cambiar cuenta (deseleccionar 655351282615)' })).toBeInTheDocument();
  });

  it('shows only the picked account and brings the list back when it is deselected', async () => {
    getAdminAccounts.mockResolvedValue(
      accountsPage([listedAccount(), listedAccount({ id: 'other-account', accountNumber: '000000000003', ownerFirstName: 'Bob' })])
    );

    renderPage();

    const list = screen.getByRole('region', { name: 'Cuentas' });
    expect(await within(list).findByText('000000000003')).toBeInTheDocument();

    await selectAccount();

    expect(within(list).queryByText('000000000003')).not.toBeInTheDocument();
    expect(within(list).getByText('655351282615')).toBeInTheDocument();
    expect(within(list).queryByRole('form', { name: 'Filtros de cuentas' })).not.toBeInTheDocument();
    expect(within(list).queryByRole('navigation', { name: 'Paginación de cuentas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloquear cuenta' })).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: 'Cambiar cuenta (deseleccionar 655351282615)' }));

    expect(within(list).getByText('000000000003')).toBeInTheDocument();
    expect(within(list).getByRole('form', { name: 'Filtros de cuentas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cuenta seleccionada' })).not.toBeInTheDocument();
    expect(getAdminAccounts).toHaveBeenCalledTimes(1);
  });

  it('filters by the user from the URL and clears it from the chip', async () => {
    renderPage(`/admin/accounts/actions?userId=${USER_ID}`);

    await waitFor(() =>
      expect(getAdminAccounts).toHaveBeenCalledWith('token-1', { ...DEFAULT_ACCOUNTS_QUERY, userId: USER_ID })
    );
    const list = screen.getByRole('region', { name: 'Cuentas' });
    expect(await within(list).findByText((_, element) => element?.textContent === 'Cuentas de Alice Customer')).toBeInTheDocument();
    expect(within(list).getByLabelText('Usuario (ID)')).toHaveValue(USER_ID);

    await userEvent.click(within(list).getByRole('button', { name: 'Quitar filtro de usuario' }));

    await waitFor(() => expect(getAdminAccounts).toHaveBeenLastCalledWith('token-1', DEFAULT_ACCOUNTS_QUERY));
    expect(within(list).queryByRole('button', { name: 'Quitar filtro de usuario' })).not.toBeInTheDocument();
  });

  it('asks for inline confirmation before blocking and updates the result', async () => {
    blockAdminAccount.mockResolvedValue(account({ status: 'BLOCKED' }));

    renderPage();
    await selectAccount();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear cuenta' }));

    const confirmTitle = screen.getByRole('heading', { name: '¿Bloquear cuenta 655351282615?' });
    expect(confirmTitle).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(blockAdminAccount).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /Bloquear cuenta 6553/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear cuenta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    expect(blockAdminAccount).toHaveBeenCalledWith('token-1', ACCOUNT_ID);
    expect(await screen.findByText('Cuenta bloqueada.')).toBeInTheDocument();

    const hero = screen.getByRole('region', { name: 'Cuenta seleccionada' });
    expect(within(hero).getByText('Bloqueada')).toBeInTheDocument();
    expect(within(hero).getByText('$12,000.00 ARS')).toBeInTheDocument();
    expect(within(hero).getByText('ARS')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Datos técnicos' })).getByText('user-1')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Bloquear cuenta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Activar cuenta' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Revisar acreditación' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar cuenta (deseleccionar 655351282615)' }));

    expect(within(screen.getByRole('table', { name: 'Cuentas del sistema' })).getByText('Bloqueada')).toBeInTheDocument();
  });

  it('copies the technical IDs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderPage();
    await selectAccount();

    const technical = screen.getByRole('region', { name: 'Datos técnicos' });
    await userEvent.click(within(technical).getByRole('button', { name: 'Copiar ID de cuenta' }));

    expect(writeText).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(await within(technical).findByText('ID de cuenta copiado')).toBeInTheDocument();
  });

  it('formats the credit amount, confirms it and sends it as a decimal string', async () => {
    creditAdminAccount.mockResolvedValue(account({ balance: '24000.00' }));

    renderPage();
    await selectAccount();

    await userEvent.type(screen.getByLabelText('Monto a acreditar'), '1200000');

    expect(screen.getByLabelText('Monto a acreditar')).toHaveValue('12,000.00');

    await userEvent.click(screen.getByRole('button', { name: 'Revisar acreditación' }));

    expect(screen.getByRole('heading', { name: '¿Acreditar $12,000.00 ARS en la cuenta 655351282615?' })).toHaveFocus();
    expect(creditAdminAccount).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar acreditación' }));

    expect(creditAdminAccount).toHaveBeenCalledWith('token-1', ACCOUNT_ID, { amount: '12000.00' });
    expect(await screen.findByText('Acreditado ✓')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Cuenta seleccionada' })).getByText('$24,000.00 ARS')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto a acreditar')).toHaveValue('');
  });

  it('shows a 422 error only in the status panel and keeps the previous result', async () => {
    blockAdminAccount.mockResolvedValue(account({ status: 'BLOCKED' }));
    activateAdminAccount.mockRejectedValue(apiError(422, 'Only blocked accounts can be activated'));

    renderPage();
    await selectAccount();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear cuenta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }));
    await screen.findByText('Cuenta bloqueada.');

    await userEvent.click(screen.getByRole('button', { name: 'Activar cuenta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }));

    const statusPanel = screen.getByRole('region', { name: 'Estado' });
    expect(await within(statusPanel).findByText(/Solo se pueden activar cuentas bloqueadas/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Acreditar' })).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cuenta seleccionada' })).toBeInTheDocument();
  });

  it('shows a 404 error only in the credit panel', async () => {
    creditAdminAccount.mockRejectedValue(apiError(404, 'Account not found'));

    renderPage();
    await selectAccount();

    await userEvent.type(screen.getByLabelText('Monto a acreditar'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Revisar acreditación' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar acreditación' }));

    const creditPanel = screen.getByRole('region', { name: 'Acreditar' });
    expect(await within(creditPanel).findByText('La cuenta ya no existe.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Estado' })).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a friendly message when the user is not an admin', async () => {
    blockAdminAccount.mockRejectedValue(apiError(403, 'Forbidden'));

    renderPage();
    await selectAccount();

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear cuenta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    expect(await screen.findByText(/No tenés permisos de administrador/)).toBeInTheDocument();
  });

  it('loads the recent admin activity of the account', async () => {
    getAdminAuditLogs.mockResolvedValue({
      content: [
        {
          id: 'log-1',
          userId: 'admin-uuid-123456',
          action: 'ACCOUNT_CREDITED',
          entityType: 'ACCOUNT',
          entityId: ACCOUNT_ID,
          details: 'amount=10.00',
          createdAt: '2026-11-01T12:00:00Z',
        },
      ],
    });

    renderPage();
    await selectAccount();

    await waitFor(() =>
      expect(getAdminAuditLogs).toHaveBeenCalledWith('token-1', expect.objectContaining({ entityType: 'ACCOUNT', entityId: ACCOUNT_ID })),
    );

    const activity = screen.getByRole('region', { name: 'Actividad admin reciente' });
    expect(await within(activity).findByText('Acreditación')).toBeInTheDocument();
    expect(within(activity).getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
      'href',
      `/admin/audit-logs?entityType=ACCOUNT&entityId=${ACCOUNT_ID}`
    );
  });

  it('paginates the admin activity and goes back to the first page after an action', async () => {
    getAdminAuditLogs.mockImplementation((_token, query) =>
      Promise.resolve({
        content: [
          {
            id: `log-${query.page}`,
            userId: 'admin-uuid-123456',
            action: query.page === 0 ? 'ACCOUNT_CREDITED' : 'ACCOUNT_BLOCKED',
            entityType: 'ACCOUNT',
            entityId: ACCOUNT_ID,
            createdAt: '2026-11-01T12:00:00Z',
          },
        ],
        page: query.page,
        size: 20,
        totalElements: 25,
        totalPages: 2,
      })
    );
    blockAdminAccount.mockResolvedValue(account({ status: 'BLOCKED' }));

    renderPage();
    await selectAccount();

    const activity = screen.getByRole('region', { name: 'Actividad admin reciente' });
    expect(await within(activity).findByText('Acreditación')).toBeInTheDocument();
    expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token-1', expect.objectContaining({ page: 0, size: 20 }));

    const pagination = within(activity).getByRole('navigation', { name: 'Paginación de actividad' });
    expect(pagination).toHaveTextContent('Página 1 de 2. Total: 25');
    await userEvent.click(within(pagination).getByRole('button', { name: 'Siguiente' }));

    expect(await within(activity).findByText('Bloqueo')).toBeInTheDocument();
    expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token-1', expect.objectContaining({ page: 1 }));

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear cuenta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    expect(await within(activity).findByText('Acreditación')).toBeInTheDocument();
    expect(getAdminAuditLogs).toHaveBeenLastCalledWith('token-1', expect.objectContaining({ page: 0 }));
  });

  it('shows an empty state when the account has no admin activity', async () => {
    renderPage();
    await selectAccount();

    expect(await screen.findByText('No hay actividad administrativa registrada para esta cuenta.')).toBeInTheDocument();
  });

  async function selectAccount() {
    await userEvent.click(await screen.findByRole('button', { name: 'Operar sobre la cuenta 655351282615' }));
  }

  function renderPage(path = '/admin/accounts/actions') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AdminAccountActionsPage />
      </MemoryRouter>,
    );
  }

  function account(overrides = {}) {
    return {
      id: ACCOUNT_ID,
      userId: 'user-1',
      accountNumber: '655351282615',
      alias: null,
      currency: 'ARS',
      balance: '12000.00',
      status: 'ACTIVE',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-29T12:00:00Z',
      ...overrides,
    };
  }

  function listedAccount(overrides = {}) {
    return {
      ...account(),
      userId: USER_ID,
      ownerFirstName: 'Alice',
      ownerLastName: 'Customer',
      ownerEmail: 'alice@minibank.local',
      ...overrides,
    };
  }

  function accountsPage(content) {
    return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
  }

  function apiError(status, message) {
    return Object.assign(new Error(message), { status });
  }
});
