import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, ArrowRight, ScrollText, ShieldAlert, TriangleAlert, UserRound, Users, WalletCards } from 'lucide-react';
import { getAdminAuditLogs, getAdminTransfers, getAdminUsers } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import useFitCount from '../hooks/useFitCount';
import { getAuditActionBadgeClassName, getAuditActionLabel, getAuditEntityTypeLabel } from '../components/audit/auditLogConfig';
import { shortId } from '../components/audit/auditDetails';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { STATUSES } from '../components/transfers/transferStatus';
import { formatDateTime, formatMoneyAmount } from '../utils/formatters';
import { buildFilteredPath, toDateTimeLocalValue } from '../utils/searchParamFilters';
import styles from './AdminHomePage.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const COUNT_QUERY = { page: 0, size: 1 };
const RECENT_AUDIT_QUERY = { page: 0, size: 12, sort: 'createdAt,DESC' };
const RECENT_TRANSFERS_QUERY = { page: 0, size: 10, sort: 'createdAt,DESC' };
const FORBIDDEN_MESSAGE = 'No tenés permisos de administrador.';

const SECTIONS = [
  { to: '/admin/users', title: 'Usuarios', description: 'Buscá clientes, revisá sus datos y bloqueá o activá accesos.', icon: Users },
  {
    to: '/admin/accounts/actions',
    title: 'Acciones de cuentas',
    description: 'Bloqueá, activá o acreditá saldo en una cuenta.',
    icon: WalletCards,
  },
  { to: '/admin/transfers', title: 'Transferencias', description: 'Todas las transferencias del sistema, con filtros.', icon: ArrowLeftRight },
  { to: '/admin/audit-logs', title: 'Auditoría', description: 'Logins, transferencias y cambios administrativos.', icon: ScrollText },
];

export default function AdminHomePage() {
  const auth = useAuth();
  const [since] = useState(() => toDateTimeLocalValue(new Date(Date.now() - DAY_MS)));

  const users = useAdminRequest(() => getAdminUsers(auth.accessToken, COUNT_QUERY), [auth.accessToken]);
  const blockedUsers = useAdminRequest(
    () => getAdminUsers(auth.accessToken, { ...COUNT_QUERY, status: 'BLOCKED' }),
    [auth.accessToken]
  );
  const completedTransfers = useAdminRequest(
    () => getAdminTransfers(auth.accessToken, { ...COUNT_QUERY, status: 'COMPLETED', from: since }),
    [auth.accessToken, since]
  );
  const rejectedTransfers = useAdminRequest(
    () => getAdminTransfers(auth.accessToken, { ...COUNT_QUERY, status: 'REJECTED', from: since }),
    [auth.accessToken, since]
  );
  const failedLogins = useAdminRequest(
    () => getAdminAuditLogs(auth.accessToken, { ...COUNT_QUERY, action: 'LOGIN_FAILURE', from: since }),
    [auth.accessToken, since]
  );
  const recentAudit = useAdminRequest(() => getAdminAuditLogs(auth.accessToken, RECENT_AUDIT_QUERY), [auth.accessToken]);
  const recentTransfers = useAdminRequest(
    () => getAdminTransfers(auth.accessToken, RECENT_TRANSFERS_QUERY),
    [auth.accessToken]
  );

  const firstName = auth.user?.firstName;
  const rejectedLinks = {
    transfers: buildFilteredPath('/admin/transfers', { status: 'REJECTED', from: since }),
    logins: buildFilteredPath('/admin/audit-logs', { action: 'LOGIN_FAILURE', from: since }),
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <h1>
            {getGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className={styles.metadata}>Administración · actividad de las últimas 24 h</p>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumen del sistema">
        <StatCard
          title="Usuarios"
          icon={UserRound}
          request={users}
          description="registrados en el sistema"
          to="/admin/users"
        />
        <StatCard
          title="Bloqueados"
          icon={ShieldAlert}
          request={blockedUsers}
          description="usuarios con acceso bloqueado"
          to={buildFilteredPath('/admin/users', { status: 'BLOCKED' })}
          highlight={countOf(blockedUsers) > 0 ? 'warning' : undefined}
        />
        <StatCard
          title="Transferencias 24 h"
          icon={ArrowLeftRight}
          request={completedTransfers}
          description="completadas"
          to={buildFilteredPath('/admin/transfers', { status: 'COMPLETED', from: since })}
        />
        <RejectionsCard rejectedTransfers={rejectedTransfers} failedLogins={failedLogins} links={rejectedLinks} />
      </section>

      <section className={styles.mainGrid} aria-label="Paneles de administración">
        <RecentAuditPanel request={recentAudit} />
        <SectionsPanel />
        <RecentTransfersPanel request={recentTransfers} />
      </section>
    </main>
  );
}

function useAdminRequest(load, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let ignore = false;

    setState((current) => ({ ...current, loading: true, error: null }));
    load()
      .then((data) => {
        if (!ignore) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error) => {
        if (!ignore) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      ignore = true;
    };
  }, deps);

  return state;
}

