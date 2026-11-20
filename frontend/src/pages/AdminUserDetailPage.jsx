import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, Copy } from 'lucide-react';
import { activateAdminUser, blockAdminUser, getAdminUser } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { formatDateTime } from '../utils/formatters';
import { getFullName, getInitials, getRoleLabel, getStatusDisplay } from '../utils/userDisplay';
import styles from './AdminUserDetailPage.module.css';

const ACTIONS = {
  block: {
    request: blockAdminUser,
    confirm: '¿Confirmás el bloqueo de este usuario? No va a poder operar hasta que lo actives de nuevo.',
    success: 'Usuario bloqueado.',
  },
  activate: {
    request: activateAdminUser,
    confirm: '¿Confirmás la activación de este usuario?',
    success: 'Usuario activado.',
  },
};

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      setLoading(true);
      setError(null);
      setUser(null);
      setActionError(null);
      setActionMessage('');

      try {
        const response = await getAdminUser(auth.accessToken, id);

        if (!ignore) {
          setUser(response);
        }
      } catch (apiError) {
        if (!ignore) {
          setError(apiError);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken, id]);

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

  async function runAction(actionKey) {
    const action = ACTIONS[actionKey];

    if (pendingAction || !window.confirm(action.confirm)) {
      return;
    }

    setPendingAction(actionKey);
    setActionError(null);
    setActionMessage('');

    try {
      const response = await action.request(auth.accessToken, id);
      setUser(response);
      setActionMessage(action.success);
    } catch (apiError) {
      setActionError(apiError);
    } finally {
      setPendingAction(null);
    }
  }

  const status = getStatusDisplay(user?.status);
  const fullName = getFullName(user);
  const canBlock = user?.status === 'ACTIVE';
  const canActivate = user?.status === 'BLOCKED';

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Detalle de usuario</h1>
          {user?.createdAt ? (
            <p className={styles.metadata}>
              {getRoleLabel(user.role)} desde {formatDate(user.createdAt)}
            </p>
          ) : null}
        </div>
        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to="/admin/users">
          ← Volver a usuarios
        </Link>
      </header>

      {loading ? <Loading /> : null}

      {error?.status === 403 ? (
        <div className={styles.forbidden} role="alert">
          <p>No tenés permisos de administrador para ver este usuario.</p>
          <Link to="/dashboard">Ir al dashboard</Link>
        </div>
      ) : (
        <ErrorMessage error={error} />
      )}

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
              <span className="ds-badge">{getRoleLabel(user.role)}</span>
            </div>
          </section>

          <div className={styles.contentGrid}>
            <section className={`ds-panel ${styles.detailCard}`} aria-labelledby="admin-user-data-title">
              <div className={styles.cardHeader}>
                <h2 id="admin-user-data-title" className={styles.cardTitle}>
                  Datos
                </h2>
                <p className={styles.copyFeedback} role="status">
                  {copyFeedback?.message}
                </p>
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
                <div className={styles.infoRow}>
                  <dt>Email</dt>
                  <dd>{user.email || '-'}</dd>
                </div>
                <CopyRow
                  label="Documento"
                  value={user.documentNumber}
                  copied={copyFeedback?.key === 'document'}
                  onCopy={() => handleCopy('document', user.documentNumber, 'el documento')}
                />
                <CopyRow label="ID" value={user.id} copied={copyFeedback?.key === 'id'} onCopy={() => handleCopy('id', user.id, 'el ID')} />
                <div className={styles.infoRow}>
                  <dt>Alta</dt>
                  <dd className={styles.numericValue}>{formatDateTime(user.createdAt)}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Actualizado</dt>
                  <dd className={styles.numericValue}>{formatDateTime(user.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className={`ds-panel ${styles.actionsCard}`} aria-labelledby="admin-user-actions-title">
              <div className={styles.cardHeader}>
                <h2 id="admin-user-actions-title" className={styles.cardTitle}>
                  Acciones
                </h2>
                <p className={styles.statusMessage} role="status">
                  {actionMessage}
                </p>
              </div>

              <p className={styles.actionsHint}>{getActionsHint(user.status)}</p>

              <div className={styles.actionButtons}>
                <button
                  className="ds-button ds-button-secondary"
                  type="button"
                  onClick={() => runAction('block')}
                  disabled={Boolean(pendingAction) || !canBlock}
                  aria-busy={pendingAction === 'block' || undefined}
                >
                  {pendingAction === 'block' ? 'Bloqueando…' : 'Bloquear usuario'}
                </button>
                <button
                  className="ds-button ds-button-primary"
                  type="button"
                  onClick={() => runAction('activate')}
                  disabled={Boolean(pendingAction) || !canActivate}
                  aria-busy={pendingAction === 'activate' || undefined}
                >
                  {pendingAction === 'activate' ? 'Activando…' : 'Activar usuario'}
                </button>
              </div>

              <ErrorMessage error={actionError} />
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}

function CopyRow({ label, value, copied, onCopy }) {
  return (
    <div className={styles.infoRow}>
      <dt>{label}</dt>
      <dd className={styles.infoValueRow}>
        <span className={styles.numericValue}>{value || '-'}</span>
        {value ? (
          <span className={styles.rowActions}>
            <button type="button" className="ds-icon-button" onClick={onCopy} aria-label={`Copiar ${label}`} title={`Copiar ${label}`}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            </button>
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function getActionsHint(status) {
  if (status === 'ACTIVE') {
    return 'El usuario está activo. Bloquearlo le impide operar hasta que se active de nuevo.';
  }

  if (status === 'BLOCKED') {
    return 'El usuario está bloqueado. Activarlo le devuelve el acceso.';
  }

  if (status === 'CLOSED') {
    return 'Los usuarios cerrados no se pueden bloquear ni activar.';
  }

  return 'No hay acciones disponibles para el estado actual.';
}

function formatDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}
