import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransferReceipt from './TransferReceipt';
import { createReceiptImageFile } from './transferReceiptImage';

vi.mock('./transferReceiptImage', () => ({
  createReceiptImageFile: vi.fn(),
}));

describe('TransferReceipt', () => {
  beforeEach(() => {
    createReceiptImageFile.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('shows the completed status as a translated badge and hides the failure reason', () => {
    render(<TransferReceipt transfer={transfer()} />);

    expect(screen.getByText('$555.55 ARS')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toHaveClass('ds-badge', 'ds-badge-success');
    expect(screen.queryByText('Motivo de fallo')).not.toBeInTheDocument();
    expect(screen.getByText('ID de transferencia')).toBeInTheDocument();
    expect(screen.getByText('transfer-1')).toBeInTheDocument();
  });

  it('keeps the failure reason visible for a rejected transfer', () => {
    render(<TransferReceipt transfer={transfer({ status: 'REJECTED', failureReason: 'Saldo insuficiente' })} />);

    expect(screen.getByText('Rechazada')).toHaveClass('ds-badge-danger');
    expect(screen.getByText('Motivo de fallo')).toBeInTheDocument();
    expect(screen.getByText('Saldo insuficiente')).toBeInTheDocument();
  });

  it('shares the receipt image when the browser can share files', async () => {
    const file = new File(['png'], 'comprobante-minibank.png', { type: 'image/png' });
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);

    createReceiptImageFile.mockResolvedValue(file);
    vi.stubGlobal('navigator', { ...navigator, share, canShare });

    render(<TransferReceipt transfer={transfer()} />);
    await waitFor(() => expect(createReceiptImageFile).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: 'Comprobante de transferencia',
      text: expect.stringContaining('Comprobante de transferencia - MiniBank'),
    });
  });

  it('shares only the text when the browser cannot share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => false });

    render(<TransferReceipt transfer={transfer()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(share).toHaveBeenCalledWith({
      title: 'Comprobante de transferencia',
      text: expect.stringContaining('Monto: $555.55 ARS'),
    });
    expect(share.mock.calls[0][0].files).toBeUndefined();
  });

  it('downloads the image when the Web Share API is missing', async () => {
    const file = new File(['png'], 'comprobante-minibank.png', { type: 'image/png' });
    const createObjectURL = vi.fn().mockReturnValue('blob:receipt');
    const revokeObjectURL = vi.fn();

    createReceiptImageFile.mockResolvedValue(file);
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    render(<TransferReceipt transfer={transfer()} />);
    await waitFor(() => expect(createReceiptImageFile).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt');
    expect(await screen.findByText('Descargamos la imagen del comprobante para que puedas compartirla.')).toBeInTheDocument();
  });

  it('falls back to the clipboard when neither sharing nor the image are available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });

    render(<TransferReceipt transfer={transfer()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Estado: Completada'));
    expect(await screen.findByText('Copiamos el comprobante al portapapeles.')).toBeInTheDocument();
  });

  it('reports a failed clipboard fallback', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));

    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });

    render(<TransferReceipt transfer={transfer()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    expect(await screen.findByText('No pudimos compartir el comprobante. Intentá de nuevo.')).toBeInTheDocument();
  });
});

function transfer(overrides = {}) {
  return {
    id: 'transfer-1',
    sourceAccountNumber: '000001000001',
    targetAccountNumber: '000001000002',
    amount: '555.55',
    currency: 'ARS',
    status: 'COMPLETED',
    failureReason: null,
    createdAt: '2026-07-27T12:00:00Z',
    ...overrides,
  };
}
