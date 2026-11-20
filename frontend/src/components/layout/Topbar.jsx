import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Mail, Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';
import TopbarInbox from './TopbarInbox';
import styles from './Topbar.module.css';

export default function Topbar({ isAuthenticated, isSidebarOpen, onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === 'dark' ? 'claro' : 'oscuro';
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const [openInbox, setOpenInbox] = useState(null);
  const closeInbox = useCallback(() => setOpenInbox(null), []);

  function toggleInbox(name) {
    setOpenInbox((current) => (current === name ? null : name));
  }

  return (
    <header className={`${styles.topbar} sticky top-0 grid items-center bg-page`}>
      <button
        type="button"
        className={`${styles.menuButton} ds-button ds-button-secondary`}
        onClick={onMenuClick}
        aria-label="Abrir menu"
        aria-expanded={isSidebarOpen}
        aria-controls="main-sidebar"
      >
        <Menu size={16} aria-hidden="true" />
        Menu
      </button>

      <div className={`${styles.actions} flex items-center justify-end gap-3`}>
        {isAuthenticated ? (
          <>
            <TopbarInbox
              icon={Mail}
              label="Mensajes"
              count={3}
              emptyHint="Acá vas a ver los mensajes de MiniBank."
              isOpen={openInbox === 'messages'}
              onToggle={() => toggleInbox('messages')}
              onClose={closeInbox}
            />

            <TopbarInbox
              icon={Bell}
              label="Alertas"
              count={2}
              emptyHint="Acá vas a ver las alertas de tus cuentas y transferencias."
              isOpen={openInbox === 'alerts'}
              onToggle={() => toggleInbox('alerts')}
              onClose={closeInbox}
            />
          </>
        ) : (
          <div className={`${styles.publicLinks} flex items-center gap-3`}>
            <Link to="/login">Login</Link>
            <Link to="/register">Registro</Link>
          </div>
        )}

        <button
          type="button"
          className={`${styles.themeToggle} ds-icon-button`}
          onClick={toggleTheme}
          aria-label="Tema oscuro"
          aria-pressed={theme === 'dark'}
          title={`Cambiar a tema ${nextThemeLabel}`}
        >
          <ThemeIcon size={14.4} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
