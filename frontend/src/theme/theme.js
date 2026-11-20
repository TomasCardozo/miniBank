export const THEME_STORAGE_KEY = 'minibank-theme';
export const THEME_VALUES = ['light', 'dark'];

export function isValidTheme(value) {
  return THEME_VALUES.includes(value);
}

export function getStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  return isValidTheme(storedTheme) ? storedTheme : null;
}

export function getSystemTheme() {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

export function applyTheme(theme) {
  if (!isValidTheme(theme)) {
    return;
  }

  document.documentElement.dataset.theme = theme;
}
