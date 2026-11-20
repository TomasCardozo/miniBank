import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeftRight, ChevronRight, Landmark, ListOrdered, Send } from 'lucide-react';
import { getAccountLimits, updateAccountLimits } from '../api/limitsApi';
import { useAuth } from '../auth/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import { formatDateTime, formatMoneyAmount } from '../utils/formatters';
import styles from './AccountLimitsPage.module.css';

const SUGGESTION_PERCENTAGES = [25, 50, 75];
const WARNING_USAGE = 80;

export default function AccountLimitsPage() {
  const { accountId } = useParams();
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'ADMIN';
  const [limits, setLimits] = useState(null);
  const [newLimit, setNewLimit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const savedMessageTimeoutRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadLimits() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAccountLimits(auth.accessToken, accountId);

        if (!ignore) {
          setLimits(response);
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

    loadLimits();

    return () => {
      ignore = true;
    };
  }, [accountId, auth.accessToken]);

  useEffect(() => () => clearTimeout(savedMessageTimeoutRef.current), []);

  const currentLimit = Number(limits?.dailyLimit ?? 0);
  const usedToday = Number(limits?.usedToday ?? 0);
  const usage = currentLimit > 0 ? Math.min((usedToday / currentLimit) * 100, 100) : usedToday > 0 ? 100 : 0;
  const usageClass = usage >= 100 ? styles.usageFull : usage >= WARNING_USAGE ? styles.usageWarning : '';
  const hasNewLimit = newLimit !== '';
  const newLimitValue = Number(newLimit);
  const exceedsCurrent = hasNewLimit && !isAdmin && newLimitValue > currentLimit;
  const sameAsCurrent = hasNewLimit && newLimitValue === currentLimit;
  const canSave = hasNewLimit && !exceedsCurrent && !sameAsCurrent && !saving;
  const suggestions = buildSuggestions(currentLimit);

  function handleNewLimitChange(event) {
    const digits = event.target.value.replace(/\D/g, '');
    setNewLimit(buildRawAmountFromDigits(digits));
    setSaveError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    clearTimeout(savedMessageTimeoutRef.current);

    try {
      const response = await updateAccountLimits(auth.accessToken, accountId, {
        dailyLimit: newLimitValue,
      });

      setLimits(response);
      setNewLimit('');
      setSavedMessage('Limite actualizado.');
      savedMessageTimeoutRef.current = setTimeout(() => setSavedMessage(''), 2500);
    } catch (apiError) {
      setSaveError(apiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Limites diarios</h1>
          {limits ? (
            <p className={styles.metadata}>
              N° {limits.accountNumber} · {limits.currency} · dia {formatDate(limits.date)}
            </p>
          ) : null}
        </div>

        <Link className={`ds-button ds-button-secondary ${styles.backButton}`} to={`/accounts/${accountId}`}>
          Volver a cuenta
        </Link>
      </header>

      {loading ? <Loading /> : null}
      <ErrorMessage error={error} />

      {limits ? (
        <>
          <section className={styles.hero} aria-label="Uso del limite diario">
            <div className={styles.heroFigures}>
              <div>
                <span className={styles.heroLabel}>Disponible hoy</span>
                <strong className={styles.amount}>{formatMoneyAmount(limits.availableToday, limits.currency)}</strong>
              </div>
              <div className={styles.heroSecondary}>
                <span className={styles.heroLabel}>Limite diario</span>
                <strong className={styles.secondaryAmount}>{formatMoneyAmount(limits.dailyLimit, limits.currency)}</strong>
              </div>
            </div>

            <progress
              className={`${styles.usageBar} ${usageClass}`}
              aria-label="Uso del limite diario"
              max={100}
              value={Number(usage.toFixed(2))}
            />
            <p className={styles.usageText}>
              Usado hoy {formatMoneyAmount(limits.usedToday, limits.currency)} · {formatPercentage(usage)}
            </p>
          </section>

          <div className={styles.contentGrid}>
            <section className={`ds-panel ${styles.adjustCard}`} aria-labelledby="adjust-title">
              <div className={styles.cardHeader}>
                <h2 id="adjust-title" className={styles.cardTitle}>
                  Ajustar limite
                </h2>
                <p className={styles.statusMessage} role="status">
                  {savedMessage}
                </p>
              </div>

              <form className={styles.adjustForm} onSubmit={handleSubmit}>
                <fieldset disabled={saving}>
                  <div className="ds-field">
                    <label htmlFor="dailyLimit">Nuevo limite diario</label>
                    <div className={styles.amountInputGroup}>
                      <span className={styles.amountPrefix} aria-hidden="true">
                        $
                      </span>
                      <input
                        id="dailyLimit"
                        className={`ds-input ${styles.amountInput}`}
                        type="text"
                        inputMode="decimal"
                        value={formatAmountInput(newLimit)}
                        onChange={handleNewLimitChange}
                        placeholder={formatAmountInput(currentLimit.toFixed(2))}
                        aria-describedby="limit-help"
                      />
                    </div>
                  </div>

                  {suggestions.length > 0 ? (
                    <div className={styles.suggestionGroup} aria-label="Sugerencias de limite">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.percentage}
                          type="button"
                          className={`ds-button ds-button-secondary ${styles.suggestionButton} ${
                            newLimit === suggestion.amount ? styles.suggestionButtonActive : ''
                          }`}
                          onClick={() => setNewLimit(suggestion.amount)}
                        >
                          {suggestion.percentage}%
                        </button>
                      ))}
                      <span className={styles.suggestionHint}>del limite actual</span>
                    </div>
                  ) : null}

                  <div id="limit-help" className={styles.helpBlock}>
                    {hasNewLimit && !exceedsCurrent ? (
                      <p className={styles.preview}>{buildPreview(newLimitValue, usedToday, limits.currency)}</p>
                    ) : null}
                    {exceedsCurrent ? (
                      <p className={styles.fieldError}>Supera tu limite actual. Para subirlo, pediselo a un administrador.</p>
                    ) : null}
                    {sameAsCurrent ? <p className={styles.fieldHint}>Es igual al limite actual.</p> : null}
                    <p className={styles.fieldHint}>
                      {isAdmin
                        ? 'Como administrador podes subir o bajar el limite.'
                        : 'Podes bajar tu limite. Para volver a subirlo vas a necesitar a un administrador.'}
                    </p>
                  </div>

                  <div className={styles.formActions}>
                    <button className="ds-button ds-button-primary" type="submit" disabled={!canSave}>
                      {saving ? 'Guardando...' : 'Guardar limite'}
                    </button>
                  </div>
                </fieldset>
              </form>
              <ErrorMessage error={saveError} />
            </section>

            <nav className={`ds-panel ${styles.accessPanel}`} aria-label="Accesos de la cuenta">
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Accesos</h2>
              </div>
              <AccessLink
                to={`/accounts/${accountId}`}
                icon={<Landmark size={18} aria-hidden="true" />}
                title="Detalle de cuenta"
                description="Saldo y datos"
              />
              <AccessLink
                to={`/accounts/${accountId}/movements`}
                icon={<ListOrdered size={18} aria-hidden="true" />}
                title="Movimientos"
                description="Historial de la cuenta"
              />
              <AccessLink
                to={`/transfers?accountId=${accountId}`}
                icon={<ArrowLeftRight size={18} aria-hidden="true" />}
                title="Transferencias"
                description="Enviadas y recibidas"
              />
              <AccessLink
                to={`/transfers/new?sourceAccountId=${accountId}`}
                icon={<Send size={18} aria-hidden="true" />}
                title="Nueva transferencia"
                description="Desde esta cuenta"
              />
            </nav>
          </div>

          <footer className={styles.pageFooter}>
            <dl className={styles.technicalList} aria-label="Datos tecnicos">
              <div>
                <dt>ID de cuenta</dt>
                <dd>{limits.accountId}</dd>
              </div>
              <div>
                <dt>Ultima actualizacion del limite</dt>
                <dd>{formatDateTime(limits.updatedAt)}</dd>
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

function buildPreview(newLimit, usedToday, currency) {
  const remaining = newLimit - usedToday;

  if (remaining <= 0) {
    return 'Con este limite hoy ya no vas a poder transferir mas desde esta cuenta.';
  }

  return `Con este limite te quedarian ${formatMoneyAmount(remaining.toFixed(2), currency)} disponibles hoy.`;
}

function buildSuggestions(currentLimit) {
  if (!Number.isFinite(currentLimit) || currentLimit <= 0) {
    return [];
  }

  return SUGGESTION_PERCENTAGES.map((percentage) => {
    const calculated = currentLimit * (percentage / 100);
    const rounded = calculated < 100 ? Math.round(calculated) : Math.round(calculated / 100) * 100;

    return { percentage, amount: rounded.toFixed(2) };
  });
}

function buildRawAmountFromDigits(digits) {
  if (!digits) {
    return '';
  }

  const cents = BigInt(digits);

  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

function formatAmountInput(amount) {
  if (!amount) {
    return '';
  }

  const [integerPart, decimalPart = ''] = String(amount).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${groupedInteger}.${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}

function formatPercentage(value) {
  if (value > 0 && value < 0.01) {
    return '<0.01%';
  }

  if (value > 0 && value < 1) {
    return `${value.toFixed(2)}%`;
  }

  return `${Math.round(value)}%`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
