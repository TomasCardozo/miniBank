import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getAdminTransfers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import TransferFiltersForm from '../components/transfers/TransferFiltersForm';
import TransfersTable from '../components/transfers/TransfersTable';
import { TRANSFER_LIST_DEFAULT_FILTERS } from '../components/transfers/transferListConfig';
import { STATUSES } from '../components/transfers/transferStatus';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import { readFiltersFromSearchParams } from '../utils/searchParamFilters';
import listStyles from './TransfersPage.module.css';
import styles from './AdminTransfersPage.module.css';

const SHORT_ID_LENGTH = 8;
const ACTIVE_FILTER_KEYS = ['status', 'from', 'to', 'accountId'];

export default function AdminTransfersPage() {
  const auth = useAuth();
  const fetchTransfersPage = useCallback((query) => getAdminTransfers(auth.accessToken, query), [auth.accessToken]);
  const [searchParams] = useSearchParams();
  const urlKey = searchParams.toString();
  const [accountSync, setAccountSync] = useState({ key: 0, filters: undefined, urlKey });
  const urlFilters = readFiltersFromSearchParams(searchParams, TRANSFER_LIST_DEFAULT_FILTERS);
  const syncedFilters = accountSync.filters && accountSync.urlKey === urlKey ? accountSync.filters : urlFilters;
  const [accountLabels, setAccountLabels] = useState({});
  const {
    filters,
    query,
    pageData: transfersPage,
    content: transfers,
    currentPage,
    totalPages,
    totalElements,
    loading,
    error,
    handleFilterChange,
    handleSubmit,
    handleClearFilters,
    handlePageChange,
  } = usePaginatedQuery({
    defaultFilters: TRANSFER_LIST_DEFAULT_FILTERS,
    initialFilters: syncedFilters,
    resetFilters: TRANSFER_LIST_DEFAULT_FILTERS,
    syncKey: `${urlKey}#${accountSync.key}`,
    fetchPage: fetchTransfersPage,
  });
  const hasMultiplePages = totalPages > 1;
  const hasActiveFilters = ACTIVE_FILTER_KEYS.some((key) => query[key] !== TRANSFER_LIST_DEFAULT_FILTERS[key]);
  const isForbidden = error?.status === 403;
  const activeAccountId = query.accountId;
  const activeAccountLabel = activeAccountId ? accountLabels[activeAccountId] || findAccountNumber(transfers, activeAccountId) || shortenId(activeAccountId) : null;

  function applyAccountFilter(accountId) {
    const appliedFilters = Object.fromEntries(Object.keys(TRANSFER_LIST_DEFAULT_FILTERS).map((key) => [key, query[key]]));
    setAccountSync((current) => ({ key: current.key + 1, filters: { ...appliedFilters, accountId }, urlKey }));
  }

  function handleAccountClick(accountId, accountNumber) {
    setAccountLabels((current) => ({ ...current, [accountId]: accountNumber }));
    applyAccountFilter(accountId);
  }

  function renderAccount(transfer, side) {
    const accountId = side === 'source' ? transfer.sourceAccountId : transfer.targetAccountId;
    const accountNumber = side === 'source' ? transfer.sourceAccountNumber : transfer.targetAccountNumber;

    if (!accountId) {
      return accountNumber || '-';
    }

    return (
      <button
        type="button"
        className={styles.accountButton}
        onClick={() => handleAccountClick(accountId, accountNumber)}
        aria-label={`Filtrar por cuenta ${side === 'source' ? 'origen' : 'destino'} ${accountNumber}`}
        title="Filtrar por esta cuenta"
      >
        {accountNumber}
      </button>
    );
  }

  return (
    <main className={`${listStyles.page} ${listStyles.listPage}`}>
      <header className={`${listStyles.pageHeader} ${styles.pageHeader}`}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Transferencias del sistema</h1>
          <p className="body-lg text-muted">
            Todas las transferencias de todos los clientes
            {transfersPage ? (
              <>
                {' · '}
                <span>{formatCount(totalElements)}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className="ds-button ds-button-secondary" to="/admin/audit-logs">
            Ver auditoría
          </Link>
          <Link className="ds-button ds-button-secondary" to="/admin">
            Volver a admin
          </Link>
        </div>
      </header>

      <section className={`ds-panel ${listStyles.panel} ${listStyles.listPanel} ${styles.unifiedPanel}`} aria-label="Transferencias">
        <div className={styles.filtersInset}>
          <TransferFiltersForm
            filters={filters}
            onFilterChange={handleFilterChange}
            onSubmit={handleSubmit}
            onClearFilters={handleClearFilters}
            className={listStyles.filtersForm}
            fieldClassName={listStyles.filterField}
            actionsClassName={listStyles.filterActions}
            accountFilter={
              <p className={`${listStyles.filterField} ds-field`}>
                <label htmlFor="accountId">Cuenta (UUID)</label>
                <input
                  id="accountId"
                  name="accountId"
                  type="text"
                  value={filters.accountId}
                  onChange={handleFilterChange}
                  placeholder="UUID de cuenta"
                  className="ds-input"
                  autoComplete="off"
                  spellCheck={false}
                />
              </p>
            }
          />

          {activeAccountId ? (
            <p className={styles.activeFilters}>
              <span className={styles.activeFiltersLabel}>Filtro activo:</span>
              <span className={styles.chip} title={activeAccountId}>
                cuenta <span className={styles.chipValue}>{activeAccountLabel}</span>
                <button type="button" className={styles.chipRemove} onClick={() => applyAccountFilter('')} aria-label="Quitar filtro de cuenta">
                  ✕
                </button>
              </span>
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className={styles.inset}>
            <Loading />
          </div>
        ) : null}

        {isForbidden ? (
          <div className={`${styles.forbidden} ${styles.inset}`} role="alert">
            <p className={styles.forbiddenTitle}>No tenés permisos de administrador</p>
            <p className={styles.forbiddenText}>
              Esta sección requiere rol ADMIN. <Link to="/me">Ver mi usuario</Link>
            </p>
          </div>
        ) : error ? (
          <div className={styles.inset}>
            <ErrorMessage error={error} />
          </div>
        ) : null}

        {!loading && !error && transfers.length === 0 ? (
          <div className={`${listStyles.emptyState} ${styles.emptyState} ${styles.inset}`}>
            <p>No hay transferencias para los filtros aplicados.</p>
            {hasActiveFilters ? (
              <button type="button" className="ds-button ds-button-secondary" onClick={handleClearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {!error && transfers.length > 0 ? (
          <div className={`${listStyles.tableFrame} ${styles.tableFrame} ds-table-frame`} aria-busy={loading || undefined}>
            <TransfersTable
              transfers={transfers}
              caption="Transferencias del sistema"
              showId
              tableClassName={`${listStyles.table} ${styles.table}`}
              renderId={(transfer) => (
                <span className={styles.shortId} title={transfer.id}>
                  {shortenId(transfer.id)}
                </span>
              )}
              renderAccount={renderAccount}
              renderStatus={(transfer) => <StatusBadge status={transfer.status} />}
              renderFailureReason={(transfer) =>
                transfer.failureReason ? <span className={styles.failureReason}>{transfer.failureReason}</span> : '-'
              }
            />
          </div>
        ) : null}

        {transfersPage ? (
          <div className={styles.pagination}>
            <PaginationControls
              ariaLabel="Paginación de transferencias admin"
              page={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              loading={loading}
              disabled={!hasMultiplePages}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatusBadge({ status }) {
  const config = STATUSES[status] || { label: status || '-', badge: '', dot: '' };

  return (
    <span className={['ds-badge', config.badge, styles.statusBadge].filter(Boolean).join(' ')}>
      <span className={[styles.statusDot, styles[config.dot]].filter(Boolean).join(' ')} aria-hidden="true" />
      {config.label}
    </span>
  );
}

function shortenId(id) {
  const value = String(id || '');
  return value.length > SHORT_ID_LENGTH ? `${value.slice(0, SHORT_ID_LENGTH)}…` : value;
}

function findAccountNumber(transfers, accountId) {
  for (const transfer of transfers) {
    if (transfer.sourceAccountId === accountId) return transfer.sourceAccountNumber;
    if (transfer.targetAccountId === accountId) return transfer.targetAccountNumber;
  }
  return null;
}

function formatCount(total) {
  const value = total ?? 0;
  return `${value.toLocaleString('es-AR')} ${value === 1 ? 'transferencia' : 'transferencias'}`;
}
