import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeftRight,
  Eye,
  Gauge,
  ListOrdered,
  MoreHorizontal,
} from "lucide-react";
import { createAccount, getAccounts } from "../api/accountsApi";
import { getDolarOficial, getDolarOficialPorFecha } from "../api/dolarApi";
import { useAuth } from "../auth/useAuth";
import ErrorMessage from "../components/ErrorMessage";
import Loading from "../components/Loading";
import { CURRENCIES } from "../constants/enums";
import { formatAmount } from "../utils/formatters";
import styles from "./AccountsPage.module.css";

const INITIAL_FORM = { currency: "ARS", alias: "" };
const ACCOUNT_FILTERS = {
  ALL: "ALL",
  ARS: "ARS",
  USD: "USD",
  BLOCKED: "BLOCKED",
};
const PREVIOUS_QUOTE_LOOKBACK_DAYS = 7;

export default function AccountsPage() {
  const auth = useAuth();
  const createButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const creatingRef = useRef(false);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [createError, setCreateError] = useState(null);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [activeFilter, setActiveFilter] = useState(ACCOUNT_FILTERS.ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [dolarOficial, setDolarOficial] = useState(null);
  const [dolarLoading, setDolarLoading] = useState(true);
  const [dolarError, setDolarError] = useState(null);
  const [dolarPrevio, setDolarPrevio] = useState(null);

  useEffect(() => {
    creatingRef.current = creating;
  }, [creating]);

  useEffect(() => {
    let ignore = false;

    async function loadAccounts() {
      setLoading(true);
      setError(null);
      setAccounts([]);

      try {
        const response = await getAccounts(auth.accessToken);

        if (!ignore) {
          setAccounts(Array.isArray(response) ? response : []);
          setLastUpdatedAt(new Date());
        }
      } catch (apiError) {
        if (!ignore) {
          setError(apiError);
          setAccounts([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAccounts();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken]);

  useEffect(() => {
    let ignore = false;

    async function loadDolarOficial() {
      setDolarLoading(true);
      setDolarError(null);
      setDolarPrevio(null);

      let current = null;

      try {
        current = await getDolarOficial();

        if (!ignore) {
          setDolarOficial(current);
        }
      } catch (apiError) {
        if (!ignore) {
          setDolarError(apiError);
          setDolarOficial(null);
        }
      } finally {
        if (!ignore) {
          setDolarLoading(false);
        }
      }

      if (!current || ignore) {
        return;
      }

      try {
        const previous = await findPreviousQuote(current.fechaActualizacion);

        if (!ignore) {
          setDolarPrevio(previous);
        }
      } catch {
        if (!ignore) {
          setDolarPrevio(null);
        }
      }
    }

    loadDolarOficial();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isCreatePanelOpen) {
      return undefined;
    }

    drawerRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !creatingRef.current) {
        closeCreatePanel();
        return;
      }

      if (event.key === "Tab") {
        trapDrawerFocus(event, drawerRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      createButtonRef.current?.focus();
    };
  }, [isCreatePanelOpen]);

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const createdAccount = await createAccount(auth.accessToken, {
        currency: form.currency,
        alias: form.alias || null,
      });

      setAccounts((currentAccounts) => [...currentAccounts, createdAccount]);
      setForm(INITIAL_FORM);
      setLastUpdatedAt(new Date());
      setIsCreatePanelOpen(false);
    } catch (apiError) {
      setCreateError(apiError);
    } finally {
      setCreating(false);
    }
  }

  function openCreatePanel() {
    setCreateError(null);
    setIsCreatePanelOpen(true);
  }

  function closeCreatePanel() {
    if (creating) {
      return;
    }

    setCreateError(null);
    setIsCreatePanelOpen(false);
  }

  const metadata = buildMetadata(accounts, loading, lastUpdatedAt);
  const accountStats = buildAccountStats(accounts);
  const visibleAccounts = filterAccounts(accounts, activeFilter, searchQuery);
  const groupedAccounts = groupAccountsByCurrency(visibleAccounts);
  const canShowAccounts = !loading && !error && accounts.length > 0;
  const hasVisibleAccounts = visibleAccounts.length > 0;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Banca personal</p>
          <h1 className={styles.title}>Cuentas</h1>
          <p className={styles.metadata}>{metadata}</p>
        </div>

        <button
          type="button"
          ref={createButtonRef}
          className={`ds-button ds-button-primary ${styles.createButton}`}
          onClick={openCreatePanel}
        >
          + Nueva cuenta
        </button>
      </header>

      {canShowAccounts ? (
        <KpiStrip
          stats={accountStats}
          dolarOficial={dolarOficial}
          dolarLoading={dolarLoading}
          dolarError={dolarError}
          dolarPrevio={dolarPrevio}
        />
      ) : null}

      <section className={`ds-panel ${styles.tableCard}`} aria-label="Mis cuentas">
        {loading ? <Loading /> : null}
        <ErrorMessage error={error} />

        {!loading && !error && accounts.length === 0 ? (
          <p className="ds-empty-state">No tenes cuentas creadas.</p>
        ) : null}

        {canShowAccounts ? (
          <>
            <AccountsToolbar
              activeFilter={activeFilter}
              searchQuery={searchQuery}
              stats={accountStats}
              onFilterChange={setActiveFilter}
              onSearchChange={setSearchQuery}
            />

            {!hasVisibleAccounts ? (
              <p className="ds-empty-state">
                No hay cuentas para los filtros aplicados.
              </p>
            ) : null}

            {hasVisibleAccounts ? (
              <div className={`ds-table-frame ${styles.tableScroller}`}>
                <AccountsTable groupedAccounts={groupedAccounts} />
              </div>
            ) : null}

            <TableFooter
              totalCount={accounts.length}
              visibleAccounts={visibleAccounts}
            />
          </>
        ) : null}
      </section>

      {isCreatePanelOpen ? (
        <div className={styles.drawerOverlay} role="presentation">
          <button
            type="button"
            className={styles.drawerBackdrop}
            onClick={closeCreatePanel}
            disabled={creating}
            aria-label="Cerrar panel de nueva cuenta"
          />

          <aside
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-account-title"
            tabIndex={-1}
          >
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>Alta de producto</p>
                <h2 id="create-account-title" className={styles.drawerTitle}>
                  Nueva cuenta
                </h2>
                <p className={styles.drawerDescription}>
                  Selecciona la moneda y, si queres, agrega un alias operativo.
                </p>
              </div>

              <button
                type="button"
                className="ds-button ds-button-secondary"
                onClick={closeCreatePanel}
                disabled={creating}
                aria-label="Cerrar panel de nueva cuenta"
              >
                Cerrar
              </button>
            </div>

            <form className={styles.createForm} onSubmit={handleSubmit}>
              <fieldset disabled={creating}>
                <p className="ds-field">
                  <label htmlFor="currency">Moneda</label>
                  <select
                    id="currency"
                    name="currency"
                    className="ds-input"
                    value={form.currency}
                    onChange={handleChange}
                    required
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </p>

                <p className="ds-field">
                  <label htmlFor="alias">Alias opcional</label>
                  <input
                    id="alias"
                    name="alias"
                    className="ds-input"
                    value={form.alias}
                    onChange={handleChange}
                    maxLength={100}
                  />
                </p>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className="ds-button ds-button-secondary"
                    onClick={closeCreatePanel}
                    disabled={creating}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="ds-button ds-button-primary">
                    {creating ? "Creando..." : "Crear cuenta"}
                  </button>
                </div>
              </fieldset>
            </form>
            {creating ? <Loading /> : null}
            <ErrorMessage error={createError} />
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function KpiStrip({
  stats,
  dolarOficial,
  dolarLoading,
  dolarError,
  dolarPrevio,
}) {
  return (
    <section className={styles.kpiStrip} aria-label="Resumen de cuentas">
      <article className={`ds-card ${styles.kpiItem}`}>
        <span>Patrimonio total estimado</span>
        <strong>
          $ {formatEstimatedWealth(stats, dolarOficial, dolarLoading)}
        </strong>
        <small>
          <ExchangeRateLabel
            dolarOficial={dolarOficial}
            dolarLoading={dolarLoading}
            dolarError={dolarError}
            dolarPrevio={dolarPrevio}
          />
        </small>
      </article>

      <article className={`ds-card ${styles.kpiItem}`}>
        <span>Saldo en ARS</span>
        <strong>
          $ {formatAmount(centsToDecimalString(stats.arsBalanceCents), "ARS")}
        </strong>
        <small>
          {stats.arsCount} {stats.arsCount === 1 ? "cuenta" : "cuentas"}
        </small>
      </article>

      <article className={`ds-card ${styles.kpiItem}`}>
        <span>Saldo en USD</span>
        <strong>
          $ {formatAmount(centsToDecimalString(stats.usdBalanceCents), "USD")}
        </strong>
        <small>
          {stats.usdCount} {stats.usdCount === 1 ? "cuenta" : "cuentas"}
        </small>
      </article>

      <article className={`ds-card ${styles.kpiItem}`}>
        <span>Cuentas bloqueadas</span>
        <strong>{stats.blockedCount}</strong>
        <small>
          {stats.blockedCount > 0 ? "Requiere atencion" : "Sin alertas"}
        </small>
      </article>
    </section>
  );
}

function AccountsToolbar({
  activeFilter,
  searchQuery,
  stats,
  onFilterChange,
  onSearchChange,
}) {
  const filters = [
    { value: ACCOUNT_FILTERS.ALL, label: `Todas (${stats.totalCount})` },
    { value: ACCOUNT_FILTERS.ARS, label: `ARS (${stats.arsCount})` },
    { value: ACCOUNT_FILTERS.USD, label: `USD (${stats.usdCount})` },
    {
      value: ACCOUNT_FILTERS.BLOCKED,
      label: `Bloqueadas (${stats.blockedCount})`,
    },
  ];

  return (
    <div className={styles.toolbar}>
      <div
        className={styles.filterChips}
        aria-label="Filtros rapidos de cuentas"
      >
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`ds-button ${styles.filterChip} ${activeFilter === filter.value ? styles.filterChipActive : "ds-button-secondary"}`}
            onClick={() => onFilterChange(filter.value)}
            aria-pressed={activeFilter === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className={`ds-field ${styles.searchField}`}>
        <span>Buscar cuenta</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="ds-input"
          placeholder="Numero o alias"
        />
      </label>
    </div>
  );
}

function AccountsTable({ groupedAccounts }) {
  return (
    <table
      className={`ds-table ${styles.accountsTable}`}
      aria-label="Listado de mis cuentas"
    >
      <thead>
        <tr>
          <th>Numero</th>
          <th>Alias</th>
          <th>Moneda</th>
          <th className={styles.alignRight}>Saldo</th>
          <th>Estado</th>
          <th className={styles.alignRight}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {groupedAccounts.map((group) => (
          <AccountGroupRows key={group.currency} group={group} />
        ))}
      </tbody>
    </table>
  );
}

function AccountGroupRows({ group }) {
  return (
    <>
      <tr className={styles.groupRow}>
        <th colSpan={6} scope="colgroup">
          {group.currency} — {group.accounts.length}{" "}
          {group.accounts.length === 1 ? "cuenta" : "cuentas"}
        </th>
      </tr>
      {group.accounts.map((account) => (
        <tr key={account.id}>
          <td className={styles.accountNumber}>{account.accountNumber}</td>
          <td>{account.alias || "-"}</td>
          <td>{account.currency}</td>
          <td className={styles.balanceCell}>
            {formatAmount(account.balance, account.currency)}
          </td>
          <td>
            <StatusBadge status={account.status} />
          </td>
          <td>
            <AccountActions account={account} />
          </td>
        </tr>
      ))}
    </>
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "").toUpperCase();
  const statusLabel = getStatusLabel(normalizedStatus);

  return (
    <span
      className={`ds-badge ${normalizedStatus === "BLOCKED" ? "ds-badge-danger" : "ds-badge-success"} ${styles.statusBadge}`}
    >
      <span
        className={`${styles.statusDot} ${normalizedStatus === "BLOCKED" ? styles.statusBlocked : styles.statusActive}`}
        aria-hidden="true"
      />
      {statusLabel}
    </span>
  );
}

function AccountActions({ account }) {
  const isBlocked = account.status === "BLOCKED";

  return (
    <div className={styles.actionButtons}>
      <Link
        className={`ds-icon-button ${styles.iconAction}`}
        to={`/accounts/${account.id}`}
        aria-label={`Ver detalle de cuenta ${account.accountNumber}`}
        title="Detalle"
      >
        <Eye size={15} aria-hidden="true" />
      </Link>
      <Link
        className={`ds-icon-button ${styles.iconAction}`}
        to={`/accounts/${account.id}/movements`}
        aria-label={`Ver movimientos de cuenta ${account.accountNumber}`}
        title="Movimientos"
      >
        <ListOrdered size={15} aria-hidden="true" />
      </Link>
      <Link
        className={`ds-icon-button ${styles.iconAction}`}
        to={`/accounts/${account.id}/limits`}
        aria-label={`Ver limites de cuenta ${account.accountNumber}`}
        title="Limites"
      >
        <Gauge size={15} aria-hidden="true" />
      </Link>
      {isBlocked ? (
        <button
          type="button"
          className={`ds-icon-button ${styles.iconAction} ${styles.iconActionDisabled}`}
          disabled
          aria-label={`Transferencias no disponibles para cuenta bloqueada ${account.accountNumber}`}
          title="Transferencias no disponibles para cuentas bloqueadas"
        >
          <ArrowLeftRight size={15} aria-hidden="true" />
        </button>
      ) : (
        <Link
          className={`ds-icon-button ${styles.iconAction}`}
          to={`/transfers?accountId=${account.id}`}
          aria-label={`Ver transferencias de cuenta ${account.accountNumber}`}
          title="Transferencias"
        >
          <ArrowLeftRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function TableFooter({ totalCount, visibleAccounts }) {
  const visibleCount = visibleAccounts.length;

  return (
    <footer className={styles.tableFooter}>
      <p>
        Mostrando {visibleCount} de {totalCount} cuentas
      </p>
      <div className={styles.exportActions}>
        <button
          type="button"
          className="ds-button ds-button-secondary"
          onClick={() => exportAccountsCsv(visibleAccounts)}
          disabled={visibleCount === 0}
        >
          CSV
        </button>
        <button
          type="button"
          className="ds-button ds-button-secondary"
          onClick={() => printAccountsPdf(visibleAccounts)}
          disabled={visibleCount === 0}
        >
          PDF
        </button>
      </div>
    </footer>
  );
}

function buildMetadata(accounts, loading, lastUpdatedAt) {
  const accountCount = accounts.length;
  const currencyCount = new Set(
    accounts.map((account) => account.currency).filter(Boolean),
  ).size;
  const updateLabel = loading
    ? "actualizando..."
    : `ultima actualizacion ${formatRelativeUpdate(lastUpdatedAt)}`;

  return `${accountCount} ${accountCount === 1 ? "cuenta" : "cuentas"} · ${currencyCount} ${currencyCount === 1 ? "moneda" : "monedas"} · ${updateLabel}`;
}

function formatRelativeUpdate(value) {
  if (!value) {
    return "pendiente";
  }

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - value.getTime()) / 60000),
  );

  if (minutes === 0) {
    return "hace menos de 1 min";
  }

  return `hace ${minutes} min`;
}

function buildAccountStats(accounts) {
  return accounts.reduce(
    (stats, account) => {
      const currency = account.currency;
      const balanceInCents = parseAmountCents(account.balance);

      stats.totalCount += 1;

      if (currency === "ARS") {
        stats.arsCount += 1;
        stats.arsBalanceCents += balanceInCents;
      }

      if (currency === "USD") {
        stats.usdCount += 1;
        stats.usdBalanceCents += balanceInCents;
      }

      if (account.status === "BLOCKED") {
        stats.blockedCount += 1;
      }

      return stats;
    },
    {
      totalCount: 0,
      arsCount: 0,
      usdCount: 0,
      blockedCount: 0,
      arsBalanceCents: 0n,
      usdBalanceCents: 0n,
    },
  );
}

function filterAccounts(accounts, activeFilter, searchQuery) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return accounts.filter((account) => {
    const matchesFilter =
      activeFilter === ACCOUNT_FILTERS.ALL ||
      account.currency === activeFilter ||
      (activeFilter === ACCOUNT_FILTERS.BLOCKED &&
        account.status === "BLOCKED");

    const matchesSearch =
      normalizedQuery.length === 0 ||
      String(account.accountNumber || "")
        .toLowerCase()
        .includes(normalizedQuery) ||
      String(account.alias || "")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesFilter && matchesSearch;
  });
}

function groupAccountsByCurrency(accounts) {
  return CURRENCIES.map((currency) => ({
    currency,
    accounts: accounts.filter((account) => account.currency === currency),
  })).filter((group) => group.accounts.length > 0);
}

function formatEstimatedWealth(stats, dolarOficial, dolarLoading) {
  if (dolarLoading) {
    return "Calculando...";
  }

  const ventaCents = parseAmountCents(dolarOficial?.venta);

  if (ventaCents <= 0n) {
    return "No disponible";
  }

  const estimatedUsdCents =
    stats.usdBalanceCents +
    divideAndRound(stats.arsBalanceCents * 100n, ventaCents);

  return formatAmount(centsToDecimalString(estimatedUsdCents), "USD");
}

function ExchangeRateLabel({
  dolarOficial,
  dolarLoading,
  dolarError,
  dolarPrevio,
}) {
  const venta = Number(dolarOficial?.venta);

  if (dolarLoading) {
    return "Cargando tipo de cambio...";
  }

  if (dolarError || !Number.isFinite(venta) || venta <= 0) {
    return "No se pudo cargar el tipo de cambio";
  }

  const change = getExchangeRateChange(venta, dolarPrevio);
  const changeClassName = change
    ? `${styles.rateChange} ${styles[change.direction]}`
    : null;

  return (
    <>
      {"Tipo de cambio oficial venta: 1 USD = "}
      <span className={styles.rateValue} title={change?.ariaLabel}>
        {formatAmount(venta.toFixed(2), "ARS")}
        {change ? (
          <span className={changeClassName}>
            {" "}
            {change.arrow ? (
              <span aria-hidden="true">{change.arrow}</span>
            ) : null}
            {`${change.arrow ? " " : ""}${change.deltaLabel} (${change.percentLabel})`}
          </span>
        ) : null}
      </span>
    </>
  );
}

function getExchangeRateChange(venta, dolarPrevio) {
  const ventaPrevia = Number(dolarPrevio?.venta);

  if (!Number.isFinite(ventaPrevia) || ventaPrevia <= 0) {
    return null;
  }

  const delta = venta - ventaPrevia;
  const roundedDelta = Number(delta.toFixed(2));
  const percent = (delta / ventaPrevia) * 100;

  if (roundedDelta === 0) {
    return {
      direction: "flat",
      arrow: "▲",
      deltaLabel: formatAmount("0.00"),
      percentLabel: `${formatAmount("0.00")}%`,
      ariaLabel: "Sin cambios respecto del cierre anterior",
    };
  }

  const direction = roundedDelta > 0 ? "up" : "down";
  const sign = roundedDelta > 0 ? "+" : "";
  const deltaLabel = `${sign}${formatAmount(roundedDelta.toFixed(2))}`;
  const percentLabel = `${sign}${formatAmount(percent.toFixed(2))}%`;
  const ariaLabel = `${direction === "up" ? "Subio" : "Bajo"} ${formatAmount(
    Math.abs(roundedDelta).toFixed(2),
    "ARS",
  )} (${formatAmount(Math.abs(percent).toFixed(2))}%) respecto del cierre anterior`;

  return {
    direction,
    arrow: direction === "up" ? "▲" : "▼",
    deltaLabel,
    percentLabel,
    ariaLabel,
  };
}

async function findPreviousQuote(fechaActualizacion) {
  const base = new Date(fechaActualizacion);

  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const currentDay = toDayKey(base);

  for (let offset = 1; offset <= PREVIOUS_QUOTE_LOOKBACK_DAYS; offset += 1) {
    const candidateDate = new Date(base);
    candidateDate.setDate(candidateDate.getDate() - offset);

    const candidate = await getDolarOficialPorFecha(candidateDate);

    if (candidate && candidate.fecha !== currentDay) {
      return candidate;
    }
  }

  return null;
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseAmountCents(amount) {
  const match = String(amount ?? "0")
    .trim()
    .match(/^(-?)(\d+)(?:\.(\d{0,2}))?$/);

  if (!match) {
    return 0n;
  }

  const [, sign, integerPart, decimalPart = ""] = match;
  const cents = BigInt(integerPart) * 100n + BigInt(decimalPart.padEnd(2, "0"));

  return sign === "-" ? -cents : cents;
}

function centsToDecimalString(cents) {
  const sign = cents < 0n ? "-" : "";
  const absoluteCents = cents < 0n ? -cents : cents;
  const integerPart = absoluteCents / 100n;
  const decimalPart = String(absoluteCents % 100n).padStart(2, "0");

  return `${sign}${integerPart}.${decimalPart}`;
}

function divideAndRound(dividend, divisor) {
  if (dividend < 0n) {
    return -divideAndRound(-dividend, divisor);
  }

  return (dividend + divisor / 2n) / divisor;
}

function getStatusLabel(status) {
  if (status === "ACTIVE") {
    return "Activa";
  }

  if (status === "BLOCKED") {
    return "Bloqueada";
  }

  return status || "-";
}

function exportAccountsCsv(accounts) {
  const headers = ["Numero", "Alias", "Moneda", "Saldo", "Estado"];
  const rows = accounts.map((account) => [
    textSafeSpreadsheetValue(account.accountNumber),
    account.alias || "",
    account.currency,
    account.balance,
    account.status,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "minibank-cuentas.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printAccountsPdf(accounts) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert(
      "No se pudo abrir la vista para imprimir. Permití las ventanas emergentes para este sitio e intentá de nuevo.",
    );
    return;
  }

  const totals = new Map();
  accounts.forEach((account) => {
    totals.set(
      account.currency,
      (totals.get(account.currency) ?? 0n) + parseAmountCents(account.balance),
    );
  });

  const rows = accounts
    .map(
      (account) => `<tr>
        <td>${escapeHtml(account.accountNumber)}</td>
        <td>${escapeHtml(account.alias || "-")}</td>
        <td>${escapeHtml(account.currency)}</td>
        <td class="num">${escapeHtml(formatAmount(account.balance, account.currency))}</td>
        <td>${escapeHtml(getStatusLabel(account.status))}</td>
      </tr>`,
    )
    .join("");
  const totalRows = [...totals.entries()]
    .map(
      ([currency, cents]) => `<tr>
        <th colspan="3" scope="row">Total ${escapeHtml(currency)}</th>
        <td class="num">${escapeHtml(formatAmount(centsToDecimalString(cents), currency))}</td>
        <td></td>
      </tr>`,
    )
    .join("");
  const generatedAt = new Date().toLocaleString("es-AR");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>MiniBank - Mis cuentas</title>
<style>
  body { margin: 2rem; color: #101715; font: 12px/1.5 system-ui, sans-serif; }
  h1 { margin: 0 0 0.25rem; font-size: 20px; }
  p { margin: 0 0 1.5rem; color: #5b6763; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #d7ddda; text-align: left; }
  thead th { background: #eef2f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot th, tfoot td { font-weight: 600; border-bottom: 0; border-top: 2px solid #9aa6a1; }
  @page { margin: 1.5cm; }
</style>
</head>
<body>
<h1>MiniBank · Mis cuentas</h1>
<p>${escapeHtml(`${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"} · generado el ${generatedAt}`)}</p>
<table>
  <thead><tr><th>Número</th><th>Alias</th><th>Moneda</th><th class="num">Saldo</th><th>Estado</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>${totalRows}</tfoot>
</table>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.addEventListener("afterprint", () => printWindow.close());
  printWindow.print();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCsvValue(value) {
  const stringValue = neutralizeSpreadsheetFormula(String(value ?? ""));

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function neutralizeSpreadsheetFormula(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function textSafeSpreadsheetValue(value) {
  return value ? `'${value}` : "";
}

function trapDrawerFocus(event, container) {
  if (!container) {
    return;
  }

  const focusableElements = Array.from(
    container.querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );

  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}
