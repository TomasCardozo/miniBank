import { useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, getSystemTheme, isValidTheme, THEME_STORAGE_KEY } from './theme';
import { ThemeContext } from './useTheme';

export default function ThemeProvider({ children }) {
  const [manualTheme, setManualTheme] = useState(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const activeTheme = manualTheme || systemTheme;

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (manualTheme) {
      return undefined;
    }

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    if (!mediaQuery) {
      return undefined;
    }

    function handleChange(event) {
      setSystemTheme(event.matches ? 'dark' : 'light');
    }

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [manualTheme]);

  function selectTheme(theme) {
    if (!isValidTheme(theme)) {
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setManualTheme(theme);
  }

  function toggleTheme() {
    selectTheme(activeTheme === 'dark' ? 'light' : 'dark');
  }

  const value = {
    theme: activeTheme,
    setTheme: selectTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
