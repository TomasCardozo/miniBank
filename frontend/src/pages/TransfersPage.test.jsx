import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from '../api/accountsApi';
import { getTransfers } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import TransfersPage from './TransfersPage';

vi.mock('../api/accountsApi', () => ({
  getAccounts: vi.fn(),
}));

vi.mock('../api/transfersApi', () => ({
  getTransfers: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const defaultPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

describe('TransfersPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads transfers with filters derived from the URL', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account('account-1')]);
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage('/transfers?accountId=account-1');

    await waitFor(() =>
      expect(getTransfers).toHaveBeenCalledWith('token', {
        status: '',
        from: '',
        to: '',
        accountId: 'account-1',
        size: '20',
        sort: 'createdAt,DESC',
        page: 0,
      })
    );
    expect(await screen.findByLabelText('Cuenta')).toHaveValue('account-1');
  });

  it('shows the number of the account filtered by the URL', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account('account-1')]);
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage('/transfers?accountId=account-1');

    expect(await screen.findByText('N° de Cuenta: 000001000001')).toBeInTheDocument();
  });

  it('does not show an account number without an account filter', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account('account-1')]);
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage();

    expect(await screen.findByText('No hay transferencias para mostrar.')).toBeInTheDocument();
    expect(screen.queryByText(/N° de Cuenta:/)).not.toBeInTheDocument();
  });

  it('renders transfer rows and pagination summary', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account('account-1')]);
    getTransfers.mockResolvedValue({
      content: [transfer('transfer-1')],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });

    renderTransfersPage();

    expect(await screen.findByText('000001000001')).toBeInTheDocument();
    expect(screen.getByText('000001000002')).toBeInTheDocument();
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThan(0);
    expect(screen.getByText('Página 1 de 1. Total: 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([]);
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage();

    expect(await screen.findByText('No hay transferencias para mostrar.')).toBeInTheDocument();
  });

  it('shows transfer loading errors', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([]);
    getTransfers.mockRejectedValue({ status: 403, message: 'No tiene permisos' });

    renderTransfersPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permisos');
    expect(screen.getByText('Status HTTP: 403')).toBeInTheDocument();
  });

  it('shows account loading errors', async () => {
    mockAuth();
    getAccounts.mockRejectedValue({ status: 500, message: 'No se pudieron cargar cuentas' });
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage();

    expect(await screen.findByText('No se pudieron cargar cuentas')).toBeInTheDocument();
  });

  it('requests the next page when pagination advances', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([]);
    getTransfers.mockResolvedValue({
      content: [transfer('transfer-1')],
      page: 0,
      size: 20,
      totalElements: 25,
      totalPages: 2,
    });

    renderTransfersPage();
    await screen.findByText('Página 1 de 2. Total: 25');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() =>
      expect(getTransfers).toHaveBeenLastCalledWith(
        'token',
        expect.objectContaining({
          page: 1,
        })
      )
    );
  });

  it('applies filters and resets the query to the first page', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account('account-1')]);
    getTransfers.mockResolvedValue(defaultPage);

    renderTransfersPage();
    await screen.findByLabelText('Estado');

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'COMPLETED');
    await userEvent.selectOptions(screen.getByLabelText('Cuenta'), 'account-1');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(getTransfers).toHaveBeenLastCalledWith('token', {
        status: 'COMPLETED',
        from: '',
        to: '',
        accountId: 'account-1',
        size: '20',
        sort: 'createdAt,DESC',
        page: 0,
      })
    );
  });
});

function renderTransfersPage(initialEntry = '/transfers') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TransfersPage />
    </MemoryRouter>
  );
}

function mockAuth() {
  useAuth.mockReturnValue({
    accessToken: 'token',
    user: { role: 'CUSTOMER' },
    isAuthenticated: true,
    loading: false,
  });
}

function account(id) {
  return {
    id,
    accountNumber: '000001000001',
    currency: 'ARS',
    alias: 'Principal',
  };
}

function transfer(id) {
  return {
    id,
    sourceAccountNumber: '000001000001',
    targetAccountNumber: '000001000002',
    amount: 1500,
    currency: 'ARS',
    status: 'COMPLETED',
    description: 'Pago',
    createdAt: '2026-07-28T10:30:00Z',
    failureReason: null,
  };
}
