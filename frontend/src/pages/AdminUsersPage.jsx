import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Eye, WalletCards } from 'lucide-react';
import { getAdminUsers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import { formatDateTime } from '../utils/formatters';
import { buildFilteredPath, readFiltersFromSearchParams } from '../utils/searchParamFilters';
import { getFullName, getInitials, getRoleLabel, getStatusDisplay, ROLES, STATUSES } from '../utils/userDisplay';
import styles from './AdminUsersPage.module.css';

const DEFAULT_FILTERS = {
  role: '',
  status: '',
  size: '20',
  sort: 'createdAt,DESC',
};

const SORT_OPTIONS = [
  { value: 'createdAt,DESC', label: 'Alta más reciente' },
  { value: 'createdAt,ASC', label: 'Alta más antigua' },
  { value: 'lastName,ASC', label: 'Apellido A-Z' },
  { value: 'lastName,DESC', label: 'Apellido Z-A' },
  { value: 'email,ASC', label: 'Email A-Z' },
  { value: 'email,DESC', label: 'Email Z-A' },
  { value: 'status,ASC', label: 'Estado A-Z' },
  { value: 'status,DESC', label: 'Estado Z-A' },
  { value: 'role,ASC', label: 'Rol A-Z' },
  { value: 'role,DESC', label: 'Rol Z-A' },
];

const PAGE_SIZES = ['5', '10', '20', '50'];

export default function AdminUsersPage() {
  const auth = useAuth();
  const fetchUsersPage = useCallback((query) => getAdminUsers(auth.accessToken, query), [auth.accessToken]);
  const [searchParams] = useSearchParams();
  const {
    filters,
    query,
    pageData: usersPage,
    content: users,
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
    defaultFilters: DEFAULT_FILTERS,
    initialFilters: readFiltersFromSearchParams(searchParams, DEFAULT_FILTERS),
    resetFilters: DEFAULT_FILTERS,
    syncKey: searchParams.toString(),
    fetchPage: fetchUsersPage,
  });
  const forbidden = error?.status === 403;

  return (
    <main className={`${styles.page} ${styles.listPage}`}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Usuarios</h1>
          <p className={styles.metadata}>{buildMetadata(usersPage ? totalElements : null, query)}</p>
        </div>
        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to="/admin">
          ← Volver a admin
        </Link>
      </header>

      <section className={`ds-panel ${styles.panel} ${styles.listPanel}`} aria-label="Usuarios">
        <div className={styles.filtersInset}>
          <form className={styles.filtersForm} onSubmit={handleSubmit}>
            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="role">Rol</label>
              <select className="ds-input" id="role" name="role" value={filters.role} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {Object.entries(ROLES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>

            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="status">Estado</label>
              <select className="ds-input" id="status" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {Object.entries(STATUSES).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>

            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="sort">Orden</label>
              <select className="ds-input" id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </p>

            <p className={`ds-field ${styles.filterField}`}>
              <label htmlFor="size">Tamaño de página</label>
              <select className="ds-input" id="size" name="size" value={filters.size} onChange={handleFilterChange}>
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </p>

            <div className={styles.filterActions}>
              <button className={`ds-button ds-button-primary ${styles.actionButton}`} type="submit">
                Aplicar filtros
              </button>
              <button className={`ds-button ds-button-secondary ${styles.actionButton}`} type="button" onClick={handleClearFilters}>
                Limpiar filtros
              </button>
            </div>
          </form>
        </div>

        {loading ? <Loading /> : null}

        {forbidden ? (
          <div className={styles.forbidden} role="alert">
            <p>No tenés permisos de administrador para ver usuarios.</p>
            <Link className={styles.detailLink} to="/dashboard">
              Ir al dashboard
            </Link>
          </div>
        ) : (
          <ErrorMessage error={error} />
        )}

        {!loading && !error && users.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay usuarios con estos filtros.</p>
            <button className="ds-button ds-button-secondary" type="button" onClick={handleClearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {!error && users.length > 0 ? (
          <div className={`${styles.tableFrame} ds-table-frame`} aria-busy={loading || undefined}>
            <table className={`ds-table ${styles.table}`}>
              <caption>Usuarios del sistema</caption>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Alta</th>
                  <th scope="col" className={styles.actionsHeader}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {usersPage && !error ? (
          <PaginationControls
            ariaLabel="Paginación de usuarios"
            page={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            loading={loading}
            onPageChange={handlePageChange}
          />
        ) : null}
      </section>
    </main>
  );
}

function UserRow({ user }) {
  const status = getStatusDisplay(user.status);
  const fullName = getFullName(user);

  return (
    <tr>
      <th scope="row" className={styles.userCell}>
        <span className={styles.userIdentity}>
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(user)}
          </span>
          <span className={styles.userText}>
            <span className={styles.userName}>{fullName || user.email}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </span>
        </span>
      </th>
      <td className={styles.numeric}>{user.documentNumber || '-'}</td>
      <td>
        <span className="ds-badge">{getRoleLabel(user.role)}</span>
      </td>
      <td>
        <span className={`ds-badge ${status.badge} ${styles.statusBadge}`}>
          <span className={`${styles.statusDot} ${styles[status.dot] || ''}`} aria-hidden="true" />
          {status.label}
        </span>
      </td>
      <td className={styles.numeric}>
        <time dateTime={user.createdAt} title={user.updatedAt ? `Actualizado: ${formatDateTime(user.updatedAt)}` : undefined}>
          {formatDate(user.createdAt)}
        </time>
      </td>
      <td className={styles.actionsCell}>
        <span className={styles.rowActions}>
          <Link
            className={`ds-icon-button ${styles.rowAction}`}
            to={buildFilteredPath('/admin/accounts/actions', { userId: user.id })}
            aria-label={`Ver cuentas de ${fullName || user.email}`}
            title="Ver cuentas"
          >
            <WalletCards size={16} aria-hidden="true" />
          </Link>
          <Link
            className={`ds-icon-button ${styles.rowAction}`}
            to={`/admin/users/${user.id}`}
            aria-label={`Ver detalle de ${fullName || user.email}`}
            title="Ver detalle"
          >
            <Eye size={16} aria-hidden="true" />
          </Link>
        </span>
      </td>
    </tr>
  );
}

function buildMetadata(total, query) {
  const parts = [];

  if (total !== null) {
    parts.push(total === 1 ? '1 usuario' : `${total} usuarios`);
  }

  parts.push(`Rol: ${query.role ? getRoleLabel(query.role) : 'Todos'}`);
  parts.push(`Estado: ${query.status ? getStatusDisplay(query.status).label : 'Todos'}`);

  return parts.join(' · ');
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
