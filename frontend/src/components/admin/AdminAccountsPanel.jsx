import { useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { getAdminAccounts } from '../../api/adminApi';
import usePaginatedQuery from '../../hooks/usePaginatedQuery';
import { formatMoneyAmount } from '../../utils/formatters';
import { getFullName } from '../../utils/userDisplay';
import ErrorMessage from '../ErrorMessage';
import Loading from '../Loading';
import PaginationControls from '../PaginationControls';
import styles from './AdminAccountsPanel.module.css';

export const ADMIN_ACCOUNT_DEFAULT_FILTERS = {
  userId: '',
  status: '',
  currency: '',
  size: '20',
  sort: 'createdAt,DESC',
};

const FILTER_KEYS = ['userId', 'status', 'currency'];
const UUID_INPUT_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const ACCOUNT_STATUSES = {
  ACTIVE: { label: 'Activa', badge: 'ds-badge-success' },
  BLOCKED: { label: 'Bloqueada', badge: 'ds-badge-danger' },
  CLOSED: { label: 'Cerrada', badge: '' },
};

const SORT_OPTIONS = [
  { value: 'createdAt,DESC', label: 'Más recientes' },
  { value: 'createdAt,ASC', label: 'Más antiguas' },
  { value: 'accountNumber,ASC', label: 'Número de cuenta' },
  { value: 'balance,DESC', label: 'Mayor saldo' },
  { value: 'balance,ASC', label: 'Menor saldo' },
  { value: 'status,ASC', label: 'Estado' },
];

const PAGE_SIZES = ['10', '20', '50'];

export default function AdminAccountsPanel({
  accessToken,
  initialFilters,
  syncKey,
  selectedAccount,
  overrides,
  onSelect,
  onDeselect,
  onClearUser,
}) {
  const fetchAccountsPage = useCallback((query) => getAdminAccounts(accessToken, query), [accessToken]);
  const {
    filters,
    query,
    pageData,
    content,
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
    defaultFilters: ADMIN_ACCOUNT_DEFAULT_FILTERS,
    initialFilters,
    resetFilters: ADMIN_ACCOUNT_DEFAULT_FILTERS,
    syncKey,
    fetchPage: fetchAccountsPage,
  });
  const accounts = content.map((account) => (overrides[account.id] ? { ...account, ...overrides[account.id] } : account));
  const hasAppliedFilters = FILTER_KEYS.some((key) => query[key] !== ADMIN_ACCOUNT_DEFAULT_FILTERS[key]);
  const ownerLabel = query.userId ? getOwnerLabel(accounts[0]) : null;
  const forbidden = error?.status === 403;
  const isSelecting = Boolean(selectedAccount);

  return (
    <section className={`ds-panel ${styles.panel} ${isSelecting ? styles.natural : ''}`} aria-label="Cuentas">
      <div className={styles.inset}>
        {isSelecting ? <SelectedAccountBar account={selectedAccount} onDeselect={onDeselect} /> : null}

        {!isSelecting ? (
          <form className={styles.filtersForm} onSubmit={handleSubmit} aria-label="Filtros de cuentas">
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="accountsUserId">Usuario (ID)</label>
              <input
                className="ds-input"
                id="accountsUserId"
                name="userId"
                value={filters.userId}
                onChange={handleFilterChange}
                placeholder="UUID del titular"
                pattern={UUID_INPUT_PATTERN}
                title="UUID del titular"
                autoComplete="off"
                spellCheck={false}
              />
            </p>
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="accountsStatus">Estado</label>
              <select className="ds-input" id="accountsStatus" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {Object.entries(ACCOUNT_STATUSES).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="accountsCurrency">Moneda</label>
              <select className="ds-input" id="accountsCurrency" name="currency" value={filters.currency} onChange={handleFilterChange}>
                <option value="">Todas</option>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </p>
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="accountsSort">Orden</label>
              <select className="ds-input" id="accountsSort" name="sort" value={filters.sort} onChange={handleFilterChange}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </p>
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="accountsSize">Tamaño de página</label>
              <select className="ds-input" id="accountsSize" name="size" value={filters.size} onChange={handleFilterChange}>
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
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
        ) : null}

        {!isSelecting && query.userId ? (
          <p className={styles.activeFilter}>
            <span>
              Cuentas de <strong>{ownerLabel || shortId(query.userId)}</strong>
            </span>
            <button
              type="button"
              className={styles.chipButton}
              onClick={onClearUser}
              aria-label="Quitar filtro de usuario"
              title="Ver todas las cuentas"
            >
              ✕
            </button>
          </p>
        ) : null}
      </div>

      {!isSelecting && loading ? (
        <div className={styles.inset}>
          <Loading />
        </div>
      ) : null}

      {!isSelecting && error ? (
        <div className={styles.inset}>
          {forbidden ? (
            <p className={styles.forbidden} role="alert">
              No tenés permisos de administrador para ver cuentas.
            </p>
          ) : (
            <ErrorMessage error={error} />
          )}
        </div>
      ) : null}

      {!isSelecting && !loading && !error && accounts.length === 0 ? (
        <div className={styles.inset}>
          <div className={styles.emptyState}>
            <p>{hasAppliedFilters ? 'No hay cuentas con estos filtros.' : 'Todavía no hay cuentas.'}</p>
            {hasAppliedFilters ? (
              <button className="ds-button ds-button-secondary" type="button" onClick={handleClearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isSelecting && !error && accounts.length > 0 ? (
        <div className={styles.tableFrame} aria-busy={loading || undefined}>
          <table className={`ds-table ${styles.table}`}>
            <caption>Cuentas del sistema</caption>
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Titular</th>
                <th scope="col">Moneda</th>
                <th scope="col" className={styles.amountHeader}>
                  Saldo
                </th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!isSelecting && pageData && !error ? (
        <div className={styles.pagination}>
          <PaginationControls
            ariaLabel="Paginación de cuentas"
            page={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            loading={loading}
            onPageChange={handlePageChange}
          />
        </div>
      ) : null}
    </section>
  );
}

function SelectedAccountBar({ account, onDeselect }) {
  const owner = getOwnerLabel(account);

  return (
    <div className={styles.selectedBar}>
      <p className={styles.selectedSummary}>
        <ChevronRight size={16} aria-hidden="true" />
        <span className={styles.accountNumber}>{account.accountNumber}</span>
        {owner ? (
          <>
            <span aria-hidden="true">·</span>
            <span className={styles.ownerName}>{owner}</span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        className={`ds-button ds-button-secondary ${styles.changeButton}`}
        onClick={onDeselect}
        aria-label={`Cambiar cuenta (deseleccionar ${account.accountNumber})`}
      >
        <X size={16} aria-hidden="true" />
        Cambiar cuenta
      </button>
    </div>
  );
}

function AccountRow({ account, onSelect }) {
  const status = ACCOUNT_STATUSES[account.status] || { label: account.status, badge: '' };
  const owner = getOwnerLabel(account);

  return (
    <tr>
      <th scope="row" className={styles.accountCell}>
        <span className={styles.accountNumber}>{account.accountNumber}</span>
        <span className={styles.secondaryText}>{account.alias || 'Sin alias'}</span>
      </th>
      <td>
        <span className={styles.ownerName}>{owner || '-'}</span>
        {account.ownerEmail ? <span className={styles.secondaryText}>{account.ownerEmail}</span> : null}
      </td>
      <td>
        <span className="ds-badge">{account.currency}</span>
      </td>
      <td className={styles.amountCell}>{formatMoneyAmount(account.balance, account.currency)}</td>
      <td>
        <span className={`ds-badge ${status.badge}`}>{status.label}</span>
      </td>
      <td className={styles.selectCell}>
        <button
          type="button"
          className={`ds-button ds-button-secondary ${styles.selectButton}`}
          onClick={() => onSelect(account)}
          aria-label={`Operar sobre la cuenta ${account.accountNumber}`}
        >
          Operar
        </button>
      </td>
    </tr>
  );
}

function getOwnerLabel(account) {
  if (!account) {
    return null;
  }

  return getFullName({ firstName: account.ownerFirstName, lastName: account.ownerLastName }) || account.ownerEmail || null;
}

function shortId(id) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
