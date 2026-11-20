import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getAdminAuditLogs } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AuditLogsTable from '../components/audit/AuditLogsTable';
import {
  AUDIT_LOG_DEFAULT_FILTERS,
  AUDIT_LOG_FILTER_KEYS,
  AUDIT_LOG_PAGE_SIZES,
  AUDIT_LOG_SORT_OPTIONS,
  UUID_INPUT_PATTERN,
  getAuditActionLabel,
  getAuditEntityTypeLabel,
} from '../components/audit/auditLogConfig';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../constants/enums';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import { readFiltersFromSearchParams } from '../utils/searchParamFilters';
import styles from './AdminAuditLogsPage.module.css';

const FORBIDDEN_MESSAGE = 'No tenés permisos de administrador.';

export default function AdminAuditLogsPage() {
  const auth = useAuth();
  const fetchAuditLogsPage = useCallback((query) => getAdminAuditLogs(auth.accessToken, query), [auth.accessToken]);
  const [searchParams] = useSearchParams();
  const {
    filters,
    query,
    pageData: auditLogsPage,
    content: auditLogs,
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
    defaultFilters: AUDIT_LOG_DEFAULT_FILTERS,
    initialFilters: readFiltersFromSearchParams(searchParams, AUDIT_LOG_DEFAULT_FILTERS),
    resetFilters: AUDIT_LOG_DEFAULT_FILTERS,
    syncKey: searchParams.toString(),
    fetchPage: fetchAuditLogsPage,
  });
  const hasAppliedFilters = AUDIT_LOG_FILTER_KEYS.some((key) => query[key] !== AUDIT_LOG_DEFAULT_FILTERS[key]);
  const displayError = error?.status === 403 ? { ...error, message: FORBIDDEN_MESSAGE } : error;
  const showList = !error && auditLogs.length > 0;
  const showEmpty = !loading && !error && auditLogsPage && auditLogs.length === 0;

  function handleFiltersSubmit(event) {
    const form = event.currentTarget;

    if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
      event.preventDefault();
      form.reportValidity?.();
      return;
    }

    handleSubmit(event);
  }

  return (
    <main className={`${styles.page} ${styles.listPage}`}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Logs de auditoría</h1>
          <p className={styles.metadata}>
            {auditLogsPage && !error ? <span>{formatEventCount(totalElements)}</span> : <span>Actividad de seguridad y operaciones</span>}
            {buildFiltersSummary(query).map((item) => (
              <span key={item}> · {item}</span>
            ))}
          </p>
        </div>
        <Link className={`ds-button ds-button-secondary ${styles.backLink}`} to="/admin">
          Volver a admin
        </Link>
      </header>

      <section className={`ds-panel ${styles.panel} ${styles.listPanel}`} aria-label="Eventos de auditoría" aria-busy={loading}>
        <div className={styles.filtersInset}>
          <form className={styles.filtersForm} onSubmit={handleFiltersSubmit}>
            <p className={`${styles.filterField} ${styles.areaAction} ds-field`}>
              <label htmlFor="action">Acción</label>
              <select className="ds-input" id="action" name="action" value={filters.action} onChange={handleFilterChange}>
                <option value="">Todas</option>
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {getAuditActionLabel(action)}
                  </option>
                ))}
              </select>
            </p>

            <p className={`${styles.filterField} ${styles.areaEntityType} ds-field`}>
              <label htmlFor="entityType">Tipo de entidad</label>
              <select className="ds-input" id="entityType" name="entityType" value={filters.entityType} onChange={handleFilterChange}>
                <option value="">Todos</option>
                {AUDIT_ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {getAuditEntityTypeLabel(entityType)}
                  </option>
                ))}
              </select>
            </p>

            <p className={`${styles.filterField} ${styles.areaFrom} ds-field`}>
              <label htmlFor="from">Desde</label>
              <input className="ds-input" id="from" name="from" type="datetime-local" value={filters.from} onChange={handleFilterChange} />
            </p>

            <p className={`${styles.filterField} ${styles.areaTo} ds-field`}>
              <label htmlFor="to">Hasta</label>
              <input className="ds-input" id="to" name="to" type="datetime-local" value={filters.to} onChange={handleFilterChange} />
            </p>

            <p className={`${styles.filterField} ${styles.areaUser} ds-field`}>
              <label htmlFor="userId">Usuario (UUID)</label>
              <input
                className="ds-input"
                id="userId"
                name="userId"
                type="text"
                value={filters.userId}
                onChange={handleFilterChange}
                placeholder="00000000-0000-…"
                pattern={UUID_INPUT_PATTERN}
                title="Ingresá un UUID completo, por ejemplo 3f2b1c4d-0000-0000-0000-000000000000"
                autoComplete="off"
                spellCheck={false}
              />
            </p>

            <p className={`${styles.filterField} ${styles.areaEntityId} ds-field`}>
              <label htmlFor="entityId">Entidad (UUID)</label>
              <input
                className="ds-input"
                id="entityId"
                name="entityId"
                type="text"
                value={filters.entityId}
                onChange={handleFilterChange}
                placeholder="00000000-0000-…"
                pattern={UUID_INPUT_PATTERN}
                title="Ingresá un UUID completo, por ejemplo 3f2b1c4d-0000-0000-0000-000000000000"
                autoComplete="off"
                spellCheck={false}
              />
            </p>

            <p className={`${styles.filterField} ${styles.areaSize} ds-field`}>
              <label htmlFor="size">Tamaño de página</label>
              <select className="ds-input" id="size" name="size" value={filters.size} onChange={handleFilterChange}>
                {AUDIT_LOG_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </p>

            <p className={`${styles.filterField} ${styles.areaSort} ds-field`}>
              <label htmlFor="sort">Orden</label>
              <select className="ds-input" id="sort" name="sort" value={filters.sort} onChange={handleFilterChange}>
                {AUDIT_LOG_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </p>

            <div className={styles.filterActions}>
              <button className={`ds-button ds-button-primary ${styles.actionButton}`} type="submit" disabled={loading}>
                Aplicar filtros
              </button>
              <button className={`ds-button ds-button-secondary ${styles.actionButton}`} type="button" onClick={handleClearFilters} disabled={loading}>
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <div className={styles.listInset}>
            <Loading />
          </div>
        ) : null}
        {displayError ? (
          <div className={styles.listInset}>
            <ErrorMessage error={displayError} />
          </div>
        ) : null}

        {showEmpty ? (
          <div className={`${styles.emptyState} ${styles.listInset}`}>
            <p>No hay eventos con estos filtros.</p>
            {hasAppliedFilters ? (
              <button className="ds-button ds-button-secondary" type="button" onClick={handleClearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {showList ? (
          <div className={`${styles.tableFrame} ds-table-frame`}>
            <AuditLogsTable auditLogs={auditLogs} caption="Logs de auditoría del sistema" classNames={styles} />
          </div>
        ) : null}

        {auditLogsPage && !error ? (
          <div className={styles.pagination}>
            <PaginationControls
              ariaLabel="Paginación de logs de auditoría"
              page={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              loading={loading}
              onPageChange={handlePageChange}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function buildFiltersSummary(query) {
  const summary = [];

  if (query.action) {
    summary.push(`Acción: ${getAuditActionLabel(query.action)}`);
  }
  if (query.entityType) {
    summary.push(`Entidad: ${getAuditEntityTypeLabel(query.entityType)}`);
  }
  if (query.userId) {
    summary.push(`Usuario: ${query.userId.slice(0, 8)}…`);
  }
  if (query.entityId) {
    summary.push(`ID entidad: ${query.entityId.slice(0, 8)}…`);
  }
  if (query.from || query.to) {
    summary.push('Rango de fechas');
  }

  return summary;
}

function formatEventCount(count) {
  const total = count ?? 0;

  return `${total} ${total === 1 ? 'evento' : 'eventos'}`;
}
