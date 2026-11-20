import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Copy } from 'lucide-react';
import { activateAdminAccount, blockAdminAccount, creditAdminAccount, getAdminAuditLogs } from '../api/adminApi';
import { useAuth } from '../auth/useAuth';
import AdminAccountsPanel, { ADMIN_ACCOUNT_DEFAULT_FILTERS } from '../components/admin/AdminAccountsPanel';
import ConfirmActionPanel from '../components/admin/ConfirmActionPanel';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import PaginationControls from '../components/PaginationControls';
import { buildRawAmountFromDigits, formatAmountInput } from '../utils/amountInput';
import { formatDateTime, formatMoneyAmount } from '../utils/formatters';
import { buildFilteredPath, readFiltersFromSearchParams } from '../utils/searchParamFilters';
import styles from './AdminAccountActionsPage.module.css';

const STATUS_MESSAGE_TIMEOUT = 2500;
const ACTIVITY_SIZE = 20;
const ACTIVITY_ESTIMATED_ROW_PX = 45;

const STATUS_ACTIONS = {
  block: {
    request: blockAdminAccount,
    busyLabel: 'Bloqueando…',
    successMessage: 'Cuenta bloqueada.',
    invalidStateMessage: 'Solo se pueden bloquear cuentas activas. Esta cuenta no está activa.',
  },
  activate: {
    request: activateAdminAccount,
    busyLabel: 'Activando…',
    successMessage: 'Cuenta activada.',
    invalidStateMessage: 'Solo se pueden activar cuentas bloqueadas. Esta cuenta no está bloqueada.',
  },
};

const CREDIT_INVALID_STATE_MESSAGE = 'Solo se puede acreditar en cuentas activas.';

const AUDIT_ACTION_LABELS = {
  ACCOUNT_BLOCKED: 'Bloqueo',
  ACCOUNT_ACTIVATED: 'Activación',
  ACCOUNT_CREDITED: 'Acreditación',
};

