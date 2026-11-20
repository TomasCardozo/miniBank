import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getAccounts } from '../api/accountsApi';
import { getTransfers } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import TransferFiltersForm from '../components/transfers/TransferFiltersForm';
import TransfersTable from '../components/transfers/TransfersTable';
import { TRANSFER_LIST_DEFAULT_FILTERS } from '../components/transfers/transferListConfig';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import styles from './TransfersPage.module.css';

export default function TransfersPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const initialAccountId = searchParams.get('accountId') || '';
  const initialFilters = { ...TRANSFER_LIST_DEFAULT_FILTERS, accountId: initialAccountId };
  const fetchTransfersPage = useCallback((query) => getTransfers(auth.accessToken, query), [auth.accessToken]);
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState(null);
  const {
    filters,
    query,
    pageData: transfersPage,
    content: transfers,
    currentPage,
    totalPages,
    totalElements,
    loading: loadingTransfers,
    error: transfersError,
    handleFilterChange,
    handleSubmit,
    handleClearFilters,
    handlePageChange,
  } = usePaginatedQuery({
    defaultFilters: TRANSFER_LIST_DEFAULT_FILTERS,
    initialFilters,
    resetFilters: TRANSFER_LIST_DEFAULT_FILTERS,
    syncKey: initialAccountId,
    fetchPage: fetchTransfersPage,
  });
  const hasMultiplePages = totalPages > 1;
  const filteredAccount = accounts.find((account) => account.id === query.accountId);

  useEffect(() => {
    let ignore = false;

    async function loadAccounts() {
      setLoadingAccounts(true);
      setAccountsError(null);

      try {
        const response = await getAccounts(auth.accessToken);

        if (!ignore) {
          setAccounts(Array.isArray(response) ? response : []);
        }
      } catch (apiError) {
        if (!ignore) {
          setAccountsError(apiError);
        }
      } finally {
        if (!ignore) {
          setLoadingAccounts(false);
        }
      }
    }

    loadAccounts();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken]);

  return (
    <main className={`${styles.page} ${styles.listPage}`}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Transferencias</h1>
          {filteredAccount ? <p className="body-lg text-muted break-anywhere">N° de Cuenta: {filteredAccount.accountNumber}</p> : null}
        </div>
        <Link to="/transfers/new" className={styles.newTransferLink}>
          Nueva transferencia
        </Link>
      </header>

      <section className={`ds-panel ${styles.panel} ${styles.listPanel} ${styles.unifiedPanel}`} aria-label="Transferencias">
        <div className={styles.filtersInset}>
          {loadingAccounts ? <Loading /> : null}
          <ErrorMessage error={accountsError} />

          <TransferFiltersForm
            filters={filters}
            onFilterChange={handleFilterChange}
            onSubmit={handleSubmit}
            onClearFilters={handleClearFilters}
            className={styles.filtersForm}
            fieldClassName={styles.filterField}
            actionsClassName={styles.filterActions}
            accountFilter={
              <p className={`${styles.filterField} ds-field`}>
                <label htmlFor="accountId">Cuenta</label>
                <select id="accountId" name="accountId" value={filters.accountId} onChange={handleFilterChange} className="ds-input">
                  <option value="">Todas</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} - {account.currency} - {account.alias || 'Sin alias'}
                    </option>
                  ))}
                </select>
              </p>
            }
          />
        </div>

        {loadingTransfers ? (
          <div className={styles.inset}>
            <Loading />
          </div>
        ) : null}
        {transfersError ? (
          <div className={styles.inset}>
            <ErrorMessage error={transfersError} />
          </div>
        ) : null}

        {!loadingTransfers && !transfersError && transfers.length === 0 ? (
          <p className={`${styles.emptyState} ${styles.inset}`}>No hay transferencias para mostrar.</p>
        ) : null}

        {transfers.length > 0 ? (
          <div className={`${styles.tableFrame} ds-table-frame`}>
            <TransfersTable
              transfers={transfers}
              caption="Transferencias propias"
              detailPathForTransfer={(transfer) => `/transfers/${transfer.id}`}
              tableClassName={styles.table}
              detailLinkClassName={styles.detailLink}
            />
          </div>
        ) : null}

        {transfersPage ? (
          <div className={styles.pagination}>
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              loading={loadingTransfers}
              disabled={!hasMultiplePages}
              onPageChange={handlePageChange}
              ariaLabel="Paginación de transferencias"
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