function countOf(request) {
  return typeof request.data?.totalElements === 'number' ? request.data.totalElements : null;
}

function formatCount(request) {
  if (request.loading) {
    return '…';
  }

  const count = countOf(request);
  return count === null ? '—' : count.toLocaleString('es-AR');
}

function StatCard({ title, icon: Icon, request, description, to, highlight }) {
  return (
    <Link
      className={`ds-card ${styles.statCard} ${highlight ? styles[highlight] : ''}`}
      to={to}
      aria-label={`${title}: ${formatCount(request)} ${description}`}
      aria-busy={request.loading}
    >
      <span className={styles.statHeader}>
        <span className={styles.statTitle}>{title}</span>
        <span className={styles.cardIcon} aria-hidden="true">
          <Icon size={16} />
        </span>
      </span>
      <span className={styles.statValue}>{formatCount(request)}</span>
      <span className={styles.statDescription}>{request.error ? 'No se pudo cargar' : description}</span>
    </Link>
  );
}

function RejectionsCard({ rejectedTransfers, failedLogins, links }) {
  const loading = rejectedTransfers.loading || failedLogins.loading;
  const transfersCount = countOf(rejectedTransfers);
  const loginsCount = countOf(failedLogins);
  const total = transfersCount === null && loginsCount === null ? null : (transfersCount ?? 0) + (loginsCount ?? 0);
  const value = loading ? '…' : total === null ? '—' : total.toLocaleString('es-AR');

  return (
    <article
      className={`ds-card ${styles.statCard} ${total > 0 ? styles.danger : ''}`}
      aria-labelledby="admin-rejections-title"
      aria-busy={loading}
    >
      <span className={styles.statHeader}>
        <h2 id="admin-rejections-title" className={styles.statTitle}>
          Rechazos 24 h
        </h2>
        <span className={styles.cardIcon} aria-hidden="true">
          <TriangleAlert size={16} />
        </span>
      </span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statDescription}>
        <Link to={links.transfers}>{formatCountLabel(rejectedTransfers, 'transferencia', 'transferencias')}</Link>
        {' · '}
        <Link to={links.logins}>{formatCountLabel(failedLogins, 'login fallido', 'logins fallidos')}</Link>
      </span>
    </article>
  );
}

function formatCountLabel(request, singular, plural) {
  const count = countOf(request);

  if (request.loading) {
    return `… ${plural}`;
  }

  if (count === null) {
    return `— ${plural}`;
  }

  return `${count.toLocaleString('es-AR')} ${count === 1 ? singular : plural}`;
}

function PanelError({ error }) {
  if (!error) {
    return null;
  }

  if (error.status === 403) {
    return (
      <p className={styles.forbidden} role="alert">
        {FORBIDDEN_MESSAGE}
      </p>
    );
  }

  return <ErrorMessage error={error} />;
}

