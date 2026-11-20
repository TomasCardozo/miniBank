import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, Check, ChevronRight, Copy, CreditCard, FileClock, Send, Users, WalletCards } from 'lucide-react';
import { getAccounts } from '../api/accountsApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { formatDateTime } from '../utils/formatters';
import { getInitials, ROLES, STATUSES } from '../utils/userDisplay';
import styles from './MePage.module.css';

export default function MePage() {
  const auth = useAuth();
  const user = auth.user;
  const isAdmin = user?.role === 'ADMIN';
  const [accounts, setAccounts] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => {
    if (!auth.accessToken || !user || isAdmin) {
      return undefined;
    }

    let ignore = false;

    async function loadAccounts() {
      try {
        const response = await getAccounts(auth.accessToken);

        if (!ignore && Array.isArray(response)) {
          setAccounts(response);
        }
      } catch {
        if (!ignore) {
          setAccounts(null);
        }
      }
    }

    loadAccounts();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken, user, isAdmin]);

  useEffect(() => () => clearTimeout(copyFeedbackTimeoutRef.current), []);

  async function handleCopy(key, text, label) {
    clearTimeout(copyFeedbackTimeoutRef.current);

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ key, message: `Copiamos ${label} al portapapeles.` });
    } catch {
      setCopyFeedback({ key: null, message: 'No pudimos copiar al portapapeles. Intentá de nuevo.' });
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => setCopyFeedback(null), 2500);
  }

  const status = STATUSES[user?.status] || { label: user?.status || '-', badge: '', dot: '' };
  const roleLabel = ROLES[user?.role] || user?.role || '-';
  const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  return (
    <main className={styles.page}>
      <header className={styles.pageHeading}>
        <h1 className="h1">Mi usuario</h1>
        {user?.createdAt ? (
          <p className={styles.metadata}>
            {isAdmin ? 'Administrador' : 'Cliente'} desde {formatDate(user.createdAt)}
          </p>
        ) : null}
      </header>

      {auth.loading ? <Loading /> : null}

      {!auth.loading && !user ? (
        <section className="ds-panel">
          <p className={styles.emptyText}>No se pudieron cargar los datos del usuario.</p>
          <ErrorMessage error={auth.error} />
        </section>
      ) : null}

      {user ? (
        <>
          <section className={styles.hero} aria-label="Resumen del usuario">
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">
                {getInitials(user)}
              </span>
              <div className={styles.identityText}>
                <strong className={styles.fullName}>{fullName || user.email}</strong>
                <span className={styles.email}>{user.email}</span>
              </div>
            </div>
            <div className={styles.badges}>
              <span className={`ds-badge ${status.badge} ${styles.statusBadge}`}>
                <span className={`${styles.statusDot} ${styles[status.dot] || ''}`} aria-hidden="true" />
                {status.label}
              </span>
              <span className="ds-badge">{roleLabel}</span>
            </div>
          </section>

          <div className={styles.contentGrid}>
            <section className={`ds-panel ${styles.detailCard}`} aria-labelledby="personal-data-title">
              <div className={styles.cardHeader}>
                <h2 id="personal-data-title" className={styles.cardTitle}>
                  Datos personales
                </h2>
                <p className={styles.copyFeedback} role="status">
                  {copyFeedback?.message}
                </p>
                <button
                  type="button"
                  className={`ds-button ds-button-secondary ${styles.iconTextButton}`}
                  onClick={() => handleCopy('all', buildShareText(user), 'tus datos')}
                >
                  {copyFeedback?.key === 'all' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  Copiar todo
                </button>
              </div>

              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt>Nombre</dt>
                  <dd>{user.firstName || '-'}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Apellido</dt>
                  <dd>{user.lastName || '-'}</dd>
                </div>
                <CopyRow
                  label="Email"
                  value={user.email}
                  copied={copyFeedback?.key === 'email'}
                  onCopy={() => handleCopy('email', user.email, 'el email')}
                />
                <CopyRow
                  label="Documento"
                  value={user.documentNumber}
                  numeric
                  copied={copyFeedback?.key === 'document'}
                  onCopy={() => handleCopy('document', user.documentNumber, 'el documento')}
                />
                <div className={styles.infoRow}>
                  <dt>{isAdmin ? 'Alta' : 'Cliente desde'}</dt>
                  <dd>{formatDateTime(user.createdAt)}</dd>
                </div>
              </dl>
            </section>

            <nav className={`ds-panel ${styles.accessPanel}`} aria-label="Accesos del usuario">
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Accesos</h2>
              </div>
              {isAdmin ? (
                <>
                  <AccessLink to="/admin/users" icon={<Users size={18} aria-hidden="true" />} title="Usuarios" description="Alta, bloqueo y detalle" />
                  <AccessLink
                    to="/admin/accounts/actions"
                    icon={<CreditCard size={18} aria-hidden="true" />}
                    title="Cuentas"
                    description="Bloqueos y acreditaciones"
                  />
                  <AccessLink
                    to="/admin/transfers"
                    icon={<ArrowLeftRight size={18} aria-hidden="true" />}
                    title="Transferencias"
                    description="Todas las del sistema"
                  />
                  <AccessLink to="/admin/audit-logs" icon={<FileClock size={18} aria-hidden="true" />} title="Auditoria" description="Registro de acciones" />
                </>
              ) : (
                <>
                  <AccessLink
                    to="/accounts"
                    icon={<WalletCards size={18} aria-hidden="true" />}
                    title="Mis cuentas"
                    description={buildAccountsSummary(accounts)}
                  />
                  <AccessLink
                    to="/transfers"
                    icon={<ArrowLeftRight size={18} aria-hidden="true" />}
                    title="Transferencias"
                    description="Enviadas y recibidas"
                  />
                  <AccessLink to="/transfers/new" icon={<Send size={18} aria-hidden="true" />} title="Nueva transferencia" description="Enviar dinero" />
                </>
              )}
            </nav>
          </div>

          <footer className={styles.pageFooter}>
            <dl className={styles.technicalList} aria-label="Datos tecnicos">
              <div>
                <dt>User ID</dt>
                <dd>{user.id}</dd>
              </div>
            </dl>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function CopyRow({ label, value, numeric = false, copied, onCopy }) {
  return (
    <div className={styles.infoRow}>
      <dt>{label}</dt>
      <dd className={styles.infoValueRow}>
        <span className={numeric ? styles.numericValue : styles.textValue}>{value || '-'}</span>
        {value ? (
          <span className={styles.rowActions}>
            <button type="button" className="ds-icon-button" onClick={onCopy} aria-label={`Copiar ${label.toLowerCase()}`} title={`Copiar ${label.toLowerCase()}`}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            </button>
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function AccessLink({ to, icon, title, description }) {
  return (
    <Link className={styles.accessLink} to={to}>
      <span className={styles.accessIcon}>{icon}</span>
      <span className={styles.accessText}>
        <span className={styles.accessTitle}>{title}</span>
        <span className={styles.accessDescription}>{description}</span>
      </span>
      <ChevronRight size={16} className={styles.accessChevron} aria-hidden="true" />
    </Link>
  );
}

function buildAccountsSummary(accounts) {
  if (!accounts) {
    return 'Saldos y movimientos';
  }

  if (accounts.length === 0) {
    return 'Todavia no tenes cuentas';
  }

  const total = accounts.length === 1 ? '1 cuenta' : `${accounts.length} cuentas`;
  const blocked = accounts.filter((account) => account.status === 'BLOCKED').length;

  if (blocked === 0) {
    return total;
  }

  return `${total} · ${blocked === 1 ? '1 bloqueada' : `${blocked} bloqueadas`}`;
}

function buildShareText(user) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const lines = [];

  if (name) {
    lines.push(`Nombre: ${name}`);
  }

  lines.push(`Email: ${user.email}`);

  if (user.documentNumber) {
    lines.push(`Documento: ${user.documentNumber}`);
  }

  return lines.join('\n');
}

function formatDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
