import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccounts } from '../api/accountsApi';
import { createTransfer } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import NewTransferPage from './NewTransferPage';

vi.mock('../api/accountsApi', () => ({
  getAccounts: vi.fn(),
}));

vi.mock('../api/transfersApi', () => ({
  createTransfer: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../components/transfers/transferReceiptImage', () => ({
  createReceiptImageFile: () => Promise.resolve(null),
}));

describe('NewTransferPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders a single section title without duplicating the form title', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);

    renderNewTransferPage();

    expect(screen.getByRole('link', { name: 'Transferencias' })).toHaveAttribute('href', '/transfers');
    expect(screen.getByText('Transferi fondos entre tus cuentas o hacia una cuenta de terceros.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva transferencia' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Detalle de la transferencia' })).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente Paso' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear transferencia' })).not.toBeInTheDocument();
  });

  it('preselects the source account passed in the url', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([
      account({ id: 'account-1', accountNumber: '000001000001' }),
      account({ id: 'account-2', accountNumber: '000001000002' }),
    ]);

    renderNewTransferPage('/transfers/new?sourceAccountId=account-2');

    expect(await screen.findByText(/Saldo disponible:/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta origen')).toHaveValue('account-2');
  });

  it('ignores a source account in the url that is not one of the user accounts', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);

    renderNewTransferPage('/transfers/new?sourceAccountId=someone-else');

    expect(await screen.findByRole('option', { name: 'Selecciona una cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta origen')).toHaveValue('');
  });

  it('shows the available balance for the selected source account', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([
      account({ id: 'account-1', balance: '123456.78', accountNumber: '000001000001' }),
      account({ id: 'account-2', balance: '98765.43', accountNumber: '000001000002' }),
    ]);

    renderNewTransferPage();

    expect(await screen.findByRole('option', { name: 'Selecciona una cuenta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta origen')).toHaveValue('');
    expect(screen.queryByText(/Saldo disponible:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /10%/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');

    expect(screen.getByText('Saldo disponible: $123,456.78 ARS')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-2');

    expect(screen.getByText('Saldo disponible: $98,765.43 ARS')).toBeInTheDocument();
  });

  it('shows the details of a destination account that belongs to the user once the number is complete', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([
      account({ id: 'account-1' }),
      account({ id: 'account-2', accountNumber: '000001000002', currency: 'USD', alias: 'Ahorro dolares' }),
    ]);

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    const targetInput = screen.getByLabelText('Numero de cuenta destino');

    await userEvent.type(targetInput, '00000100000');

    expect(screen.queryByText('USD - Ahorro dolares')).not.toBeInTheDocument();

    await userEvent.type(targetInput, '2');

    expect(screen.getByText('USD - Ahorro dolares')).toBeInTheDocument();

    await userEvent.clear(targetInput);
    await userEvent.type(targetInput, '999999999999');

    expect(screen.queryByText('USD - Ahorro dolares')).not.toBeInTheDocument();
  });

  it('sets the amount from dynamic suggested amount chips rounded to the nearest hundred', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1', balance: '123456.78' })]);

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    const suggestedAmount = screen.getByRole('button', { name: '10% $12,300.00 ARS' });
    expect(suggestedAmount).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(suggestedAmount);

    expect(screen.getByLabelText('Monto')).toHaveValue('12,300.00');
    expect(suggestedAmount).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText(/Monto ingresado:/)).not.toBeInTheDocument();
  });

  it('rounds suggested amounts below 10 to the nearest integer', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1', balance: '88.00' })]);

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.click(screen.getByRole('button', { name: '10% $9.00 ARS' }));

    expect(screen.getByLabelText('Monto')).toHaveValue('9.00');
    expect(screen.queryByLabelText(/Monto ingresado:/)).not.toBeInTheDocument();
  });

  it('formats typed amount digits as cents with fixed thousands and decimal separators', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    const amountInput = screen.getByLabelText('Monto');

    await userEvent.type(amountInput, '123456');

    expect(amountInput).toHaveValue('1,234.56');
  });

  it('submits a typed formatted amount as the raw decimal value', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);
    createTransfer.mockResolvedValue({
      id: 'transfer-1',
      sourceAccountNumber: '000001000001',
      targetAccountNumber: '000001000002',
      amount: '1234.56',
      currency: 'ARS',
      status: 'COMPLETED',
      failureReason: null,
    });

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.type(screen.getByLabelText('Numero de cuenta destino'), '000001000002');
    await userEvent.type(screen.getByLabelText('Monto'), '123456');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente Paso' }));

    expect(createTransfer).not.toHaveBeenCalled();
    expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Revisa los datos antes de confirmar' })).toHaveFocus();
    expect(screen.getByText('000001000001 - ARS - Principal')).toBeInTheDocument();
    expect(screen.getByText('000001000002')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56 ARS')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferencia' }));

    await waitFor(() =>
      expect(createTransfer).toHaveBeenCalledWith('token', {
        sourceAccountId: 'account-1',
        targetAccountNumber: '000001000002',
        amount: '1234.56',
        description: null,
      })
    );
  });

  it('submits the selected suggested amount as the raw decimal value', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1', balance: '123456.78' })]);
    createTransfer.mockResolvedValue({
      id: 'transfer-1',
      sourceAccountNumber: '000001000001',
      targetAccountNumber: '000001000002',
      amount: '12300.00',
      currency: 'ARS',
      status: 'COMPLETED',
      failureReason: null,
    });

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.type(screen.getByLabelText('Numero de cuenta destino'), '000001000002');
    await userEvent.click(screen.getByRole('button', { name: '10% $12,300.00 ARS' }));
    expect(screen.getByLabelText('Monto')).toHaveValue('12,300.00');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente Paso' }));
    expect(createTransfer).not.toHaveBeenCalled();
    expect(screen.getByText('$12,300.00 ARS')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferencia' }));

    await waitFor(() =>
      expect(createTransfer).toHaveBeenCalledWith('token', {
        sourceAccountId: 'account-1',
        targetAccountNumber: '000001000002',
        amount: '12300.00',
        description: null,
      })
    );
  });

  it('translates a known backend error code and clears it when going back to edit', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);
    createTransfer.mockRejectedValue({
      status: 404,
      code: 'TRANSFER_INVALID_TARGET',
      message: 'Target account not found',
      path: '/transfers',
      details: { timestamp: '2026-09-16T12:00:00Z' },
    });

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.type(screen.getByLabelText('Numero de cuenta destino'), '000001000002');
    await userEvent.type(screen.getByLabelText('Monto'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente Paso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferencia' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(
      'No encontramos una cuenta disponible con ese número. Verificá que sea correcto y que use la misma moneda que tu cuenta origen.'
    );
    expect(alert).not.toHaveTextContent('Target account not found');
    expect(alert).not.toHaveTextContent('TRANSFER_INVALID_TARGET');
    expect(alert).not.toHaveTextContent('404');

    await userEvent.click(screen.getByRole('button', { name: 'Editar datos' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Numero de cuenta destino')).toHaveValue('000001000002');
  });

  it('falls back to a generic message for an unmapped backend error code', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);
    createTransfer.mockRejectedValue({ status: 500, code: 'SOMETHING_NEW', message: 'boom' });

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.type(screen.getByLabelText('Numero de cuenta destino'), '000001000002');
    await userEvent.type(screen.getByLabelText('Monto'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente Paso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferencia' }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Ocurrió un problema al procesar la transferencia.');
    expect(alert).not.toHaveTextContent('boom');

    await userEvent.click(screen.getByRole('button', { name: 'Editar datos' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the sent transfer summary and resets the form for a new transfer', async () => {
    mockAuth();
    getAccounts.mockResolvedValue([account({ id: 'account-1' })]);
    createTransfer.mockResolvedValue({
      id: 'transfer-1',
      sourceAccountNumber: '000001000001',
      targetAccountNumber: '000001000002',
      amount: '7500.00',
      currency: 'ARS',
      status: 'COMPLETED',
      failureReason: null,
    });

    renderNewTransferPage();

    await screen.findByRole('option', { name: '000001000001 - ARS - Principal' });
    await userEvent.selectOptions(screen.getByLabelText('Cuenta origen'), 'account-1');
    await userEvent.type(screen.getByLabelText('Numero de cuenta destino'), '000001000002');
    await userEvent.type(screen.getByLabelText('Monto'), '750000');
    await userEvent.type(screen.getByLabelText('Descripcion opcional'), 'Pago alquiler');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente Paso' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferencia' }));

    const sentHeading = await screen.findByRole('heading', { level: 2, name: 'Transferencia enviada' });
    expect(sentHeading).toHaveFocus();
    expect(screen.queryByRole('heading', { level: 2, name: 'Detalle de la transferencia' })).not.toBeInTheDocument();
    expect(screen.getByText('transfer-1')).toBeInTheDocument();
    expect(screen.getByText('000001000001')).toBeInTheDocument();
    expect(screen.getByText('000001000002')).toBeInTheDocument();
    expect(screen.getByText('$7,500.00 ARS')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument();
    expect(screen.queryByText('Motivo de fallo')).not.toBeInTheDocument();
    const newTransferButton = screen.getByRole('button', { name: 'Hacer nueva transferencia' });
    expect(screen.queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument();

    await userEvent.click(newTransferButton);

    expect(screen.queryByRole('heading', { name: 'Transferencia enviada' })).not.toBeInTheDocument();
    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente Paso' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta origen')).toHaveValue('');
    expect(screen.getByLabelText('Numero de cuenta destino')).toHaveValue('');
    expect(screen.getByLabelText('Monto')).toHaveValue('');
    expect(screen.getByLabelText('Descripcion opcional')).toHaveValue('');
  });
});

function renderNewTransferPage(path = '/transfers/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NewTransferPage />
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