export default function AdminAccountActionsPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [amount, setAmount] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [pendingStatusAction, setPendingStatusAction] = useState(null);
  const [reviewingCredit, setReviewingCredit] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [creditError, setCreditError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [creditMessage, setCreditMessage] = useState('');
  const [activityVersion, setActivityVersion] = useState(0);
  const statusTimeoutRef = useRef(null);
  const creditTimeoutRef = useRef(null);
  const heroRef = useRef(null);

  const accountId = account?.id ?? null;
  const currentStatus = account?.status;
  const busy = busyAction !== null;

  const canBlock = currentStatus === 'ACTIVE';
  const canActivate = currentStatus === 'BLOCKED';
  const canCredit = currentStatus === 'ACTIVE';
  const formattedAmount = amount ? formatMoneyAmount(amount, account?.currency) : '';

  useEffect(
    () => () => {
      clearTimeout(statusTimeoutRef.current);
      clearTimeout(creditTimeoutRef.current);
    },
    [],
  );

  function resetFeedback() {
    setPendingStatusAction(null);
    setReviewingCredit(false);
    setStatusError(null);
    setCreditError(null);
    setStatusMessage('');
    setCreditMessage('');
  }

  function handleSelectAccount(selected) {
    setAccount(selected);
    setAmount('');
    resetFeedback();
    window.requestAnimationFrame?.(() => heroRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  function handleDeselectAccount() {
    setAccount(null);
    setAmount('');
    resetFeedback();
  }

  function handleClearUser() {
    setSearchParams({});
  }

  function applyActionResult(response) {
    setAccount((current) => ({ ...current, ...response }));
    setOverrides((current) => ({ ...current, [response.id]: response }));
    setActivityVersion((version) => version + 1);
  }

  function handleAmountChange(event) {
    const digits = event.target.value.replace(/\D/g, '');
    setAmount(buildRawAmountFromDigits(digits));
    setReviewingCredit(false);
    setCreditError(null);
  }

  function requestStatusAction(action) {
    setPendingStatusAction(action);
    setStatusError(null);
    setStatusMessage('');
  }

  async function confirmStatusAction() {
    const action = pendingStatusAction;
    const config = STATUS_ACTIONS[action];

    if (!config || !accountId || busy) {
      return;
    }

    setBusyAction(action);
    setStatusError(null);
    clearTimeout(statusTimeoutRef.current);

    try {
      const response = await config.request(auth.accessToken, accountId);
      applyActionResult(response);
      setPendingStatusAction(null);
      setStatusMessage(config.successMessage);
      statusTimeoutRef.current = setTimeout(() => setStatusMessage(''), STATUS_MESSAGE_TIMEOUT);
    } catch (apiError) {
      setPendingStatusAction(null);
      setStatusError(toFriendlyError(apiError, config.invalidStateMessage));
    } finally {
      setBusyAction(null);
    }
  }

  function handleCreditReview(event) {
    event.preventDefault();

    if (!canCredit || !amount || busy) {
      return;
    }

    setReviewingCredit(true);
    setCreditError(null);
    setCreditMessage('');
  }

  async function confirmCredit() {
    if (!canCredit || !amount || busy) {
      return;
    }

    setBusyAction('credit');
    setCreditError(null);
    clearTimeout(creditTimeoutRef.current);

    try {
      const response = await creditAdminAccount(auth.accessToken, accountId, { amount });
      applyActionResult(response);
      setAmount('');
      setReviewingCredit(false);
      setCreditMessage('Acreditado ✓');
      creditTimeoutRef.current = setTimeout(() => setCreditMessage(''), STATUS_MESSAGE_TIMEOUT);
    } catch (apiError) {
      setReviewingCredit(false);
      setCreditError(toFriendlyError(apiError, CREDIT_INVALID_STATE_MESSAGE));
    } finally {
      setBusyAction(null);
    }
  }

  const accountLabel = account ? account.accountNumber : '';

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Acciones sobre cuentas</h1>
          <p className={styles.metadata}>ADMIN · cambios auditados</p>
        </div>

        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to="/admin">
          Volver a admin
        </Link>
      </header>

      <AdminAccountsPanel
        accessToken={auth.accessToken}
        initialFilters={readFiltersFromSearchParams(searchParams, ADMIN_ACCOUNT_DEFAULT_FILTERS)}
        syncKey={searchParams.toString()}
        selectedAccount={account}
        overrides={overrides}
        onSelect={handleSelectAccount}
        onDeselect={handleDeselectAccount}
        onClearUser={handleClearUser}
      />

      {account ? (
        <>
          <div className={styles.workspace}>
            <AccountHero account={account} heroRef={heroRef} />

            <section className={`ds-panel ${styles.actionCard} ${styles.statusArea}`} aria-labelledby="status-title">
              <div className={styles.cardHeader}>
                <h2 id="status-title" className={styles.cardTitle}>
                  Estado
                </h2>
                <p className={styles.statusMessage} role="status">
                  {statusMessage}
                </p>
              </div>

              <fieldset className={styles.actionFieldset} disabled={busy}>
                <legend className={styles.visuallyHidden}>Cambiar estado de la cuenta</legend>
                {currentStatus === 'CLOSED' ? (
                  <p className={styles.fieldHint}>Las cuentas cerradas no se pueden bloquear ni activar.</p>
                ) : null}
                <div className={styles.buttonRow}>
                  <button
                    className="ds-button ds-button-secondary"
                    type="button"
                    onClick={() => requestStatusAction('block')}
                    disabled={!canBlock || pendingStatusAction !== null}
                  >
                    {busyAction === 'block' ? STATUS_ACTIONS.block.busyLabel : 'Bloquear cuenta'}
                  </button>
                  <button
                    className="ds-button ds-button-secondary"
                    type="button"
                    onClick={() => requestStatusAction('activate')}
                    disabled={!canActivate || pendingStatusAction !== null}
                  >
                    {busyAction === 'activate' ? STATUS_ACTIONS.activate.busyLabel : 'Activar cuenta'}
                  </button>
                </div>

                {pendingStatusAction === 'block' ? (
                  <ConfirmActionPanel
                    tone="danger"
                    title={`¿Bloquear cuenta ${accountLabel}?`}
                    description="El titular no podrá operar hasta que se vuelva a activar."
                    confirmLabel="Confirmar bloqueo"
                    busyLabel={STATUS_ACTIONS.block.busyLabel}
                    busy={busyAction === 'block'}
                    onConfirm={confirmStatusAction}
                    onCancel={() => setPendingStatusAction(null)}
                  />
                ) : null}

                {pendingStatusAction === 'activate' ? (
                  <ConfirmActionPanel
                    title={`¿Activar cuenta ${accountLabel}?`}
                    description="El titular podrá volver a operar con esta cuenta."
                    confirmLabel="Confirmar activación"
                    busyLabel={STATUS_ACTIONS.activate.busyLabel}
                    busy={busyAction === 'activate'}
                    onConfirm={confirmStatusAction}
                    onCancel={() => setPendingStatusAction(null)}
                  />
                ) : null}
              </fieldset>
              <ErrorMessage error={statusError} />
            </section>

            <section className={`ds-panel ${styles.actionCard} ${styles.creditArea}`} aria-labelledby="credit-title">
              <div className={styles.cardHeader}>
                <h2 id="credit-title" className={styles.cardTitle}>
                  Acreditar
                </h2>
                <p className={styles.statusMessage} role="status">
                  {creditMessage}
                </p>
              </div>

              <form className={styles.creditForm} onSubmit={handleCreditReview}>
                <fieldset className={styles.actionFieldset} disabled={busy}>
                  <legend className={styles.visuallyHidden}>Acreditar saldo</legend>
                  <div className="ds-field">
                    <label htmlFor="creditAmount">Monto a acreditar</label>
                    <div className={styles.amountInputGroup}>
                      <span className={styles.amountPrefix} aria-hidden="true">
                        $
                      </span>
                      <input
                        id="creditAmount"
                        className={`ds-input ${styles.amountInput}`}
                        type="text"
                        inputMode="decimal"
                        value={formatAmountInput(amount)}
                        onChange={handleAmountChange}
                        placeholder="0.00"
                        aria-describedby="credit-help"
                        disabled={!canCredit}
                      />
                    </div>
                  </div>
                  <p id="credit-help" className={styles.fieldHint}>
                    {!canCredit
                      ? 'Solo se puede acreditar en cuentas activas.'
                      : 'Genera un movimiento de acreditación (ADMIN_CREDIT).'}
                  </p>

                  <div className={styles.formActions}>
                    <button className="ds-button ds-button-primary" type="submit" disabled={!canCredit || !amount}>
                      Revisar acreditación
                    </button>
                  </div>

                  {reviewingCredit ? (
                    <ConfirmActionPanel
                      title={`¿Acreditar ${formattedAmount} en la cuenta ${accountLabel}?`}
                      description="Se va a registrar un movimiento ADMIN_CREDIT y quedará auditado."
                      confirmLabel="Confirmar acreditación"
                      busyLabel="Acreditando…"
                      busy={busyAction === 'credit'}
                      onConfirm={confirmCredit}
                      onCancel={() => setReviewingCredit(false)}
                    />
                  ) : null}
                </fieldset>
              </form>
              <ErrorMessage error={creditError} />
            </section>

            <AccountActivity accessToken={auth.accessToken} accountId={accountId} version={activityVersion} />
            <TechnicalDetails account={account} />
          </div>
        </>
      ) : null}
    </main>
  );
}

function AccountHero({ account, heroRef }) {
  return (
    <section ref={heroRef} className={`${styles.hero} ${styles.heroArea}`} aria-label="Cuenta seleccionada">
      <div className={styles.heroBody}>
        <span className={styles.heroLabel}>Saldo</span>
        <strong className={styles.amount}>{formatMoneyAmount(account.balance, account.currency)}</strong>
        <p className={styles.heroDescription}>
          {account.alias ? `${account.alias} · ` : ''}
          {account.currency}
        </p>
      </div>
      <StatusBadge status={account.status} />
    </section>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  const badgeClass = normalized === 'ACTIVE' ? 'ds-badge-success' : normalized ? 'ds-badge-danger' : '';

  return (
    <span className={`ds-badge ${badgeClass} ${styles.statusBadge}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {getStatusLabel(normalized)}
    </span>
  );
}

function AccountActivity({ accessToken, accountId, version }) {
  const bodyRef = useRef(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(null);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const currentResetKey = `${accountId}:${version}:${pageSize}`;
  const [resetKey, setResetKey] = useState(currentResetKey);

  if (resetKey !== currentResetKey) {
    setResetKey(currentResetKey);
    setPage(0);
  }

  const requestKey = accountId && pageSize ? `${currentResetKey}:${page}` : null;
  const loading = requestKey === null || state.key !== requestKey;
  const logs = state.data?.content ?? [];

  const measure = useCallback(() => {
    const body = bodyRef.current;
    const height = body?.clientHeight ?? 0;

    if (!height) {
      setPageSize((current) => current ?? ACTIVITY_SIZE);
      return;
    }

    const rowHeight = body.querySelector('tbody tr')?.getBoundingClientRect().height || ACTIVITY_ESTIMATED_ROW_PX;
    const headerHeight = body.querySelector('thead tr')?.getBoundingClientRect().height || rowHeight;
    const fit = Math.max(1, Math.floor((height - headerHeight - 2) / rowHeight));

    setPageSize((current) => (current === fit ? current : fit));
  }, []);

  useLayoutEffect(() => {
    measure();

    if (typeof ResizeObserver === 'undefined' || !bodyRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(bodyRef.current);
    return () => observer.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    if (logs.length > 0) {
      measure();
    }
  }, [logs.length, measure]);

  useEffect(() => {
    if (!accountId || !pageSize) {
      return undefined;
    }

    let ignore = false;
    const key = `${accountId}:${version}:${pageSize}:${page}`;

    getAdminAuditLogs(accessToken, {
      entityType: 'ACCOUNT',
      entityId: accountId,
      page,
      size: pageSize,
      sort: 'createdAt,DESC',
    })
      .then((response) => {
        if (!ignore) {
          setState({ key, data: response ?? null, error: null });
        }
      })
      .catch((apiError) => {
        if (!ignore) {
          setState({ key, data: null, error: toFriendlyError(apiError) });
        }
      });

    return () => {
      ignore = true;
    };
  }, [accessToken, accountId, version, pageSize, page]);

  return (
    <section className={`ds-panel ${styles.activityPanel} ${styles.activityArea}`} aria-labelledby="activity-title">
      <div className={styles.cardHeader}>
        <h2 id="activity-title" className={styles.cardTitle}>
          Actividad admin reciente
        </h2>
        <Link
          className={styles.viewAllLink}
          to={buildFilteredPath('/admin/audit-logs', { entityType: 'ACCOUNT', entityId: accountId })}
        >
          Ver todos
        </Link>
      </div>

      <div ref={bodyRef} className={styles.activityBody}>
        {loading && logs.length === 0 ? <Loading /> : null}
        {!loading ? <ErrorMessage error={state.error} /> : null}

        {!loading && !state.error && logs.length === 0 ? (
          <p className="ds-empty-state">No hay actividad administrativa registrada para esta cuenta.</p>
        ) : null}

        {!state.error && logs.length > 0 ? (
          <div className={`ds-table-frame ${styles.activityFrame}`} aria-busy={loading || undefined}>
            <table className={`ds-table ${styles.activityTable}`}>
              <caption className={styles.visuallyHidden}>Últimas acciones administrativas sobre la cuenta</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Admin</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.numericCell}>{formatDateTime(log.createdAt)}</td>
                    <td>{AUDIT_ACTION_LABELS[log.action] || log.action}</td>
                    <td className={styles.numericCell}>{log.userId ? shortId(log.userId) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {state.data && !state.error ? (
        <div className={styles.activityPagination}>
          <PaginationControls
            ariaLabel="Paginación de actividad"
            page={state.data.page ?? page}
            totalPages={state.data.totalPages}
            totalElements={state.data.totalElements}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}

function TechnicalDetails({ account }) {
  const [copied, setCopied] = useState(null);
  const copiedTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimeoutRef.current), []);

  async function copy(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(null), STATUS_MESSAGE_TIMEOUT);
    } catch {
      setCopied(null);
    }
  }

  const rows = [
    { label: 'ID de cuenta', value: account.id, copyable: true },
    { label: 'User ID', value: account.userId, copyable: true },
    { label: 'Creada', value: formatDateTime(account.createdAt) },
    { label: 'Actualizada', value: formatDateTime(account.updatedAt) },
  ];

  return (
    <section className={`ds-panel ${styles.technicalPanel} ${styles.technicalArea}`} aria-labelledby="technical-title">
      <div className={styles.cardHeader}>
        <h2 id="technical-title" className={styles.cardTitle}>
          Datos técnicos
        </h2>
        <p className={styles.statusMessage} role="status">
          {copied ? `${copied} copiado` : ''}
        </p>
      </div>
      <dl className={styles.technicalList}>
        {rows.map((row) => (
          <div key={row.label} className={styles.technicalRow}>
            <dt>{row.label}</dt>
            <dd>
              <span className={styles.technicalValue} title={row.value}>
                {row.value || '-'}
              </span>
              {row.copyable && row.value ? (
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => copy(row.label, row.value)}
                  aria-label={`Copiar ${row.label}`}
                  title={`Copiar ${row.label}`}
                >
                  {copied === row.label ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function toFriendlyError(apiError, invalidStateMessage) {
  const status = apiError?.status;

  if (status === 403) {
    return { ...apiError, message: 'No tenés permisos de administrador para realizar esta acción.' };
  }

  if (status === 404) {
    return { ...apiError, message: 'La cuenta ya no existe.' };
  }

  if (status === 422 && invalidStateMessage) {
    return { ...apiError, message: invalidStateMessage };
  }

  return apiError;
}

function shortId(id) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function getStatusLabel(status) {
  if (status === 'ACTIVE') {
    return 'Activa';
  }

  if (status === 'BLOCKED') {
    return 'Bloqueada';
  }

  if (status === 'CLOSED') {
    return 'Cerrada';
  }

  return status || '-';
}
