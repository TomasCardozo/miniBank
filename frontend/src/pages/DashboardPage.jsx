import { useEffect, useState } from 'react';
import { ArrowLeftRight, Eye, EyeOff, Landmark, WalletCards } from 'lucide-react';
import { getAccounts } from '../api/accountsApi';
import { getTransfers } from '../api/transfersApi';
import { useAuth } from '../auth/useAuth';
import AccountsPanel from '../components/dashboard/AccountsPanel';
import EvolutionPanel from '../components/dashboard/EvolutionPanel';
import QuickActionsPanel from '../components/dashboard/QuickActionsPanel';
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel';
import SummaryCard from '../components/dashboard/SummaryCard';
import { formatAmount } from '../utils/formatters';
import styles from '../components/dashboard/Dashboard.module.css';

const RECENT_TRANSFERS_QUERY = { size: '10', sort: 'createdAt,DESC' };
const BALANCE_VISIBILITY_STORAGE_KEY = 'minibank.dashboard.balanceVisibility';

export default function DashboardPage() {
  const auth = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [transfersTotal, setTransfersTotal] = useState(0);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersError, setTransfersError] = useState(null);
  const [isAmountsVisible, setIsAmountsVisible] = useState(() => getStoredBalanceVisibility());

  useEffect(() => {
    let ignore = false;

    async function loadAccounts() {
      setAccountsLoading(true);
      setAccountsError(null);

      try {
        const response = await getAccounts(auth.accessToken);

        if (!ignore) {
          setAccounts(Array.isArray(response) ? response : []);
        }
      } catch (apiError) {
        if (!ignore) {
          setAccountsError(apiError);
        }
      } finally {
        if (!ignore) {
          setAccountsLoading(false);
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

    async function loadTransfers() {
      setTransfersLoading(true);
      setTransfersError(null);

      try {
        const response = await getTransfers(auth.accessToken, RECENT_TRANSFERS_QUERY);
        const content = Array.isArray(response?.content) ? response.content : [];

        if (!ignore) {
          setTransfers(content);
          setTransfersTotal(response?.totalElements ?? content.length);
        }
      } catch (apiError) {
        if (!ignore) {
          setTransfersError(apiError);
        }
      } finally {
        if (!ignore) {
          setTransfersLoading(false);
        }
      }
    }

    loadTransfers();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken]);

  const summaryCards = buildSummaryCards({
    accounts,
    accountsLoading,
    accountsError,
    isAmountsVisible,
    transfersTotal,
    transfersLoading,
    transfersError,
  });
  const firstName = auth.user?.firstName;
  const greeting = getGreeting();

  return (
    <div className={styles.dashboard}>
      <header className={styles.hero}>
        <h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
        <button
          type="button"
          className={styles.visibilityButton}
          onClick={() =>
            setIsAmountsVisible((current) => {
              const nextValue = !current;
              storeBalanceVisibility(nextValue);
              return nextValue;
            })
          }
          aria-label={isAmountsVisible ? 'Ocultar numeros' : 'Mostrar numeros'}
          aria-pressed={!isAmountsVisible}
        >
          {isAmountsVisible ? <Eye size={21} aria-hidden="true" /> : <EyeOff size={21} aria-hidden="true" />}
        </button>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumen financiero">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              icon={card.icon}
              numeric={card.numeric}
            />
        ))}
      </section>

      <section className={styles.dashboardGrid} aria-label="Paneles del dashboard">
        <EvolutionPanel isAmountsVisible={isAmountsVisible} />
        <AccountsPanel accounts={accounts} loading={accountsLoading} error={accountsError} isAmountsVisible={isAmountsVisible} />
        <RecentActivityPanel transfers={transfers} loading={transfersLoading} error={transfersError} />
        <QuickActionsPanel />
      </section>
    </div>
  );
}

function getStoredBalanceVisibility() {
  try {
    return localStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY) !== 'hidden';
  } catch {
    return true;
  }
}

function storeBalanceVisibility(isVisible) {
  try {
    localStorage.setItem(BALANCE_VISIBILITY_STORAGE_KEY, isVisible ? 'visible' : 'hidden');
  } catch {
  }
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Buenos dias';
  }

  if (hour < 20) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}

function buildSummaryCards({ accounts, accountsLoading, accountsError, isAmountsVisible, transfersTotal, transfersLoading, transfersError }) {
  const totalsByCurrency = accounts.reduce(
    (totals, account) => {
      const currency = account.currency;

      if (currency === 'ARS' || currency === 'USD') {
        totals[currency] += amountToCents(account.balance);
      }

      return totals;
    },
    { ARS: 0n, USD: 0n }
  );
  const activeAccounts = accounts.filter((account) => account.status === 'ACTIVE').length;

  return [
    {
      title: 'Saldo ARS',
      value: summaryValue({
        loading: accountsLoading,
        error: accountsError,
        value: formatBalanceSummary(centsToAmount(totalsByCurrency.ARS), 'ARS', isAmountsVisible),
      }),
      description: 'Total real de tus cuentas en pesos. Sin historico disponible.',
      icon: Landmark,
      numeric: !accountsLoading && !accountsError,
    },
    {
      title: 'Saldo USD',
      value: summaryValue({
        loading: accountsLoading,
        error: accountsError,
        value: formatBalanceSummary(centsToAmount(totalsByCurrency.USD), 'USD', isAmountsVisible),
      }),
      description: 'Total real de tus cuentas en dolares. Sin historico disponible.',
      icon: Landmark,
      numeric: !accountsLoading && !accountsError,
    },
    {
      title: 'Cuentas activas',
      value: summaryValue({ loading: accountsLoading, error: accountsError, value: String(activeAccounts) }),
      description: 'Cantidad de cuentas propias activas.',
      icon: WalletCards,
      numeric: !accountsLoading && !accountsError,
    },
    {
      title: 'Transferencias',
      value: summaryValue({ loading: transfersLoading, error: transfersError, value: String(transfersTotal) }),
      description: 'Total de transferencias propias disponibles.',
      icon: ArrowLeftRight,
      numeric: !transfersLoading && !transfersError,
    },
  ];
}

function formatBalanceSummary(amount, currency, isAmountsVisible) {
  return isAmountsVisible ? formatAmount(amount, currency) : `-,---.-- ${currency}`;
}

function summaryValue({ loading, error, value }) {
  if (loading) {
    return 'Cargando...';
  }

  if (error) {
    return 'No disponible';
  }

  return value;
}

function amountToCents(amount) {
  if (amount === undefined || amount === null || amount === '') {
    return 0n;
  }

  const normalized = String(amount).trim();
  const negative = normalized.startsWith('-');
  const [integerPart, decimalPart = ''] = normalized.replace('-', '').split('.');
  const cents = BigInt(integerPart || '0') * 100n + BigInt(decimalPart.padEnd(2, '0').slice(0, 2) || '0');

  return negative ? -cents : cents;
}

function centsToAmount(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const units = absolute / 100n;
  const decimals = String(absolute % 100n).padStart(2, '0');

  return `${negative ? '-' : ''}${units}.${decimals}`;
}
