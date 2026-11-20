import { Outlet } from 'react-router';
import styles from './PublicAuthLayout.module.css';

export default function PublicAuthLayout() {
  return (
    <main className={`${styles.page} grid overflow-y-auto p-4 body`}>
      <section className={`${styles.card} grid gap-5`} aria-label="Autenticacion">
        <Outlet />
      </section>
    </main>
  );
}
