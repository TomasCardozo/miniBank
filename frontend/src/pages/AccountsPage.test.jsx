import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount, getAccounts } from '../api/accountsApi';
import { getDolarOficial, getDolarOficialPorFecha } from '../api/dolarApi';
import { useAuth } from '../auth/useAuth';
import AccountsPage from './AccountsPage';

vi.mock('../api/accountsApi', () => ({
  createAccount: vi.fn(),
  getAccounts: vi.fn(),
}));

vi.mock('../api/dolarApi', () => ({
  getDolarOficial: vi.fn(),
  getDolarOficialPorFecha: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AccountsPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows account KPIs and groups rows by currency', async () => {
    mockAuth();
    mockDolarOficial({ venta: 1550 });
    getAccounts.mockResolvedValue([
      account({ balance: '1500.25', currency: 'ARS' }),
      account({ id: 'account-2', accountNumber: '000001000002', balance: '200.00', currency: 'USD', alias: 'Ahorro' }),
      account({ id: 'account-3', accountNumber: '000001000003', balance: '50.00', currency: 'ARS', status: 'BLOCKED' }),
      account({ id: 'account-4', accountNumber: '000001000004', balance: '100.00', currency: 'USD', alias: 'Caja USD' }),
    ]);

    renderAccountsPage();

    expect(await screen.findByRole('heading', { name: 'Cuentas' })).toBeInTheDocument();
    expect(await screen.findByText(/301\.00 USD/)).toBeInTheDocument();
    expect(exchangeRateLabel()).toHaveTextContent('Tipo de cambio oficial venta: 1 USD = 1,550.00 ARS');
    expect(screen.getByText(/1,550\.25 ARS/)).toBeInTheDocument();
    expect(screen.getByText(/300\.00 USD/)).toBeInTheDocument();
    expect(screen.getByText('Requiere atencion')).toBeInTheDocument();
    expect(screen.getByText('ARS — 2 cuentas')).toBeInTheDocument();
    expect(screen.getByText('USD — 2 cuentas')).toBeInTheDocument();
  });

  it('marks the exchange rate as positive when it went up', async () => {
    mockAuth();
    mockDolarOficial({ venta: 1550 });
    mockDolarPrevio(1500);
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    const label = await screen.findByText(/Tipo de cambio oficial venta/);
    const value = await within(label).findByTitle(/^Subio/);
    const change = value.querySelector('[aria-hidden="true"]')?.parentElement;

    expect(value).toHaveTextContent('1,550.00 ARS ▲ +50.00 (+3.33%)');
    expect(value.className).not.toMatch(/up|down/);
    expect(change.className).toMatch(/up/);
    expect(change.className).not.toMatch(/down/);
  });

  it('marks the exchange rate as negative when it went down', async () => {
    mockAuth();
    mockDolarOficial({ venta: 1500 });
    mockDolarPrevio(1550);
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    const label = await screen.findByText(/Tipo de cambio oficial venta/);
    const value = await within(label).findByTitle(/^Bajo/);
    const change = value.querySelector('[aria-hidden="true"]')?.parentElement;

    expect(value).toHaveTextContent('1,500.00 ARS ▼ -50.00 (-3.23%)');
    expect(value.className).not.toMatch(/up|down/);
    expect(change.className).toMatch(/down/);
    expect(change.className).not.toMatch(/up/);
  });

  it('shows a green zero variation when the exchange rate did not move', async () => {
    mockAuth();
    mockDolarOficial({ venta: 1550 });
    mockDolarPrevio(1550);
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    const label = await screen.findByText(/Tipo de cambio oficial venta/);
    const value = await within(label).findByTitle('Sin cambios respecto del cierre anterior');
    const change = value.querySelector('[aria-hidden="true"]')?.parentElement;

    expect(value).toHaveTextContent('1,550.00 ARS ▲ 0.00 (0.00%)');
    expect(value.className).not.toMatch(/flat|down/);
    expect(change.className).toMatch(/flat/);
    expect(value.textContent).toMatch(/▲/);
    expect(value.textContent).not.toMatch(/▼/);
  });

  it('keeps showing the exchange rate when the historical API fails', async () => {
    mockAuth();
    mockDolarOficial({ venta: 1550 });
    getDolarOficialPorFecha.mockRejectedValue(
      new Error('No se pudo consultar ArgentinaDatos: error de red')
    );
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    const label = await screen.findByText(/Tipo de cambio oficial venta/);

    await waitFor(() => expect(getDolarOficialPorFecha).toHaveBeenCalled());
    expect(label).toHaveTextContent('Tipo de cambio oficial venta: 1 USD = 1,550.00 ARS');
    expect(label.textContent).not.toMatch(/[▲▼]/);
  });

  it('keeps accounts visible when DolarAPI fails', async () => {
    mockAuth();
    getDolarOficial.mockRejectedValue(new Error('No se pudo consultar DolarAPI: error de red'));
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    expect(await screen.findByText('Principal')).toBeInTheDocument();
    expect(await screen.findByText(/No disponible/)).toBeInTheDocument();
    expect(screen.getByText('No se pudo cargar el tipo de cambio')).toBeInTheDocument();
    expect(screen.getAllByText('1,500.25 ARS').length).toBeGreaterThan(0);
  });

  it('shows a loading state while the official exchange rate is pending', async () => {
    mockAuth();
    getDolarOficial.mockReturnValue(new Promise(() => {}));
    getAccounts.mockResolvedValue([account({ balance: '1500.25', currency: 'ARS' })]);

    renderAccountsPage();

    expect(await screen.findByText(/Calculando\.\.\./)).toBeInTheDocument();
    expect(screen.getByText('Cargando tipo de cambio...')).toBeInTheDocument();
    expect(screen.queryByText(/No disponible/)).not.toBeInTheDocument();
  });

  it('filters accounts with chips and search', async () => {
    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([
      account({ alias: 'Principal ARS' }),
      account({ id: 'account-2', accountNumber: '000001000002', currency: 'USD', alias: 'Dolares' }),
      account({ id: 'account-3', accountNumber: '000001000003', status: 'BLOCKED', alias: 'Bloqueada' }),
    ]);

    renderAccountsPage();

    expect(await screen.findByText('Principal ARS')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'USD (1)' }));

    expect(screen.getByText('Dolares')).toBeInTheDocument();
    expect(screen.queryByText('Principal ARS')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 3 cuentas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Todas (3)' }));
    await userEvent.type(screen.getByRole('searchbox'), 'bloqueada');

    expect(screen.getAllByText('Bloqueada').length).toBeGreaterThan(0);
    expect(screen.queryByText('Dolares')).not.toBeInTheDocument();
  });

  it('opens drawer and creates an account', async () => {
    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([]);
    createAccount.mockResolvedValue(account({ id: 'new-account', accountNumber: '000001000009', alias: 'Nueva USD', currency: 'USD' }));

    renderAccountsPage();

    await screen.findByText('No tenes cuentas creadas.');
    await userEvent.click(screen.getByRole('button', { name: '+ Nueva cuenta' }));

    const drawer = screen.getByRole('dialog', { name: 'Nueva cuenta' });
    await userEvent.selectOptions(within(drawer).getByLabelText('Moneda'), 'USD');
    await userEvent.type(within(drawer).getByLabelText('Alias opcional'), 'Nueva USD');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Crear cuenta' }));

    expect(createAccount).toHaveBeenCalledWith('token', { currency: 'USD', alias: 'Nueva USD' });
    expect(await screen.findByText('Nueva USD')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Nueva cuenta' })).not.toBeInTheDocument();
  });

  it('disables transfer action for blocked accounts', async () => {
    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([account({ status: 'BLOCKED' })]);

    renderAccountsPage();

    await screen.findByText('Bloqueada');

    expect(screen.queryByRole('link', { name: 'Ver transferencias de cuenta 000001000001' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Transferencias no disponibles para cuentas bloqueadas')).toBeDisabled();
  });

  it('exports CSV with text-safe account numbers', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:accounts');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([account({ accountNumber: '000001000001', alias: '=Formula' })]);

    renderAccountsPage();

    await screen.findByText('=Formula');
    await userEvent.click(screen.getByRole('button', { name: 'CSV' }));

    const [blob] = createObjectUrl.mock.calls[0];
    const csv = await blob.text();

    expect(csv).toContain("'000001000001");
    expect(csv).toContain("'=Formula");

    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    anchorClick.mockRestore();
  });

  it('opens a printable view of the visible accounts for the PDF export', async () => {
    const written = [];
    const printWindow = {
      document: { open: vi.fn(), write: vi.fn((html) => written.push(html)), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow);

    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([
      account({ id: 'account-1', accountNumber: '000001000001', balance: '100.50', currency: 'ARS', alias: '<b>Sueldo</b>' }),
      account({ id: 'account-2', accountNumber: '000001000002', balance: '20.25', currency: 'ARS' }),
    ]);

    renderAccountsPage();

    await screen.findByText('<b>Sueldo</b>');
    await userEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    const html = written.join('');
    expect(html).toContain('000001000001');
    expect(html).toContain('000001000002');
    expect(html).toContain('&lt;b&gt;Sueldo&lt;/b&gt;');
    expect(html).not.toContain('<b>Sueldo</b>');
    expect(html).toContain('Total ARS');
    expect(html).toContain('120.75');
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(printWindow.addEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));

    openSpy.mockRestore();
  });

  it('tells the user to allow pop-ups when the printable view cannot open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    mockAuth();
    mockDolarOficial();
    getAccounts.mockResolvedValue([account({ accountNumber: '000001000001' })]);

    renderAccountsPage();

    await screen.findByText('000001000001');
    await userEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('ventanas emergentes'));

    openSpy.mockRestore();
    alertSpy.mockRestore();
  });
});

function renderAccountsPage() {
  return render(
    <MemoryRouter initialEntries={['/accounts']}>
      <AccountsPage />
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

function mockDolarOficial(overrides = {}) {
  getDolarOficial.mockResolvedValue({
    moneda: 'USD',
    casa: 'oficial',
    nombre: 'Dolar Oficial',
    compra: 1500,
    venta: 1550,
    fechaActualizacion: '2026-07-31T18:55:00.000Z',
    ...overrides,
  });
  getDolarOficialPorFecha.mockResolvedValue(null);
}

function mockDolarPrevio(venta, fecha = '2026-07-30') {
  getDolarOficialPorFecha.mockResolvedValue({ casa: 'oficial', compra: venta - 50, venta, fecha });
}

function exchangeRateLabel() {
  return screen.getByText(/Tipo de cambio oficial venta/);
}

function account(overrides = {}) {
  return {
    id: 'account-1',
    userId: 'user-1',
    accountNumber: '000001000001',
    alias: 'Principal',
    currency: 'ARS',
    balance: '1500.25',
    status: 'ACTIVE',
    createdAt: '2026-07-27T12:00:00Z',
    updatedAt: '2026-07-27T12:00:00Z',
    ...overrides,
  };
}
