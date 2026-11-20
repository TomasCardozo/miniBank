import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeProvider from './ThemeProvider';
import { THEME_STORAGE_KEY } from './theme';
import { useTheme } from './useTheme';

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('uses a stored dark theme', async () => {
    mockMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    renderThemeConsumer();

    expect(screen.getByText('Tema actual: dark')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('ignores invalid stored theme values and uses the system theme', async () => {
    mockMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    renderThemeConsumer();

    expect(screen.getByText('Tema actual: dark')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('uses the system light theme when there is no stored preference', async () => {
    mockMatchMedia(false);

    renderThemeConsumer();

    expect(screen.getByText('Tema actual: light')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('persists the selected theme and applies it to the document element', async () => {
    mockMatchMedia(false);

    renderThemeConsumer();
    await userEvent.click(screen.getByRole('button', { name: 'Alternar tema' }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByText('Tema actual: dark')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('follows system theme changes while there is no stored preference', async () => {
    const mediaQuery = mockMatchMedia(false);

    renderThemeConsumer();

    expect(screen.getByText('Tema actual: light')).toBeInTheDocument();

    act(() => {
      mediaQuery.dispatchChange(true);
    });

    expect(screen.getByText('Tema actual: dark')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });

  it('does not follow system theme changes when there is a stored preference', async () => {
    const mediaQuery = mockMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    renderThemeConsumer();

    expect(screen.getByText('Tema actual: light')).toBeInTheDocument();

    act(() => {
      mediaQuery.dispatchChange(true);
    });

    expect(screen.getByText('Tema actual: light')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });
});

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <p>Tema actual: {theme}</p>
      <button type="button" onClick={toggleTheme}>
        Alternar tema
      </button>
    </>
  );
}

function renderThemeConsumer() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );
}

function mockMatchMedia(matches) {
  const listeners = new Set();
  const mediaQuery = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_eventName, listener) => listeners.add(listener),
    removeEventListener: (_eventName, listener) => listeners.delete(listener),
    dispatchChange(nextMatches) {
      this.matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches }));
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue(mediaQuery),
  });

  return mediaQuery;
}
