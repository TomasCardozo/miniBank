import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccountLimits, updateAccountLimits } from '../api/limitsApi';
import { useAuth } from '../auth/useAuth';
import AccountLimitsPage from './AccountLimitsPage';

vi.mock('../api/limitsApi', () => ({
  getAccountLimits: vi.fn(),
  updateAccountLimits: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AccountLimitsPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the available amount, the daily limit and the usage of the day', async () => {
    mockAuth();
    getAccountLimits.mockResolvedValue(limits({ usedToday: '125000.00', availableToday: '375000.00' }));

    renderAccountLimitsPage();

    const hero = await screen.findByRole('region', { name: 'Uso del limite diario' });

    expect(within(hero).getByText('$375,000.00 ARS')).toBeInTheDocument();
    expect(within(hero).getByText('$500,000.00 ARS')).toBeInTheDocument();
    expect(within(hero).getByText('Usado hoy $125,000.00 ARS · 25%')).toBeInTheDocument();
    expect(within(hero).getByRole('progressbar')).toHaveAttribute('value', '25');
    expect(screen.getByText(/N° 655351282615 · ARS/)).toBeInTheDocument();
    expect(screen.queryByText('account-1', { selector: 'main section *' })).not.toBeInTheDocument();
  });

  it('hides the account data when the limits cannot be loaded', async () => {
    mockAuth();
    getAccountLimits.mockRejectedValue(new Error('No se pudieron cargar los limites'));

    renderAccountLimitsPage();

    expect(await screen.findByText(/No se pudieron cargar los limites/)).toBeInTheDocument();
    expect(screen.queryByText(/N° 655351282615/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a cuenta' })).toHaveAttribute('href', '/accounts/account-1');
  });

  it('lowers the limit using a suggestion and shows the remaining amount', async () => {
    mockAuth();
    getAccountLimits.mockResolvedValue(limits({ usedToday: '100000.00', availableToday: '400000.00' }));
    updateAccountLimits.mockResolvedValue(limits({ dailyLimit: '250000.00', usedToday: '100000.00', availableToday: '150000.00' }));

    renderAccountLimitsPage();

    await userEvent.click(await screen.findByRole('button', { name: '50%' }));

    expect(screen.getByLabelText('Nuevo limite diario')).toHaveValue('250,000.00');
    expect(screen.getByText('Con este limite te quedarian $150,000.00 ARS disponibles hoy.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar limite' }));

    expect(updateAccountLimits).toHaveBeenCalledWith('token-1', 'account-1', { dailyLimit: 250000 });
    expect(await screen.findByText('Limite actualizado.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Uso del limite diario' })).getByText('$150,000.00 ARS')).toBeInTheDocument();
    expect(screen.getByLabelText('Nuevo limite diario')).toHaveValue('');
  });

  it('does not let a customer raise the limit', async () => {
    mockAuth();
    getAccountLimits.mockResolvedValue(limits());

    renderAccountLimitsPage();

    await userEvent.type(await screen.findByLabelText('Nuevo limite diario'), '60000000');

    expect(screen.getByLabelText('Nuevo limite diario')).toHaveValue('600,000.00');
    expect(screen.getByText('Supera tu limite actual. Para subirlo, pediselo a un administrador.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar limite' })).toBeDisabled();
  });

  it('lets an admin raise the limit', async () => {
    mockAuth('ADMIN');
    getAccountLimits.mockResolvedValue(limits());
    updateAccountLimits.mockResolvedValue(limits({ dailyLimit: '600000.00', availableToday: '600000.00' }));

    renderAccountLimitsPage();

    await userEvent.type(await screen.findByLabelText('Nuevo limite diario'), '60000000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar limite' }));

    expect(updateAccountLimits).toHaveBeenCalledWith('token-1', 'account-1', { dailyLimit: 600000 });
  });

  it('warns when the new limit is below what was already used today', async () => {
    mockAuth();
    getAccountLimits.mockResolvedValue(limits({ usedToday: '450000.00', availableToday: '50000.00' }));

    renderAccountLimitsPage();

    await userEvent.click(await screen.findByRole('button', { name: '25%' }));

    expect(screen.getByText('Con este limite hoy ya no vas a poder transferir mas desde esta cuenta.')).toBeInTheDocument();
  });

  function renderAccountLimitsPage() {
    return render(
      <MemoryRouter initialEntries={['/accounts/account-1/limits']}>
        <Routes>
          <Route path="/accounts/:accountId/limits" element={<AccountLimitsPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function mockAuth(role = 'CUSTOMER') {
    useAuth.mockReturnValue({ accessToken: 'token-1', user: { id: 'user-1', role } });
  }

  function limits(overrides = {}) {
    return {
      accountId: 'account-1',
      accountNumber: '655351282615',
      currency: 'ARS',
      dailyLimit: '500000.00',
      usedToday: '0.00',
      availableToday: '500000.00',
      date: '2026-10-29',
      updatedAt: '2026-10-29T12:00:00Z',
      ...overrides,
    };
  }
});
