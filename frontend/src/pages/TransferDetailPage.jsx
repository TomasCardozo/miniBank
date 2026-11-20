import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeftRight, Check, ChevronRight, Copy, Landmark, ListOrdered, Send } from 'lucide-react';
import { getAccounts } from '../api/accountsApi';
import { getTransfer } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { STATUSES } from '../components/transfers/transferStatus';
import { formatDateTime, formatMoneyAmount } from '../utils/formatters';
import styles from './TransferDetailPage.module.css';

export default function TransferDetailPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [transfer, setTransfer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadTransfer() {
      setLoading(true);
      setError(null);

      const [transferResult, accountsResult] = await Promise.allSettled([
        getTransfer(auth.accessToken, id),
        getAccounts(auth.accessToken),
      ]);

      if (ignore) {
        return;
      }

      if (transferResult.status === 'fulfilled') {
        setTransfer(transferResult.value);
      } else {
        setError(transferResult.reason);
      }

      if (accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)) {
        setAccounts(accountsResult.value);
      }

      setLoading(false);
    }

    loadTransfer();

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

  const sourceAccount = transfer ? accounts.find((account) => account.id === transfer.sourceAccountId) : null;
  const targetAccount = transfer ? accounts.find((account) => account.id === transfer.targetAccountId) : null;
  const direction = getDirection(sourceAccount, targetAccount);
  const ownAccount = direction === 'received' ? targetAccount : sourceAccount;
  const ownSide = direction === 'received' ? 'destino' : 'origen';
  const status = STATUSES[transfer?.status] || { label: transfer?.status || '-', badge: '', dot: '' };
  const failed = transfer && (transfer.status === 'FAILED' || transfer.status === 'REJECTED' || transfer.failureReason);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Detalle Transferencia</h1>
          {transfer ? (
            <p className={styles.metadata}>
              {transfer.sourceAccountNumber} → {transfer.targetAccountNumber} · {formatDateTime(transfer.createdAt)}
            </p>
          ) : null}
        </div>

        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to="/transfers">
          Volver a transferencias
        </Link>
      </header>

      {loading ? <Loading /> : null}
      <ErrorMessage error={error} />

      {transfer ? (
        <>
          <section className={styles.hero} aria-label="Resumen de la transferencia">
            <div className={styles.heroBody}>
              <span className={styles.heroLabel}>Monto</span>
              <strong className={styles.amount}>{formatMoneyAmount(transfer.amount, transfer.currency)}</strong>
              {transfer.description ? <p className={styles.heroDescription}>{transfer.description}</p> : null}
            </div>
            <span className={`ds-badge ${status.badge} ${styles.statusBadge}`}>
              <span className={`${styles.statusDot} ${styles[status.dot] || ''}`} aria-hidden="true" />
              {status.label}
            </span>
          </section>

          {failed ? (
            <p className={styles.failureNotice} role="alert">
              <strong>Motivo del fallo:</strong> {transfer.failureReason || 'No informado'}
            </p>
          ) : null}

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
                  onClick={() => handleCopy('all', buildShareText(transfer, status.label), 'los datos de la transferencia')}
                >
                  {copyFeedback?.key === 'all' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  Copiar todo
                </button>
              </div>

              <dl className={styles.infoList}>
                <AccountRow
                  label="Cuenta origen"
                  number={transfer.sourceAccountNumber}
                  alias={sourceAccount?.alias}
                  copied={copyFeedback?.key === 'source'}
                  onCopy={() => handleCopy('source', transfer.sourceAccountNumber, 'el numero de cuenta origen')}
                />
                <AccountRow
                  label="Cuenta destino"
                  number={transfer.targetAccountNumber}
                  alias={targetAccount?.alias}
                  copied={copyFeedback?.key === 'target'}
                  onCopy={() => handleCopy('target', transfer.targetAccountNumber, 'el numero de cuenta destino')}
                />
                <div className={styles.infoRow}>
                  <dt>Moneda</dt>
                  <dd>{transfer.currency}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Descripcion</dt>
                  <dd>{transfer.description || '-'}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Creada</dt>
                  <dd>{formatDateTime(transfer.createdAt)}</dd>
                </div>
                <div className={styles.infoRow}>
                  <dt>Completada</dt>
                  <dd>{formatDateTime(transfer.completedAt)}</dd>
                </div>
              </dl>
            </section>

            <nav className={`ds-panel ${styles.accessPanel}`} aria-label="Accesos de la transferencia">
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Accesos</h2>
              </div>
              {ownAccount ? (
                <>
                  <AccessLink
                    to={`/accounts/${ownAccount.id}`}
                    icon={<Landmark size={18} aria-hidden="true" />}
                    title={`Ver cuenta ${ownSide}`}
                    description="Saldo y datos"
                  />
                  <AccessLink
                    to={`/accounts/${ownAccount.id}/movements`}
                    icon={<ListOrdered size={18} aria-hidden="true" />}
                    title="Movimientos"
                    description={`De la cuenta ${ownSide}`}
                  />
                  <AccessLink
                    to={`/transfers?accountId=${ownAccount.id}`}
                    icon={<ArrowLeftRight size={18} aria-hidden="true" />}
                    title="Transferencias"
                    description={`De la cuenta ${ownSide}`}
                  />
                </>
              ) : null}
              <AccessLink
                to={ownAccount ? `/transfers/new?sourceAccountId=${ownAccount.id}` : '/transfers/new'}
                icon={<Send size={18} aria-hidden="true" />}
                title="Nueva transferencia"
                description={ownAccount ? `Desde la cuenta ${ownSide}` : 'Enviar dinero'}
              />
            </nav>
          </div>

          <footer className={styles.pageFooter}>
            <dl className={styles.technicalList} aria-label="Datos tecnicos">
              <div>
                <dt>ID de transferencia</dt>
                <dd>{transfer.id}</dd>
              </div>
              <div>
                <dt>ID cuenta origen</dt>
                <dd>{transfer.sourceAccountId}</dd>
              </div>
              <div>
                <dt>ID cuenta destino</dt>
                <dd>{transfer.targetAccountId}</dd>
              </div>
            </dl>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function AccountRow({ label, number, alias, copied, onCopy }) {
  return (
    <div className={styles.infoRow}>
      <dt>{label}</dt>
      <dd className={styles.infoValueRow}>
        <span className={styles.accountValue}>
          <span className={styles.accountNumber}>{number || '-'}</span>
          {alias ? <span className={styles.accountAlias}>{alias}</span> : null}
        </span>
        {number ? (
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

function getDirection(sourceAccount, targetAccount) {
  if (sourceAccount && targetAccount) {
    return 'internal';
  }

  if (sourceAccount) {
    return 'sent';
  }

  if (targetAccount) {
    return 'received';
  }

  return 'unknown';
}

function buildShareText(transfer, statusLabel) {
  const lines = [
    `Monto: ${formatMoneyAmount(transfer.amount, transfer.currency)}`,
    `Estado: ${statusLabel}`,
    `Cuenta origen: ${transfer.sourceAccountNumber}`,
    `Cuenta destino: ${transfer.targetAccountNumber}`,
  ];

  if (transfer.description) {
    lines.push(`Descripcion: ${transfer.description}`);
  }

  lines.push(`Fecha: ${formatDateTime(transfer.createdAt)}`, `ID: ${transfer.id}`);

  return lines.join('\n');
}
