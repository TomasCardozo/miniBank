import { useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Server,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { getInitials } from '../../utils/userDisplay';
import NavItem from './NavItem';
import styles from './Sidebar.module.css';

const homeItem = { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' };

const customerItems = [
  { to: '/accounts', icon: CreditCard, label: 'Cuentas' },
  { to: '/transfers', icon: ArrowLeftRight, label: 'Transferencias' },
  { to: '/me', icon: UserRound, label: 'Mi usuario' },
];

const adminItems = [
  { to: '/system', icon: Server, label: 'Sistema' },
  { to: '/admin', icon: ShieldCheck, label: 'Admin' },
];

const navigationGroups = [
  { label: 'Principal', items: [homeItem], requiresAuth: false },
  { label: 'Cuenta', items: customerItems, requiresAuth: true },
];

export default function Sidebar({ user, isAuthenticated, isAdmin, isOpen, onLogout, onClose }) {
  const sidebarRef = useRef(null);
  const initials = getInitials(user);
  const displayName = getDisplayName(user);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    sidebarRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = sidebarRef.current?.querySelectorAll(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  function handleLogout() {
    onClose();
    onLogout();
  }

  return (
    <>
      {isOpen ? (
        <button type="button" className={styles.backdrop} onClick={onClose} aria-label="Cerrar menu" />
      ) : null}

      <aside
        id="main-sidebar"
        ref={sidebarRef}
        className={`${styles.sidebar} bg-page overflow-y-auto ${isOpen ? styles.open : ''}`}
        aria-label="Navegacion principal"
        tabIndex={-1}
      >
        <div className={`${styles.inner} flex flex-col`}>
          <div className={`${styles.brand} flex items-center`}>
            <span className={`${styles.brandName} font-display text-main`}>MiniBank</span>
          </div>

          <nav className={`${styles.navigation} grid gap-4`}>
            {navigationGroups.map((group) => {
              if (group.requiresAuth && !isAuthenticated) {
                return null;
              }

              return (
                <div key={group.label} className={styles.navGroup}>
                  <p className={styles.groupLabel}>{group.label}</p>
                  <ul className={`${styles.list} grid gap-2 m-0 p-0`}>
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavItem {...item} onNavigate={onClose} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {isAdmin ? (
              <div className={styles.navGroup}>
                <p className={styles.groupLabel}>Administracion</p>
                <ul className={`${styles.list} grid gap-2 m-0 p-0`}>
                  {adminItems.map((item) => (
                    <li key={item.to}>
                      <NavItem {...item} onNavigate={onClose} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </nav>

          <div className={`${styles.sidebarBottom} grid gap-3`}>
            {isAuthenticated ? (
              <div className={`${styles.userPanel} grid gap-3`}>
                <div className={`${styles.userSummary} flex items-center gap-3 min-w-0`}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials}
                  </span>
                  <div>
                    <p>{displayName}</p>
                    <span>{user?.role || 'Usuario'}</span>
                  </div>
                </div>
                <button type="button" className={`${styles.logoutButton} ds-button`} onClick={handleLogout}>
                  <LogOut size={14.4} aria-hidden="true" />
                  Cerrar sesion
                </button>
              </div>
            ) : null}

          </div>
        </div>
      </aside>
    </>
  );
}

function getDisplayName(user) {
  if (user?.firstName || user?.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }

  return user?.email || 'MiniBank';
}
