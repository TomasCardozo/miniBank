import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeftRight, Check, ChevronRight, Copy, Gauge, ListOrdered, Pencil } from 'lucide-react';
import { getAccount, updateAccountAlias } from '../api/accountsApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { formatDateTime, formatMoneyAmount } from '../utils/formatters';
import styles from './AccountDetailPage.module.css';

export default function AccountDetailPage() {
  const { id } = useParams();
  const auth = useAuth();
  const aliasInputRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingAlias, setSavingAlias] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [error, setError] = useState(null);
  const [aliasError, setAliasError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadAccount() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAccount(auth.accessToken, id);

        if (!ignore) {
          setAccount(response);
          setAlias(response.alias || '');
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

    loadAccount();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken, id]);

  useEffect(() => {
    if (isEditingAlias) {
      aliasInputRef.current?.focus();
    }
  }, [isEditingAlias]);

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

  function startAliasEdit() {
    setAliasError(null);
    setAlias(account?.alias || '');
    setIsEditingAlias(true);
  }

  function cancelAliasEdit() {
    if (savingAlias) {
      return;
    }

    setAliasError(null);
    setAlias(account?.alias || '');
    setIsEditingAlias(false);
  }

  async function handleAliasSubmit(event) {
    event.preventDefault();

    if (savingAlias) {
      return;
    }

    setSavingAlias(true);
    setAliasError(null);

    try {
      const response = await updateAccountAlias(auth.accessToken, id, { alias: alias || null });
      setAccount(response);
      setAlias(response.alias || '');
      setIsEditingAlias(false);
    } catch (apiError) {
      setAliasError(apiError);
    } finally {
      setSavingAlias(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Cuenta</p>
          <h1 className={styles.title}>{account ? account.alias || `Cuenta ${account.accountNumber}` : 'Detalle de cuenta'}</h1>
          {account ? <p className={styles.metadata}>{buildMetadata(account)}</p> : null}
        </div>

        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to="/accounts">
          Volver a cuentas
        </Link>
      </header>

      {loading ? <Loading /> : null}
      <ErrorMessage error={error} />

      {account ? (
        <>
          <section className={styles.hero} aria-label="Resumen de la cuenta">
            <div>
              <span className={styles.heroLabel}>Saldo disponible</span>
              <strong className={styles.balance}>{formatMoneyAmount(account.balance, account.currency)}</strong>
            </div>
            <StatusBadge status={account.status} />
          </section>

          <div className={styles.contentGrid}>
            <section className={`ds-panel ${styles.detailCard}`} aria-labelledby="detail-title">
              <div className={styles.cardHeader}>
                <h2 id="detail-title" className={styles.cardTitle}>
                  Detalle
                </h2>
                <p className={styles.copyFeedback} role="status">
                  {copyFeedback?.message}
                </p>
                <button
                  type="button"
                  className={`ds-button ds-button-secondary ${styles.iconTextButton}`}
                  onClick={() => handleCopy('all', buildShareText(account, auth.user), 'los datos de la cuenta')}
                >
                  {copyFeedback?.key === 'all' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  Copiar todo
                </button>
              </div>

              <dl className={styles.infoList}>
                <div className={styles.infoRow}>
                  <dt>Numero de cuenta</dt>
                  <dd className={styles.infoValueRow}>
                    <span className={styles.accountNumber}>{account.accountNumber}</span>
                    <span className={styles.rowActions}>
                      <CopyButton
                        label="Copiar numero de cuenta"
                        copied={copyFeedback?.key === 'accountNumber'}
                        onClick={() => handleCopy('accountNumber', account.accountNumber, 'el numero de cuenta')}
                      />
                    </span>
                  </dd>
                </div>

                <div className={styles.infoRow}>
                  <dt>Alias</dt>
                  <dd>
                    {isEditingAlias ? (
                      <form className={styles.aliasForm} onSubmit={handleAliasSubmit}>
                        <fieldset disabled={savingAlias}>
                          <input
                            id="alias"
                            ref={aliasInputRef}
                            className={`ds-input ${styles.aliasInput}`}
                            aria-label="Alias de la cuenta"
                            value={alias}
                            onChange={(event) => setAlias(event.target.value)}
                            maxLength={100}
                            placeholder="Ej: ahorro-sueldo"
                          />
                          <button type="submit" className="ds-button ds-button-primary">
                            {savingAlias ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button type="button" className="ds-button ds-button-secondary" onClick={cancelAliasEdit}>
                            Cancelar
                          </button>
                        </fieldset>
                      </form>
                    ) : (
                      <span className={styles.infoValueRow}>
                        <span className={`${styles.aliasValue} ${account.alias ? '' : styles.aliasPlaceholder}`}>
                          {account.alias || 'Sin alias'}
                        </span>
                        <span className={styles.rowActions}>
                          <button type="button" className="ds-icon-button" onClick={startAliasEdit} aria-label="Editar alias" title="Editar alias">
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          {account.alias ? (
                            <CopyButton
                              label="Copiar alias"
                              copied={copyFeedback?.key === 'alias'}
                              onClick={() => handleCopy('alias', account.alias, 'el alias')}
                            />
                          ) : null}
                        </span>
                      </span>
                    )}
                  </dd>
                </div>

                <div className={styles.infoRow}>
                  <dt>Moneda</dt>
                  <dd>{account.currency}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Creada</dt>
                  <dd>{formatDateTime(account.createdAt)}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Ultima actualizacion</dt>
                  <dd>{formatDateTime(account.updatedAt)}</dd>
                </div>
              </dl>

              <ErrorMessage error={aliasError} />

            </section>

            <nav className={`ds-panel ${styles.accessPanel}`} aria-label="Accesos de la cuenta">
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Accesos</h2>
              </div>
              <AccessLink
                to={`/accounts/${account.id}/movements`}
                icon={<ListOrdered size={18} aria-hidden="true" />}
                title="Movimientos"
                description="Historial de la cuenta"
              />
              <AccessLink
                to={`/accounts/${account.id}/limits`}
                icon={<Gauge size={18} aria-hidden="true" />}
                title="Limites"
                description="Topes diarios vigentes"
              />
              <AccessLink
                to={`/transfers?accountId=${account.id}`}
                icon={<ArrowLeftRight size={18} aria-hidden="true" />}
                title="Transferencias"
                description="Enviadas y recibidas"
              />
            </nav>
          </div>

          <footer className={styles.pageFooter}>
            <dl className={styles.technicalList} aria-label="Datos tecnicos">
              <div>
                <dt>ID de cuenta</dt>
                <dd>{account.id}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd>{account.userId}</dd>
              </div>
            </dl>
          </footer>
        </>
      ) : null}
    </main>
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

function CopyButton({ label, copied, onClick }) {
  return (
    <button type="button" className="ds-icon-button" onClick={onClick} aria-label={label} title={label}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
    </button>
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || '').toUpperCase();
  const isActive = normalizedStatus === 'ACTIVE';

  return (
    <span className={`ds-badge ${isActive ? 'ds-badge-success' : 'ds-badge-danger'} ${styles.statusBadge}`}>
      <span className={`${styles.statusDot} ${isActive ? styles.statusActive : styles.statusInactive}`} aria-hidden="true" />
      {getStatusLabel(normalizedStatus)}
    </span>
  );
}

function getStatusLabel(status) {
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus === 'ACTIVE') {
    return 'Activa';
  }

  if (normalizedStatus === 'BLOCKED') {
    return 'Bloqueada';
  }

  if (normalizedStatus === 'CLOSED') {
    return 'Cerrada';
  }

  return status || '-';
}

function buildMetadata(account) {
  return `N° ${account.accountNumber} · ${account.currency} · creada ${formatDateTime(account.createdAt)}`;
}

function buildShareText(account, user) {
  const lines = [];
  const holder = account.userId === user?.id ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';

  if (holder) {
    lines.push(`Titular: ${holder}`);
  }

  if (account.alias) {
    lines.push(`Alias: ${account.alias}`);
  }

  lines.push(`Numero de cuenta: ${account.accountNumber}`, `Moneda: ${account.currency}`);

  return lines.join('\n');
}
