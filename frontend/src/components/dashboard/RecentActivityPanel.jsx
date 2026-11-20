import { Link } from 'react-router';
import useFitCount from '../../hooks/useFitCount';
import ErrorMessage from '../ErrorMessage';
import Loading from '../Loading';
import { formatAmount, formatDateTime } from '../../utils/formatters';
import styles from './Dashboard.module.css';

export default function RecentActivityPanel({ transfers, loading, error }) {
  const { containerRef, count } = useFitCount(`.${styles.activityItem}`, transfers.length);
  const visibleTransfers = count ? transfers.slice(0, count) : transfers;

  return (
    <article className={`ds-panel ${styles.panel} ${styles.widePanel} ${styles.listPanel}`}>
      <div className="flex items-start justify-between gap-3 max-sm:grid">
        <h2 className="mb-3">Actividad reciente</h2>
        <Link className="body-sm text-primary-strong hover:text-primary" to="/transfers">Ver transferencias</Link>
      </div>
      <div ref={containerRef} className={styles.panelBody}>
        {loading ? <Loading /> : null}
        <ErrorMessage error={error} />

        {!loading && !error && transfers.length === 0 ? <p className="ds-empty-state">No hay transferencias para mostrar.</p> : null}

        {!loading && !error && transfers.length > 0 ? (
          <ul className={styles.activityList}>
            {visibleTransfers.map((transfer) => (
              <li key={transfer.id} className={styles.activityItem}>
                <div>
                  <Link to={`/transfers/${transfer.id}`}>{transfer.description || 'Transferencia'}</Link>
                  <p className={styles.itemMeta}>
                    {transfer.sourceAccountNumber} &rarr; {transfer.targetAccountNumber} - {transfer.status} -{' '}
                    {formatDateTime(transfer.createdAt)}
                  </p>
                </div>
                <span className={`amount ${styles.itemAmount}`}>{formatAmount(transfer.amount, transfer.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
