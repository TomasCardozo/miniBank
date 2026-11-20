import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateAdminUser, blockAdminUser, getAdminUser } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminUserDetailPage from './AdminUserDetailPage';

vi.mock('../api/adminApi', () => ({
  getAdminUser: vi.fn(),
  blockAdminUser: vi.fn(),
  activateAdminUser: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('AdminUserDetailPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads the user and shows the identity with Spanish labels', async () => {
    mockAuth();
    getAdminUser.mockResolvedValue(user());

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando...');

    const hero = await screen.findByRole('region', { name: 'Resumen del usuario' });
    expect(getAdminUser).toHaveBeenCalledWith('token', 'user-1');
    expect(within(hero).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(hero).getByText('AL')).toBeInTheDocument();
    expect(within(hero).getByText('Activo')).toBeInTheDocument();
    expect(within(hero).getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText(/^Cliente desde /)).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Volver a usuarios' })).toHaveAttribute('href', '/admin/users');
  });

  it('shows loading errors', async () => {
    mockAuth();
    getAdminUser.mockRejectedValue({ status: 404, message: 'Usuario no encontrado' });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no encontrado');
    expect(screen.queryByRole('region', { name: 'Resumen del usuario' })).not.toBeInTheDocument();
  });

  it('shows a permissions message on 403', async () => {
    mockAuth();
    getAdminUser.mockRejectedValue({ status: 403, message: 'Forbidden' });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No tenés permisos de administrador');
    expect(within(alert).getByRole('link', { name: 'Ir al dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('copies the document number to the clipboard', async () => {
    mockAuth();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    getAdminUser.mockResolvedValue(user());

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    await userEvent.click(screen.getByRole('button', { name: 'Copiar Documento' }));

    expect(writeText).toHaveBeenCalledWith('12345678');
    expect(await screen.findByText('Copiamos el documento al portapapeles.')).toBeInTheDocument();
  });

  it('enables only the block action for active users and blocks after confirming', async () => {
    mockAuth();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getAdminUser.mockResolvedValue(user());
    let resolveBlock;
    blockAdminUser.mockReturnValue(
      new Promise((resolve) => {
        resolveBlock = resolve;
      })
    );

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    expect(screen.getByRole('button', { name: 'Activar usuario' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bloquear usuario' }));

    expect(window.confirm).toHaveBeenCalled();
    const busyButton = screen.getByRole('button', { name: 'Bloqueando…' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    resolveBlock(user({ status: 'BLOCKED' }));

    expect(await screen.findByText('Usuario bloqueado.')).toBeInTheDocument();
    expect(blockAdminUser).toHaveBeenCalledWith('token', 'user-1');
    expect(within(screen.getByRole('region', { name: 'Resumen del usuario' })).getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloquear usuario' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Activar usuario' })).toBeEnabled();
  });

  it('does not block when the confirmation is cancelled', async () => {
    mockAuth();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    getAdminUser.mockResolvedValue(user());

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear usuario' }));

    expect(blockAdminUser).not.toHaveBeenCalled();
  });

  it('activates blocked users after confirming', async () => {
    mockAuth();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getAdminUser.mockResolvedValue(user({ status: 'BLOCKED' }));
    activateAdminUser.mockResolvedValue(user({ status: 'ACTIVE' }));

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    expect(screen.getByRole('button', { name: 'Bloquear usuario' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Activar usuario' }));

    expect(await screen.findByText('Usuario activado.')).toBeInTheDocument();
    expect(activateAdminUser).toHaveBeenCalledWith('token', 'user-1');
    expect(screen.getByRole('button', { name: 'Bloquear usuario' })).toBeEnabled();
  });

  it('shows action errors', async () => {
    mockAuth();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    getAdminUser.mockResolvedValue(user());
    blockAdminUser.mockRejectedValue({ status: 409, message: 'No se pudo bloquear' });

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    await userEvent.click(screen.getByRole('button', { name: 'Bloquear usuario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo bloquear');
    expect(screen.getByRole('button', { name: 'Bloquear usuario' })).toBeEnabled();
  });

  it('disables both actions for closed users', async () => {
    mockAuth();
    getAdminUser.mockResolvedValue(user({ status: 'CLOSED' }));

    renderPage();
    await screen.findByRole('region', { name: 'Resumen del usuario' });

    expect(screen.getByRole('button', { name: 'Bloquear usuario' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Activar usuario' })).toBeDisabled();
    expect(screen.getByText('Los usuarios cerrados no se pueden bloquear ni activar.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Resumen del usuario' })).getByText('Cerrado')).toBeInTheDocument();
  });
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users/user-1']}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function mockAuth() {
  useAuth.mockReturnValue({
    accessToken: 'token',
    user: { role: 'ADMIN' },
    isAuthenticated: true,
    loading: false,
  });
}

function user(overrides = {}) {
  return {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    documentNumber: '12345678',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdAt: '2026-07-27T12:00:00Z',
    updatedAt: '2026-07-28T12:00:00Z',
    ...overrides,
  };
}
