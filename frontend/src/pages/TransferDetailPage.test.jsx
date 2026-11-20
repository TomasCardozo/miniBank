import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from '../api/accountsApi';
import { getTransfer } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import TransferDetailPage from './TransferDetailPage';

vi.mock('../api/accountsApi', () => ({
  getAccounts: vi.fn(),
}));

vi.mock('../api/transfersApi', () => ({
  getTransfer: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('TransferDetailPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows a sent transfer with the amount, status and links to the source account', async () => {
    mockAuth();
    getTransfer.mockResolvedValue(transfer());
    getAccounts.mockResolvedValue([ownAccount('source-1', '655351282615', 'alice.ars')]);

    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Detalle Transferencia' })).toBeInTheDocument();
    expect(await screen.findByText('$4,600.00 ARS')).toBeInTheDocument();
    expect(screen.getByText('Completada', { selector: 'span.ds-badge' })).toBeInTheDocument();
    expect(within(detail()).getByText('alice.ars')).toBeInTheDocument();

    const accesses = screen.getByRole('navigation', { name: 'Accesos de la transferencia' });
    expect(within(accesses).getByRole('link', { name: /Ver cuenta origen/ })).toHaveAttribute('href', '/accounts/source-1');
    expect(within(accesses).getByRole('link', { name: /Movimientos/ })).toHaveAttribute('href', '/accounts/source-1/movements');
    expect(within(accesses).getByRole('link', { name: /Nueva transferencia/ })).toHaveAttribute(
      'href',
      '/transfers/new?sourceAccountId=source-1',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links to the target account when the transfer was received', async () => {
    mockAuth();
    getTransfer.mockResolvedValue(transfer());
    getAccounts.mockResolvedValue([ownAccount('target-1', '255908798740')]);

    renderPage();

    const accesses = await screen.findByRole('navigation', { name: 'Accesos de la transferencia' });
    expect(await within(accesses).findByRole('link', { name: /Ver cuenta destino/ })).toHaveAttribute('href', '/accounts/target-1');
    expect(within(accesses).queryByRole('link', { name: /cuenta origen/ })).not.toBeInTheDocument();
  });

  it('shows the failure reason for a failed transfer', async () => {
    mockAuth();
    getTransfer.mockResolvedValue(transfer({ status: 'FAILED', failureReason: 'Saldo insuficiente', completedAt: null }));
    getAccounts.mockResolvedValue([ownAccount('source-1', '655351282615')]);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Motivo del fallo: Saldo insuficiente');
    expect(screen.getByText('Fallida', { selector: 'span.ds-badge' })).toBeInTheDocument();
  });

  it('still shows the transfer when the accounts lookup fails', async () => {
    mockAuth();
    getTransfer.mockResolvedValue(transfer());
    getAccounts.mockRejectedValue(new Error('boom'));

    renderPage();

    const accesses = await screen.findByRole('navigation', { name: 'Accesos de la transferencia' });
    expect(within(accesses).getAllByRole('link')).toHaveLength(1);
    expect(within(accesses).getByRole('link', { name: /Nueva transferencia/ })).toHaveAttribute('href', '/transfers/new');
    expect(within(screen.getByLabelText('Datos tecnicos')).getByText('transfer-1')).toBeInTheDocument();
  });

  it('copies the transfer summary', async () => {
    mockAuth();
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    getTransfer.mockResolvedValue(transfer());
    getAccounts.mockResolvedValue([]);

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Copiar todo' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Monto: $4,600.00 ARS'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Cuenta destino: 255908798740'));
    expect(await screen.findByText('Copiamos los datos de la transferencia al portapapeles.')).toBeInTheDocument();
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/transfers/transfer-1']}>
        <Routes>
          <Route path="/transfers/:id" element={<TransferDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function detail() {
    return screen.getByRole('region', { name: 'Detalle' });
  }

  function mockAuth() {
    useAuth.mockReturnValue({
      accessToken: 'token-1',
      user: { id: 'user-1', firstName: 'Alice', lastName: 'Customer', role: 'CUSTOMER' },
    });
  }

  function ownAccount(id, accountNumber, alias = null) {
    return { id, accountNumber, alias, currency: 'ARS', balance: '1000.00', status: 'ACTIVE' };
  }

  function transfer(overrides = {}) {
    return {
      id: 'transfer-1',
      sourceAccountId: 'source-1',
      sourceAccountNumber: '655351282615',
      targetAccountId: 'target-1',
      targetAccountNumber: '255908798740',
      amount: '4600.00',
      currency: 'ARS',
      description: 'test',
      status: 'COMPLETED',
      failureReason: null,
      createdAt: '2026-09-17T01:01:31Z',
      completedAt: '2026-09-17T01:01:31Z',
      ...overrides,
    };
  }
});
