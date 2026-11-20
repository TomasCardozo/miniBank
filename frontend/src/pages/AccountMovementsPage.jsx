import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getAccount } from '../api/accountsApi';
import { getAccountMovements } from '../api/movementsApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import { MOVEMENT_TYPES } from '../constants/enums';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import { formatAmount, formatDateTime } from '../utils/formatters';
import styles from './AccountMovementsPage.module.css';

const DEFAULT_FILTERS = {
  from: '',
  to: '',
  type: '',
  size: '20',
  sort: 'createdAt,DESC',
};

export default function AccountMovementsPage() {
  const { accountId } = useParams();
  const auth = useAuth();
  const [account, setAccount] = useState(null);
  const fetchMovementsPage = useCallback(
    (query) => getAccountMovements(auth.accessToken, accountId, query),
    [accountId, auth.accessToken]
  );
  const {
    filters,
    pageData: movementsPage,
    content: movements,
    currentPage,
    totalPages,
    totalElements,
    loading,
    error,
    hasPendingFilters,
    handleFilterChange,
    handleSubmit,
    handleClearFilters,
    handlePageChange,
  } = usePaginatedQuery({
    defaultFilters: DEFAULT_FILTERS,
    fetchPage: fetchMovementsPage,
  });

  useEffect(() => {
    let ignore = false;

    getAccount(auth.accessToken, accountId)
      .then((response) => {
        if (!ignore) {
          setAccount(response);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [accountId, auth.accessToken]);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className="grid gap-2 min-w-0">
          <h1 className="h1">Movimientos de cuenta</h1>
          {account ? <p className="body-lg text-muted break-anywhere">N° de Cuenta: {account.accountNumber}</p> : null}
        </div>

        <nav className="action-links" aria-label="Acciones de movimientos">
          <Link className="ds-button ds-button-secondary" to={`/accounts/${accountId}`}>
            Volver a cuenta
          </Link>
        </nav>
      </header>

      <section className={`ds-panel ${styles.listPanel}`} aria-label="Movimientos">
        <div className={styles.filtersInset}>
          <form className={styles.filtersForm} onSubmit={handleSubmit}>
            <p className="ds-field mb-0">
              <label htmlFor="from">Desde</label>
              <input className="ds-input" id="from" name="from" type="datetime-local" value={filters.from} onChange={handleFilterChange} />
            </p>

            <p className="ds-field mb-0">
              <label htmlFor="to">Hasta</label>
              <input className="ds-input" id="to" name="to" type="datetime-local" value={filters.to} onChange={handleFilterChange} />
            </p>

            <p className="ds-field mb-0">
              <label htmlFor="type">Tipo</label>
              <select className="ds-input" id="type" name="type" value={filters.type} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </p>

            <p className="ds-field mb-0">
              <label htmlFor="sort">Orden</label>
              <select className="ds-input" id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}>
                <option value="createdAt,DESC">Fecha descendente</option>
                <option value="createdAt,ASC">Fecha ascendente</option>
                <option value="amount,DESC">Monto descendente</option>
                <option value="amount,ASC">Monto ascendente</option>
                <option value="type,ASC">Tipo ascendente</option>
                <option value="type,DESC">Tipo descendente</option>
              </select>
            </p>

            <p className="ds-field mb-0">
              <label htmlFor="size">Tamaño de página</label>
              <select className="ds-input" id="size" name="size" value={filters.size} onChange={handleFilterChange}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </p>

            <div className={styles.filterActions}>
              <button className="ds-button ds-button-primary" type="submit" disabled={loading}>
                Aplicar filtros
              </button>
              <button className="ds-button ds-button-secondary" type="button" onClick={handleClearFilters} disabled={loading}>
                Limpiar filtros
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <div className={styles.inset}>
            <Loading />
          </div>
        ) : null}
        {error ? (
          <div className={styles.inset}>
            <ErrorMessage error={error} />
          </div>
        ) : null}

        {!loading && !error && movements.length === 0 ? (
          <p className={`ds-empty-state ${styles.inset}`}>No hay movimientos para mostrar.</p>
        ) : null}

        {!loading && !error && movements.length > 0 ? (
          <div className={styles.tableFrame}>
            <table className={`ds-table ${styles.movementsTable}`}>
              <caption>Movimientos de cuenta</caption>
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className={styles.amount}>
                    Monto
                  </th>
                  <th scope="col" className={styles.amount}>
                    Saldo posterior
                  </th>
                  <th scope="col">Descripcion</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Transferencia</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className={styles.numeric}>{movement.accountNumber}</td>
                    <td>
                      <span className={`ds-badge ${getMovementBadgeClass(movement.type)}`}>{movement.type}</span>
                    </td>
                    <td className={styles.amount}>{formatMovementAmount(movement.amount)}</td>
                    <td className={styles.amount}>{formatMovementAmount(movement.balanceAfter)}</td>
                    <td className="break-anywhere">{movement.description || '-'}</td>
                    <td className={styles.numeric}>{formatDateTime(movement.createdAt)}</td>
                    <td>
                      {movement.transferId ? (
                        <Link className="ds-button ds-button-secondary" to={`/transfers/${movement.transferId}`}>
                          Ver Detalle
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !error && movementsPage ? (
          <div className={styles.pagination}>
            <PaginationControls
              ariaLabel="Paginacion de movimientos"
              page={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              loading={loading}
              disabled={hasPendingFilters}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function getMovementBadgeClass(type) {
  if (type === 'CREDIT') {
    return 'ds-badge-success';
  }

  if (type === 'DEBIT') {
    return 'ds-badge-warning';
  }

  return '';
}

function formatMovementAmount(amount) {
  const value = formatAmount(amount);

  return value === '-' ? value : `$ ${value}`;
}
