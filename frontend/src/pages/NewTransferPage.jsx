import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Landmark,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { getAccounts } from "../api/accountsApi";
import { createTransfer } from "../api/transfersApi";
import { useAuth } from "../auth/useAuth";
import Loading from "../components/Loading";
import TransferErrorCard from "../components/transfers/TransferErrorCard";
import TransferReceipt from "../components/transfers/TransferReceipt";
import { formatMoneyAmount } from "../utils/formatters";
import styles from "./TransfersPage.module.css";

const SUGGESTION_PERCENTAGES = [10, 25, 50];

const INITIAL_FORM = {
  sourceAccountId: "",
  targetAccountNumber: "",
  amount: "",
  description: "",
};

export default function NewTransferPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const requestedSourceAccountId = searchParams.get("sourceAccountId") || "";
  const reviewHeadingRef = useRef(null);
  const sentHeadingRef = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [reviewing, setReviewing] = useState(false);
  const [createdTransfer, setCreatedTransfer] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const selectedAccount = accounts.find(
    (account) => account.id === form.sourceAccountId,
  );
  const suggestedAmounts = buildSuggestedAmounts(
    selectedAccount?.balance,
    selectedAccount?.currency,
  );
  const isTargetAccountComplete = /^[0-9]{12}$/.test(form.targetAccountNumber);
  const targetAccount = isTargetAccountComplete
    ? accounts.find(
        (account) => account.accountNumber === form.targetAccountNumber,
      )
    : undefined;
  const hasAmount = Number(form.amount) > 0;

  useEffect(() => {
    let ignore = false;

    async function loadAccounts() {
      setLoadingAccounts(true);
      setAccountsError(null);

      try {
        const response = await getAccounts(auth.accessToken);
        const ownAccounts = Array.isArray(response) ? response : [];

        if (!ignore) {
          setAccounts(ownAccounts);

          if (ownAccounts.some((account) => account.id === requestedSourceAccountId)) {
            setForm((current) =>
              current.sourceAccountId
                ? current
                : { ...current, sourceAccountId: requestedSourceAccountId },
            );
          }
        }
      } catch (apiError) {
        if (!ignore) {
          setAccountsError(apiError);
        }
      } finally {
        if (!ignore) {
          setLoadingAccounts(false);
        }
      }
    }

    loadAccounts();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken, requestedSourceAccountId]);

  useEffect(() => {
    if (reviewing) {
      reviewHeadingRef.current?.focus();
    }
  }, [reviewing]);

  useEffect(() => {
    if (createdTransfer) {
      sentHeadingRef.current?.focus();
    }
  }, [createdTransfer]);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleAmountChange(event) {
    const digits = event.target.value.replace(/\D/g, "");
    setForm({ ...form, amount: buildRawAmountFromDigits(digits) });
  }

  function handleSuggestedAmount(amount) {
    setForm({ ...form, amount });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!reviewing) {
      setSubmitError(null);
      setCreatedTransfer(null);
      setReviewing(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setCreatedTransfer(null);

    try {
      const response = await createTransfer(auth.accessToken, {
        sourceAccountId: form.sourceAccountId,
        targetAccountNumber: form.targetAccountNumber,
        amount: form.amount,
        description: form.description || null,
      });
      setCreatedTransfer(response);
      setForm(INITIAL_FORM);
      setReviewing(false);

      setLoadingAccounts(true);
      setAccountsError(null);
      try {
        const refreshedAccounts = await getAccounts(auth.accessToken);
        setAccounts(Array.isArray(refreshedAccounts) ? refreshedAccounts : []);
      } catch (apiError) {
        setAccountsError(apiError);
      } finally {
        setLoadingAccounts(false);
      }
    } catch (apiError) {
      setSubmitError(apiError);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditData() {
    setReviewing(false);
    setSubmitError(null);
  }

  function handleNewTransfer() {
    setCreatedTransfer(null);
    setReviewing(false);
    setSubmitError(null);
    setForm(INITIAL_FORM);
  }

  return (
    <main className={styles.page}>
      <header className={`${styles.pageHeader} ${styles.transferPageHeader}`}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/transfers">Transferencias</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent} aria-current="page">
            Nueva transferencia
          </span>
        </nav>
        <h1 className={styles.pageTitle}>Nueva transferencia</h1>
        <p className={styles.pageSubtitle}>
          Transferi fondos entre tus cuentas o hacia una cuenta de terceros.
        </p>
      </header>

      {loadingAccounts ? <Loading /> : null}
      <TransferErrorCard error={accountsError} />

      {!loadingAccounts && !accountsError && accounts.length === 0 ? (
        <p>
          No tenes cuentas para transferir.{" "}
          <Link to="/accounts">Crear cuenta</Link>
        </p>
      ) : null}

      {accounts.length > 0 && !createdTransfer ? (
        <section className={`ds-panel ${styles.panel} ${styles.transferPanel}`}>
          <header className={styles.transferPanelHeader}>
            <h2 className={styles.transferPanelTitle}>
              Detalle de la transferencia
            </h2>
            <StepProgress step={reviewing ? 2 : 1} />
          </header>
          <div className={styles.transferPanelBody}>
            <form className={styles.transferForm} onSubmit={handleSubmit}>
              <fieldset disabled={submitting}>
                {reviewing ? (
                  <TransferReview
                    form={form}
                    selectedAccount={selectedAccount}
                    targetAccount={targetAccount}
                    headingRef={reviewHeadingRef}
                  />
                ) : (
                  <>
                    <div className={`ds-field ${styles.formField}`}>
                      <label htmlFor="sourceAccountId">Cuenta origen</label>
                      <br />
                      <span className={styles.fieldWithBadge}>
                        {selectedAccount ? (
                          <AccountBadge
                            initials={getAccountInitials(selectedAccount)}
                          />
                        ) : null}
                        <select
                          id="sourceAccountId"
                          name="sourceAccountId"
                          value={form.sourceAccountId}
                          onChange={handleChange}
                          className="ds-input"
                          required
                        >
                          <option value="">Selecciona una cuenta</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.accountNumber} - {account.currency} -{" "}
                              {account.alias || "Sin alias"}
                            </option>
                          ))}
                        </select>
                      </span>
                      {selectedAccount ? (
                        <div className={styles.availableBalanceBox}>
                          <span className={`${styles.accountBalance} amount`}>
                            <Wallet size={15} aria-hidden="true" />
                            Saldo disponible:{" "}
                            {formatMoneyAmount(
                              selectedAccount.balance,
                              selectedAccount.currency,
                            )}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <p className={`ds-field ${styles.formField}`}>
                      <label htmlFor="targetAccountNumber">
                        Numero de cuenta destino
                      </label>
                      <br />
                      <span className={styles.fieldWithBadge}>
                        {isTargetAccountComplete ? (
                          <AccountBadge
                            initials={getAccountInitials(targetAccount)}
                          />
                        ) : null}
                        <span className={styles.inputWithStatus}>
                          <input
                            id="targetAccountNumber"
                            name="targetAccountNumber"
                            value={form.targetAccountNumber}
                            onChange={handleChange}
                            inputMode="numeric"
                            pattern="[0-9]{12}"
                            aria-describedby="targetAccountNumber-help"
                            className="ds-input"
                            required
                          />
                          {isTargetAccountComplete ? (
                            <Check
                              size={16}
                              className={styles.validIcon}
                              aria-hidden="true"
                            />
                          ) : null}
                        </span>
                      </span>
                      <span
                        id="targetAccountNumber-help"
                        className={styles.fieldHelp}
                      >
                        Debe tener exactamente 12 digitos.
                      </span>
                      {targetAccount ? (
                        <span className={styles.availableBalanceBox}>
                          <span className={styles.accountBalance}>
                            <Landmark size={15} aria-hidden="true" />
                            {targetAccount.currency} -{" "}
                            {targetAccount.alias || "Sin alias"}
                          </span>
                        </span>
                      ) : null}
                    </p>

                    <div
                      className={`ds-field ${styles.formField} ${styles.amountField}`}
                    >
                      <label htmlFor="amount">Monto</label>

                      <div className={styles.amountInputGroup}>
                        <span
                          className={styles.amountPrefix}
                          aria-hidden="true"
                        >
                          $
                        </span>
                        <input
                          id="amount"
                          name="amount"
                          className={[
                            "ds-input",
                            styles.amountInput,
                            styles.amountValueInput,
                            hasAmount ? styles.amountValueInputFilled : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          type="text"
                          value={formatTransferAmountInput(form.amount)}
                          onChange={handleAmountChange}
                          inputMode="decimal"
                          required
                          aria-describedby={
                            selectedAccount ? "amount-currency-help" : undefined
                          }
                        />
                      </div>
                      {selectedAccount ? (
                        <span
                          id="amount-currency-help"
                          className={styles.visuallyHidden}
                        >
                          Monto en {selectedAccount.currency}
                        </span>
                      ) : null}

                      {suggestedAmounts.length > 0 ? (
                        <div
                          className={styles.suggestionGroup}
                          role="group"
                          aria-label="Montos sugeridos"
                        >
                          {suggestedAmounts.map((suggestion) => {
                            const isSelected = form.amount === suggestion.value;

                            return (
                              <button
                                key={suggestion.label}
                                type="button"
                                className={[
                                  "ds-button",
                                  "ds-button-secondary",
                                  styles.suggestionButton,
                                  isSelected
                                    ? styles.suggestionButtonActive
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                aria-label={`${suggestion.label} ${suggestion.display}`}
                                aria-pressed={isSelected}
                                onClick={() =>
                                  handleSuggestedAmount(suggestion.value)
                                }
                              >
                                <span>{suggestion.label}</span>
                                <span className="amount">
                                  {suggestion.display}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <p className={`ds-field ${styles.formField}`}>
                      <label htmlFor="description">Descripcion opcional</label>
                      <br />
                      <input
                        id="description"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        maxLength={255}
                        className="ds-input"
                      />
                    </p>
                  </>
                )}

                <TransferErrorCard error={submitError} />

                <hr className={styles.formDivider} />

                <div className={styles.formActions}>
                  {reviewing ? (
                    <button
                      className={`ds-button ds-button-secondary ${styles.secondaryButton}`}
                      type="button"
                      onClick={handleEditData}
                    >
                      Editar datos
                    </button>
                  ) : null}
                  <button
                    className={`ds-button ds-button-primary ${styles.primaryButton}`}
                    type="submit"
                  >
                    {submitting
                      ? "Enviando..."
                      : reviewing
                        ? "Confirmar transferencia"
                        : "Siguiente Paso"}
                  </button>
                  <p className={styles.legalText}>
                    Al crear una transferencia aceptas los terminos y
                    condiciones de MiniBank.
                  </p>
                </div>
              </fieldset>
            </form>
            {submitting ? <Loading /> : null}
          </div>
        </section>
      ) : null}

      {createdTransfer ? (
        <section
          className={`ds-panel ${styles.panel} ${styles.transferPanel}`}
          role="status"
          aria-live="polite"
        >
          <header
            className={`${styles.transferPanelHeader} ${styles.sentPanelHeader}`}
          >
            <span className={styles.successIcon} aria-hidden="true">
              <CheckCircle2 size={32} />
            </span>
            <h2
              className={styles.transferPanelTitle}
              ref={sentHeadingRef}
              tabIndex={-1}
            >
              Transferencia enviada
            </h2>
          </header>
          <div className={styles.transferPanelBody}>
            <TransferReceipt transfer={createdTransfer} />
            <div className={styles.sentTransferActions}>
              <button
                className={`ds-button ds-button-primary ${styles.primaryButton}`}
                type="button"
                onClick={handleNewTransfer}
              >
                Hacer nueva transferencia
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <p className={styles.backLinkRow}>
        <Link to="/transfers">Volver a transferencias</Link>
      </p>
    </main>
  );
}

function StepProgress({ step }) {
  return (
    <span className={styles.stepIndicator}>
      <span className={styles.visuallyHidden}>{`Paso ${step} de 2`}</span>
      <span className={styles.stepTrack} aria-hidden="true">
        <span className={`${styles.stepSegment} ${styles.stepSegmentDone}`} />
        <span
          className={`${styles.stepSegment} ${step >= 2 ? styles.stepSegmentDone : ""}`}
        />
      </span>
    </span>
  );
}

function AccountBadge({ initials }) {
  return (
    <span className={styles.accountBadge} aria-hidden="true">
      {initials || <User size={16} />}
    </span>
  );
}

function getAccountInitials(account) {
  const alias = account?.alias?.trim();

  if (!alias) {
    return null;
  }

  const [firstWord = "", secondWord = ""] = alias.split(/\s+/);

  return `${firstWord[0] || ""}${secondWord[0] || ""}`.toUpperCase() || null;
}

function buildSuggestedAmounts(balance, currency) {
  const numericBalance = Number(balance);

  if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
    return [];
  }

  return SUGGESTION_PERCENTAGES.map((percentage) => {
    const calculatedAmount = numericBalance * (percentage / 100);
    const roundedAmount =
      calculatedAmount < 10
        ? Math.round(calculatedAmount)
        : Math.round(calculatedAmount / 100) * 100;
    const value = roundedAmount.toFixed(2);

    return {
      label: `${percentage}%`,
      value,
      display: formatMoneyAmount(value, currency),
    };
  }).filter((suggestion) => Number(suggestion.value) > 0);
}

function buildRawAmountFromDigits(digits) {
  if (!digits) {
    return "";
  }

  const cents = BigInt(digits);
  const integerPart = cents / 100n;
  const decimalPart = cents % 100n;

  return `${integerPart}.${decimalPart.toString().padStart(2, "0")}`;
}

function formatTransferAmountInput(amount) {
  if (!amount) {
    return "";
  }

  const [integerPart, decimalPart = ""] = String(amount).split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${groupedInteger}.${decimalPart.padEnd(2, "0").slice(0, 2)}`;
}

function TransferReview({ form, selectedAccount, targetAccount, headingRef }) {
  const sourceAccountLabel = selectedAccount
    ? `${selectedAccount.accountNumber} - ${selectedAccount.currency} - ${selectedAccount.alias || "Sin alias"}`
    : form.sourceAccountId;
  const currency = selectedAccount?.currency || "";

  return (
    <section
      className={styles.transferReview}
      aria-labelledby="transfer-review-title"
    >
      <h3
        id="transfer-review-title"
        className={styles.reviewTitle}
        ref={headingRef}
        tabIndex={-1}
      >
        <ShieldCheck size={18} aria-hidden="true" />
        Revisa los datos antes de confirmar
      </h3>

      <p className={`${styles.reviewAmount} amount-xl`}>
        {formatMoneyAmount(form.amount, currency)}
      </p>

      <div className={styles.reviewGroup}>
        <h4 className={styles.reviewGroupTitle}>Origen y destino</h4>
        <dl className={styles.reviewList}>
          <dt>Cuenta origen</dt>
          <dd>
            <span
              className={`${styles.fieldWithBadge} ${styles.reviewAccountValue}`}
            >
              <AccountBadge initials={getAccountInitials(selectedAccount)} />
              <span>{sourceAccountLabel}</span>
            </span>
          </dd>
          <dt>Numero de cuenta destino</dt>
          <dd>
            <span
              className={`${styles.fieldWithBadge} ${styles.reviewAccountValue}`}
            >
              <AccountBadge initials={getAccountInitials(targetAccount)} />
              <span>{form.targetAccountNumber}</span>
            </span>
          </dd>
        </dl>
      </div>

      <div className={styles.reviewGroup}>
        <h4 className={styles.reviewGroupTitle}>Detalle</h4>
        <dl className={styles.reviewList}>
          <dt>Moneda</dt>
          <dd>{currency || "-"}</dd>
          <dt>Descripcion</dt>
          <dd>{form.description || "-"}</dd>
        </dl>
      </div>
    </section>
  );
}
