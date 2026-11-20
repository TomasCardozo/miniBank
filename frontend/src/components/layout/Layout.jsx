import { useState } from 'react';
import { Outlet } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import styles from './Layout.module.css';

export default function Layout() {
  const auth = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isAdmin = auth.user?.role === 'ADMIN';

  return (
    <div className={`${styles.layout} bg-page overflow-hidden`}>
      <Sidebar
        user={auth.user}
        isAuthenticated={auth.isAuthenticated}
        isAdmin={isAdmin}
        isOpen={isSidebarOpen}
        onLogout={auth.logout}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className={`${styles.shell} grid min-w-0 overflow-hidden bg-page`}>
        <Topbar
          isAuthenticated={auth.isAuthenticated}
          isSidebarOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        <main className={`${styles.content} grid gap-5 overflow-auto`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
