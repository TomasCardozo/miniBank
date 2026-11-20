import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/useAuth';
import ThemeProvider from '../theme/ThemeProvider';
import { THEME_STORAGE_KEY } from '../theme/theme';
import AppLayout from './AppLayout';

describe('AppLayout theme toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockMatchMedia(false);
  });

  it('shows an accessible theme toggle in the header', async () => {
    renderAppLayout();

    const toggle = screen.getByRole('button', { name: 'Tema oscuro' });
    expect(toggle).not.toHaveTextContent('Tema:');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);

    const updatedToggle = screen.getByRole('button', { name: 'Tema oscuro' });
    expect(updatedToggle).not.toHaveTextContent('Tema:');
    expect(updatedToggle).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes search and orders authenticated header actions', () => {
    renderAppLayout({
      isAuthenticated: true,
      user: { email: 'ada@example.com', role: 'CUSTOMER' },
    });

    expect(screen.queryByRole('search')).not.toBeInTheDocument();

    const messages = screen.getByText('Mensajes');
    const alerts = screen.getByText('Alertas');
    const toggle = screen.getByRole('button', { name: 'Tema oscuro' });

    expect(messages.compareDocumentPosition(alerts)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(alerts.compareDocumentPosition(toggle)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('opens the messages and alerts trays with an under construction notice, one at a time', async () => {
    renderAppLayout({
      isAuthenticated: true,
      user: { email: 'ada@example.com', role: 'CUSTOMER' },
    });

    const messagesButton = screen.getByRole('button', { name: 'Mensajes: 3' });
    const alertsButton = screen.getByRole('button', { name: 'Alertas: 2' });
    expect(messagesButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(messagesButton);

    const messagesTray = screen.getByRole('dialog', { name: 'Mensajes' });
    expect(within(messagesTray).getByText('En construcción')).toBeInTheDocument();
    expect(within(messagesTray).getByText(/Muy pronto/)).toBeInTheDocument();
    expect(messagesButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(messagesTray).getByRole('heading', { name: 'Mensajes' })).toHaveFocus();

    await userEvent.click(alertsButton);

    expect(screen.queryByRole('dialog', { name: 'Mensajes' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Alertas' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(alertsButton).toHaveFocus();
  });

  it('closes a tray with its close button or a click outside', async () => {
    renderAppLayout({
      isAuthenticated: true,
      user: { email: 'ada@example.com', role: 'CUSTOMER' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Mensajes: 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar mensajes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Alertas: 2' }));
    await userEvent.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function renderAppLayout(authOverrides = {}) {
  const authValue = {
    accessToken: null,
    user: null,
    error: null,
    loading: false,
    isAuthenticated: false,
    logout: vi.fn(),
    ...authOverrides,
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<p>Home</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

function mockMatchMedia(matches) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}
