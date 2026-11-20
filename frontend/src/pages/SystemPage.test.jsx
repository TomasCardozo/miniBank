import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFlywayInfo, getHealth } from '../api/systemApi';
import { useAuth } from '../auth/useAuth';
import SystemPage from './SystemPage';

vi.mock('../api/systemApi', () => ({
  getHealth: vi.fn(),
  getFlywayInfo: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('SystemPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ accessToken: null, user: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('checks the backend on load and shows it as operational', async () => {
    getHealth.mockResolvedValue({ status: 'UP' });

    renderPage();

    const hero = screen.getByRole('region', { name: 'Estado del backend' });
    expect(await within(hero).findByText('Operativo')).toBeInTheDocument();
    expect(within(hero).getByText('UP')).toBeInTheDocument();
    expect(within(hero).getByText(/\d+ ms/)).toBeInTheDocument();
    expect(getHealth).toHaveBeenCalledTimes(1);
    expect(getHealth).toHaveBeenCalledWith(undefined);
    expect(getFlywayInfo).not.toHaveBeenCalled();
    expect(screen.getByText(/disponibles para administradores/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Swagger UI/ })).toHaveAttribute('href', expect.stringContaining('/swagger-ui.html'));
    expect(screen.getByRole('link', { name: /OpenAPI JSON/ })).toHaveAttribute('href', expect.stringContaining('/v3/api-docs'));
  });

  it('shows the backend as unavailable when the healthcheck fails and lets you retry', async () => {
    getHealth.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { status: undefined }));
    getHealth.mockResolvedValueOnce({ status: 'UP' });

    renderPage();

    const hero = screen.getByRole('region', { name: 'Estado del backend' });
    expect(await within(hero).findByText('No disponible')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo contactar al backend');

    await userEvent.click(screen.getByRole('button', { name: 'Verificar de nuevo' }));

    expect(await within(hero).findByText('Operativo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getHealth).toHaveBeenCalledTimes(2);
  });

  it('marks a DOWN backend', async () => {
    getHealth.mockResolvedValue({ status: 'DOWN' });

    renderPage();

    expect(await within(screen.getByRole('region', { name: 'Estado del backend' })).findByText('Caído')).toBeInTheDocument();
  });

  it('shows health components and the database schema to admins', async () => {
    useAuth.mockReturnValue({ accessToken: 'admin-token', user: { role: 'ADMIN' } });
    getHealth.mockResolvedValue({
      status: 'UP',
      components: {
        db: { status: 'UP', details: { database: 'PostgreSQL', validationQuery: 'isValid()' } },
        diskSpace: { status: 'UP', details: { total: 536870912000, free: 214748364800, threshold: 10485760, exists: true } },
        ping: { status: 'UP' },
      },
    });
    getFlywayInfo.mockResolvedValue({
      contexts: {
        application: {
          flywayBeans: {
            flyway: {
              migrations: [
                migration({ version: '1', description: 'create users table', installedOn: '2026-07-28T23:11:38Z' }),
                migration({ version: '11', description: 'backfill admin credit movements', installedOn: '2026-11-19T21:34:00Z' }),
                migration({ version: null, description: 'seed local demo data', installedOn: '2026-11-19T21:31:00Z' }),
              ],
            },
          },
        },
      },
    });

    renderPage();

    expect(getHealth).toHaveBeenCalledWith('admin-token');
    const components = await screen.findByRole('region', { name: 'Componentes' });
    expect(await within(components).findByText('Base de datos')).toBeInTheDocument();
    expect(within(components).getByText('PostgreSQL')).toBeInTheDocument();
    expect(within(components).getByText('200 GB libres de 500 GB')).toBeInTheDocument();
    expect(within(components).getAllByText('Operativo')).toHaveLength(3);

    const schema = screen.getByRole('region', { name: 'Esquema de base de datos' });
    expect((await within(schema).findByText('Versión actual')).closest('div')).toHaveTextContent('V11');
    expect(within(schema).getByText('Aplicadas').closest('div')).toHaveTextContent('3');
    expect(within(schema).getByText('Ver las 3 migraciones')).toBeInTheDocument();
    expect(getFlywayInfo).toHaveBeenCalledWith('admin-token');
    expect(screen.queryByText(/disponibles para administradores/)).not.toBeInTheDocument();
  });
});

function migration(overrides) {
  return { type: 'SQL', script: `V${overrides.version ?? 'R'}.sql`, state: 'SUCCESS', installedRank: 1, ...overrides };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SystemPage />
    </MemoryRouter>
  );
}
