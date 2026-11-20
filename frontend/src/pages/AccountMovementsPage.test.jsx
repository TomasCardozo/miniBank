import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccount } from '../api/accountsApi';
import { getAccountMovements } from '../api/movementsApi';
import { useAuth } from '../auth/useAuth';
import AccountMovementsPage from './AccountMovementsPage';

vi.mock('../api/accountsApi', () => ({
  getAccount: vi.fn(),
}));

vi.mock('../api/movementsApi', () => ({
  getAccountMovements: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AccountMovementsPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the account number instead of the account id', async () => {
    mockAuth();
    getAccount.mockResolvedValue({ id: 'account-1', accountNumber: '655351282615' });
    getAccountMovements.mockResolvedValue(emptyPage());

    renderAccountMovementsPage();

    expect(await screen.findByText('N° de Cuenta: 655351282615')).toBeInTheDocument();
    expect(getAccount).toHaveBeenCalledWith('token-1', 'account-1');
    expect(screen.queryByText(/account-1/)).not.toBeInTheDocument();
  });

  it('prefixes the amount and the balance after with a dollar sign', async () => {
    mockAuth();
    getAccount.mockResolvedValue({ id: 'account-1', accountNumber: '655351282615' });
    getAccountMovements.mockResolvedValue({
      ...emptyPage(),
      totalPages: 1,
      totalElements: 1,
      content: [
        {
          id: 'movement-1',
          accountNumber: '655351282615',
          type: 'DEBIT',
          amount: '4600.00',
          balanceAfter: '41444.45',
          description: 'test',
          createdAt: '2026-09-16T22:01:31Z',
          transferId: null,
        },
      ],
    });

    renderAccountMovementsPage();

    expect(await screen.findByText('$ 4,600.00')).toBeInTheDocument();
    expect(screen.getByText('$ 41,444.45')).toBeInTheDocument();
  });

  it('keeps the movements list when the account lookup fails', async () => {
    mockAuth();
    getAccount.mockRejectedValue(new Error('boom'));
    getAccountMovements.mockResolvedValue(emptyPage());

    renderAccountMovementsPage();

    expect(await screen.findByText('No hay movimientos para mostrar.')).toBeInTheDocument();
    expect(screen.queryByText(/N° de Cuenta:/)).not.toBeInTheDocument();
  });

  function renderAccountMovementsPage() {
    return render(
      <MemoryRouter initialEntries={['/accounts/account-1/movements']}>
        <Routes>
          <Route path="/accounts/:accountId/movements" element={<AccountMovementsPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function mockAuth() {
    useAuth.mockReturnValue({ accessToken: 'token-1', user: { id: 'user-1', role: 'CUSTOMER' } });
  }

  function emptyPage() {
    return { content: [], number: 0, totalPages: 0, totalElements: 0 };
  }
});
