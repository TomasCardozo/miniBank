import { Link } from 'react-router';
import styles from './Dashboard.module.css';

export default function QuickActionsPanel() {
  return (
    <article className={`ds-panel ${styles.panel}`}>
      <h2 className="mb-3">Acciones rapidas</h2>
      <nav className={styles.quickActions} aria-label="Acciones rapidas">
        <Link className={`ds-button ds-button-primary ${styles.quickAction}`} to="/transfers/new">
          Transferir dinero
        </Link>
        <Link className={`ds-button ds-button-secondary ${styles.quickAction}`} to="/accounts">Gestionar cuentas</Link>
      </nav>
    </article>
  );
}
