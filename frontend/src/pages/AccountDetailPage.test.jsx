import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccount, updateAccountAlias } from '../api/accountsApi';
import { useAuth } from '../auth/useAuth';
import AccountDetailPage from './AccountDetailPage';

vi.mock('../api/accountsApi', () => ({
  getAccount: vi.fn(),
  updateAccountAlias: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AccountDetailPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the balance and status without the balance lookup section', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account());

    renderAccountDetailPage();

    expect(await screen.findByText('$51,700.00 ARS')).toBeInTheDocument();
    expect(screen.getByText('655351282615')).toBeInTheDocument();
    expect(screen.getByText('Activa', { selector: 'span.ds-badge' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Consultar saldo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Saldo' })).not.toBeInTheDocument();
  });

  it('always shows the technical ids in the detail footer', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account());

    renderAccountDetailPage();

    const list = await screen.findByLabelText('Datos tecnicos');

    expect(within(list).getByText('account-1')).toBeInTheDocument();
    expect(within(list).getByText('user-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /datos tecnicos/ })).not.toBeInTheDocument();
  });

  it('saves the alias from the inline editor', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account());
    updateAccountAlias.mockResolvedValue(account({ alias: 'ahorro-sueldo' }));

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar alias' }));
    await userEvent.type(screen.getByLabelText('Alias de la cuenta'), 'ahorro-sueldo');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(updateAccountAlias).toHaveBeenCalledWith('token-1', 'account-1', { alias: 'ahorro-sueldo' });
    expect(await within(detail()).findByText('ahorro-sueldo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Alias de la cuenta')).not.toBeInTheDocument();
  });

  it('discards the alias draft when the edition is cancelled', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account({ alias: 'alias-original' }));

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar alias' }));
    await userEvent.clear(screen.getByLabelText('Alias de la cuenta'));
    await userEvent.type(screen.getByLabelText('Alias de la cuenta'), 'alias-descartado');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(updateAccountAlias).not.toHaveBeenCalled();
    expect(within(detail()).getByText('alias-original')).toBeInTheDocument();
  });

  it('does not show admin actions, not even to admins (they live in /admin/accounts/actions)', async () => {
    mockAuth('ADMIN');
    getAccount.mockResolvedValue(account());

    renderAccountDetailPage();

    expect(await screen.findByRole('navigation', { name: 'Accesos de la cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acciones admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bloquear cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument();
  });

  it('copies the account number and the alias to the clipboard', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account({ alias: 'alice.ars' }));
    const writeText = mockClipboard();

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Copiar numero de cuenta' }));
    expect(writeText).toHaveBeenLastCalledWith('655351282615');
    expect(screen.getByRole('status')).toHaveTextContent('Copiamos el numero de cuenta al portapapeles.');

    await userEvent.click(screen.getByRole('button', { name: 'Copiar alias' }));
    expect(writeText).toHaveBeenLastCalledWith('alice.ars');
  });

  it('copies all the receiving data including the holder for own accounts', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account({ alias: 'alice.ars' }));
    const writeText = mockClipboard();

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: /Copiar todo/ }));

    expect(writeText).toHaveBeenCalledWith(
      'Titular: Alice Customer\nAlias: alice.ars\nNumero de cuenta: 655351282615\nMoneda: ARS',
    );
  });

  it('omits the holder and the alias when they are not available', async () => {
    mockAuth('ADMIN');
    getAccount.mockResolvedValue(account({ userId: 'user-2' }));
    const writeText = mockClipboard();

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: /Copiar todo/ }));

    expect(writeText).toHaveBeenCalledWith('Numero de cuenta: 655351282615\nMoneda: ARS');
    expect(screen.queryByRole('button', { name: 'Copiar alias' })).not.toBeInTheDocument();
  });

  it('reports a failed copy', async () => {
    mockAuth();
    getAccount.mockResolvedValue(account());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });

    renderAccountDetailPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Copiar numero de cuenta' }));

    expect(screen.getByRole('status')).toHaveTextContent('No pudimos copiar al portapapeles. Intentá de nuevo.');
  });

  function renderAccountDetailPage() {
    return render(
      <MemoryRouter initialEntries={['/accounts/account-1']}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function detail() {
    return screen.getByRole('region', { name: 'Detalle' });
  }

  function mockClipboard() {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    return writeText;
  }

  function mockAuth(role = 'CUSTOMER') {
    useAuth.mockReturnValue({
      accessToken: 'token-1',
      user: { id: 'user-1', firstName: 'Alice', lastName: 'Customer', role },
    });
  }

  function account(overrides = {}) {
    return {
      id: 'account-1',
      userId: 'user-1',
      accountNumber: '655351282615',
      alias: null,
      currency: 'ARS',
      balance: '51700.00',
      status: 'ACTIVE',
      createdAt: '2026-07-31T21:24:43Z',
      updatedAt: '2026-07-31T23:44:58Z',
      ...overrides,
    };
  }
});
