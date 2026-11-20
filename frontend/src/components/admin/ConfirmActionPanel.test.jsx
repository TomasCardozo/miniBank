import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmActionPanel from './ConfirmActionPanel';

describe('ConfirmActionPanel', () => {
  it('focuses the title and calls the handlers', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmActionPanel
        title="¿Bloquear cuenta?"
        description="El titular no podrá operar."
        confirmLabel="Confirmar bloqueo"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: '¿Bloquear cuenta?' })).toHaveFocus();
    expect(screen.getByText('El titular no podrá operar.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar bloqueo' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders a modal dialog that closes with Escape or a click outside', async () => {
    const onCancel = vi.fn();

    render(
      <ConfirmActionPanel title="¿Bloquear cuenta?" confirmLabel="Confirmar bloqueo" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    const dialog = screen.getByRole('dialog', { name: '¿Bloquear cuenta?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(dialog);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(dialog.parentElement);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps focus inside and restores it on close', async () => {
    const { rerender } = render(<button type="button">Abrir</button>);
    screen.getByRole('button', { name: 'Abrir' }).focus();

    rerender(
      <>
        <button type="button">Abrir</button>
        <ConfirmActionPanel title="¿Activar?" confirmLabel="Confirmar" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    );

    expect(screen.getByRole('heading', { name: '¿Activar?' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    rerender(<button type="button">Abrir</button>);
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not close while busy', async () => {
    const onCancel = vi.fn();

    render(
      <ConfirmActionPanel title="¿Acreditar?" confirmLabel="Confirmar" busy onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await userEvent.keyboard('{Escape}');
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('shows the busy label and disables the buttons while busy', () => {
    render(
      <ConfirmActionPanel
        title="¿Acreditar?"
        confirmLabel="Confirmar acreditación"
        busyLabel="Acreditando…"
        busy
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Acreditando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
