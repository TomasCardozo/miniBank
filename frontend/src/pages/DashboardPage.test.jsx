import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from '../api/accountsApi';
import { getTransfers } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import DashboardPage from './DashboardPage';

vi.mock('../api/accountsApi', () => ({
  getAccounts: vi.fn(),
}));

vi.mock('../api/transfersApi', () => ({
  getTransfers: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/netWorthApi', () => ({
  getNetWorthHistory: vi.fn(() => new Promise(() => {})),
}));

vi.mock('../api/dolarApi', () => ({
  getDolarOficialHistorico: vi.fn(() => new Promise(() => {})),
}));

const BALANCE_VISIBILITY_STORAGE_KEY = 'minibank.dashboard.balanceVisibility';

describe('DashboardPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('toggles account balance visibility and stores the preference', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([
      account({ balance: '123456.78', currency: 'ARS' }),
      account({ id: 'account-2', balance: '50.25', currency: 'USD', accountNumber: '000001000002' }),
    ]);
    getTransfers.mockResolvedValue({ content: [], totalElements: 0 });

    renderDashboardPage();

    const accountsPanel = await findAccountsPanel();
    expect(within(accountsPanel).getByText('123,456.78 ARS')).toBeInTheDocument();
    expect(screen.getAllByText('123,456.78 ARS')).toHaveLength(2);
    expect(screen.getAllByText('50.25 USD')).toHaveLength(2);
    expect(screen.getByText('2')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Ocultar numeros' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Mostrar numeros' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(accountsPanel).getByText('-,---.-- ARS')).toBeInTheDocument();
    expect(screen.getAllByText('-,---.-- ARS')).toHaveLength(2);
    expect(screen.getAllByText('-,---.-- USD')).toHaveLength(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(within(accountsPanel).queryByText('123,456.78 ARS')).not.toBeInTheDocument();
    expect(localStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBe('hidden');

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar numeros' }));

    expect(screen.getByRole('button', { name: 'Ocultar numeros' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(accountsPanel).getByText('123,456.78 ARS')).toBeInTheDocument();
    expect(screen.getAllByText('50.25 USD')).toHaveLength(2);
    expect(localStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBe('visible');
  });

  it('starts with account balances hidden when the stored preference is hidden', async () => {
    localStorage.setItem(BALANCE_VISIBILITY_STORAGE_KEY, 'hidden');
    mockAuth();
    getAccounts.mockResolvedValue([account({ balance: '98765.43' })]);
    getTransfers.mockResolvedValue({ content: [], totalElements: 0 });

    renderDashboardPage();

    const accountsPanel = await findAccountsPanel();
    expect(screen.getByRole('button', { name: 'Mostrar numeros' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(accountsPanel).getByText('-,---.-- ARS')).toBeInTheDocument();
    expect(within(accountsPanel).queryByText('98,765.43 ARS')).not.toBeInTheDocument();
  });

  it('does not hide transfer amounts in recent activity', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ balance: '123456.78' })]);
    getTransfers.mockResolvedValue({
      content: [transfer({ amount: '4500.00' })],
      totalElements: 1,
    });

    renderDashboardPage();
    await findAccountsPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar numeros' }));

    expect(screen.getByText('4,500.00 ARS')).toBeInTheDocument();
  });
});

async function findAccountsPanel() {
  const heading = await screen.findByRole('heading', { name: 'Cuentas' });
  return heading.closest('article');
}

function renderDashboardPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DashboardPage />
    </MemoryRouter>
  );
}

function mockAuth() {
  useAuth.mockReturnValue({
    accessToken: 'token',
    user: { firstName: 'Ada', role: 'CUSTOMER' },
    isAuthenticated: true,
    loading: false,
  });
}

function account(overrides = {}) {
  return {
    id: 'account-1',
    accountNumber: '000001000001',
    currency: 'ARS',
    alias: 'Principal',
    balance: '123456.78',
    status: 'ACTIVE',
    ...overrides,
  };
}

function transfer(overrides = {}) {
  return {
    id: 'transfer-1',
    sourceAccountNumber: '000001000001',
    targetAccountNumber: '000001000002',
    amount: '4500.00',
    currency: 'ARS',
    status: 'COMPLETED',
    description: 'Pago',
    createdAt: '2026-07-28T10:30:00Z',
    failureReason: null,
    ...overrides,
  };
}