function PanelHeader({ id, title, to, linkLabel }) {
  return (
    <div className={styles.panelHeader}>
      <h2 id={id} className={styles.panelTitle}>
        {title}
      </h2>
      {to ? (
        <Link className={styles.viewAllLink} to={to}>
          {linkLabel}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function RecentAuditPanel({ request }) {
  const events = Array.isArray(request.data?.content) ? request.data.content : [];

  const { containerRef, count } = useFitCount(`.${styles.activityItem}`, events.length);
  const visibleEvents = count ? events.slice(0, count) : events;

  return (
    <section className={`ds-panel ${styles.panel} ${styles.activityPanel}`} aria-labelledby="admin-activity-title">
      <PanelHeader id="admin-activity-title" title="Actividad reciente" to="/admin/audit-logs" linkLabel="Ver todos" />
      <div ref={containerRef} className={styles.panelBody}>
        {request.loading && events.length === 0 ? <Loading /> : null}
        <PanelError error={request.error} />
        {!request.loading && !request.error && events.length === 0 ? (
          <p className="ds-empty-state">Todavía no hay eventos de auditoría.</p>
        ) : null}
        {events.length > 0 && !request.error ? (
          <ul className={styles.activityList}>
            {visibleEvents.map((event) => (
              <li key={event.id} className={styles.activityItem}>
                <span className={getAuditActionBadgeClassName(event.action)}>{getAuditActionLabel(event.action)}</span>
                <span className={styles.activityEntity}>
                  {getAuditEntityTypeLabel(event.entityType)}
                  {event.entityId ? <span className={styles.shortId} title={event.entityId}>{shortId(event.entityId)}</span> : null}
                </span>
                <time className={styles.activityDate} dateTime={event.createdAt}>
                  {formatDateTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function SectionsPanel() {
  return (
    <nav className={`ds-panel ${styles.panel} ${styles.sectionsPanel}`} aria-labelledby="admin-sections-title">
      <PanelHeader id="admin-sections-title" title="Accesos" />
      <ul className={styles.sectionsGrid}>
        {SECTIONS.map(({ to, title, description, icon: Icon }) => (
          <li key={to}>
            <Link className={styles.sectionLink} to={to}>
              <span className={styles.cardIcon} aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className={styles.sectionText}>
                <span className={styles.sectionTitle}>{title}</span>
                <span className={styles.sectionDescription}>{description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RecentTransfersPanel({ request }) {
  const transfers = Array.isArray(request.data?.content) ? request.data.content : [];

  const { containerRef, count } = useFitCount(`.${styles.transferItem}`, transfers.length);
  const visibleTransfers = count ? transfers.slice(0, count) : transfers;

  return (
    <section className={`ds-panel ${styles.panel} ${styles.transfersPanel}`} aria-labelledby="admin-transfers-title">
      <PanelHeader id="admin-transfers-title" title="Últimas transferencias" to="/admin/transfers" linkLabel="Ver todas" />
      <div ref={containerRef} className={styles.panelBody}>
        {request.loading && transfers.length === 0 ? <Loading /> : null}
        <PanelError error={request.error} />
        {!request.loading && !request.error && transfers.length === 0 ? (
          <p className="ds-empty-state">Todavía no hay transferencias.</p>
        ) : null}
        {transfers.length > 0 && !request.error ? (
          <ul className={styles.transferList}>
            {visibleTransfers.map((transfer) => {
              const status = STATUSES[transfer.status];

              return (
                <li key={transfer.id} className={styles.transferItem}>
                  <span className={styles.shortId} title={transfer.id}>
                    {shortId(transfer.id)}
                  </span>
                  <span className={styles.transferAccounts}>
                    {transfer.sourceAccountNumber || '-'}
                    <ArrowRight size={14} aria-label="a" />
                    {transfer.targetAccountNumber || '-'}
                  </span>
                  <span className={styles.transferAmount}>{formatMoneyAmount(transfer.amount, transfer.currency)}</span>
                  <span className={`ds-badge ${status?.badge || ''}`}>{status?.label || transfer.status}</span>
                  <time className={styles.activityDate} dateTime={transfer.createdAt}>
                    {formatDateTime(transfer.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Buenos días';
  }

  if (hour < 20) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}
