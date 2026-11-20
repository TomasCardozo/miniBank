import { Link } from 'react-router';
import useFitCount from '../../hooks/useFitCount';
import ErrorMessage from '../ErrorMessage';
import Loading from '../Loading';
import { formatAmount } from '../../utils/formatters';
import styles from './Dashboard.module.css';

export default function AccountsPanel({ accounts, loading, error, isAmountsVisible = true }) {
  const { containerRef, count } = useFitCount(`.${styles.accountItem}`, accounts.length);
  const visibleAccounts = count ? accounts.slice(0, count) : accounts;

  return (
    <article className={`ds-panel ${styles.panel} ${styles.listPanel}`}>
      <div className="flex items-start justify-between gap-3 max-sm:grid">
        <h2 className="mb-3">Cuentas</h2>
        <Link className="body-sm text-primary-strong hover:text-primary" to="/accounts">Ver todas</Link>
      </div>
      <div ref={containerRef} className={styles.panelBody}>
        {loading ? <Loading /> : null}
        <ErrorMessage error={error} />

        {!loading && !error && visibleAccounts.length === 0 ? <p className="ds-empty-state">No tenes cuentas creadas.</p> : null}

        {!loading && !error && visibleAccounts.length > 0 ? (
          <ul className={styles.accountList}>
            {visibleAccounts.map((account) => (
              <li key={account.id} className={styles.accountItem}>
                <div>
                  <Link to={`/accounts/${account.id}`}>{account.alias || 'Cuenta sin alias'}</Link>
                  <p className={styles.itemMeta}>
                    {account.accountNumber} - {account.currency} - {account.status}
                  </p>
                </div>
                <span className={`amount ${styles.itemAmount}`}>{formatAccountBalance(account, isAmountsVisible)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function formatAccountBalance(account, isAmountsVisible) {
  if (isAmountsVisible) {
    return formatAmount(account.balance, account.currency);
  }

  return account.currency ? `-,---.-- ${account.currency}` : '-,---.--';
}
