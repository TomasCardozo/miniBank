import { useEffect, useMemo, useState } from 'react';
import { getDolarOficialHistorico } from '../../api/dolarApi';
import { getNetWorthHistory } from '../../api/netWorthApi';
import { useAuth } from '../../auth/useAuth';
import { formatAmount } from '../../utils/formatters';
import { buildRateLookup, buildUsdNetWorth, rangeEndingToday } from '../../utils/netWorth';
import ErrorMessage from '../ErrorMessage';
import Loading from '../Loading';
import styles from './Dashboard.module.css';

export const RANGE_OPTIONS = [
  { days: 30, label: '30D', name: 'Ultimos 30 dias' },
  { days: 90, label: '90D', name: 'Ultimos 90 dias' },
  { days: 365, label: '1A', name: 'Ultimo año' },
];
const DEFAULT_RANGE_DAYS = 90;
const MIN_VISIBLE_FLOW_USD = 0.005;

export default function EvolutionPanel({ isAmountsVisible = true }) {
  const auth = useAuth();
  const [rangeDays, setRangeDays] = useState(DEFAULT_RANGE_DAYS);
  const [history, setHistory] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [historyResponse, quotesResponse] = await Promise.all([
          getNetWorthHistory(auth.accessToken, rangeEndingToday(rangeDays)),
          getDolarOficialHistorico(),
        ]);

        if (!ignore) {
          setHistory(historyResponse);
          setQuotes(quotesResponse);
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

    load();

    return () => {
      ignore = true;
    };
  }, [auth.accessToken, rangeDays]);

  const netWorth = useMemo(() => {
    if (!history || !quotes) {
      return { value: null, error: null };
    }

    try {
      return { value: buildUsdNetWorth(history, buildRateLookup(quotes)), error: null };
    } catch (conversionError) {
      return { value: null, error: conversionError };
    }
  }, [history, quotes]);

  const visibleError = error ?? netWorth.error;

  return (
    <article className={`ds-panel ${styles.panel} ${styles.featurePanel}`} aria-labelledby="net-worth-title">
      <div className={styles.chartHeader}>
        <div>
          <h2 id="net-worth-title" className="mb-1">Evolucion del patrimonio</h2>
          <p className={`${styles.muted} ${styles.chartNote}`}>
            En USD al dolar oficial venta de cada dia. Solo suman o restan los movimientos con cuentas de terceros.
          </p>
        </div>
        <div className={styles.rangeSwitch} role="group" aria-label="Periodo">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              className={styles.rangeButton}
              aria-pressed={rangeDays === option.days}
              aria-label={option.name}
              onClick={() => setRangeDays(option.days)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !netWorth.value ? <Loading /> : null}
      <ErrorMessage error={visibleError} />

      {netWorth.value && !visibleError ? (
        <div className={loading ? styles.chartRefreshing : undefined} aria-busy={loading}>
          <NetWorthStats summary={netWorth.value.summary} isAmountsVisible={isAmountsVisible} />
          <NetWorthChart points={netWorth.value.points} isAmountsVisible={isAmountsVisible} />
        </div>
      ) : null}
    </article>
  );
}

function NetWorthStats({ summary, isAmountsVisible }) {
  const percent =
    summary.changePercent === null || !isAmountsVisible ? null : `${formatSigned(summary.changePercent, 1)}%`;

  return (
    <dl className={styles.stats}>
      <Stat label="Patrimonio actual" value={formatUsd(summary.endUsd, isAmountsVisible)} />
      <Stat
        label="Variacion del periodo"
        value={formatUsd(summary.changeUsd, isAmountsVisible, { signed: true })}
        detail={percent}
        tone={tone(summary.changeUsd)}
      />
      <Stat
        label="Flujo neto con terceros"
        value={formatUsd(summary.netFlowUsd, isAmountsVisible, { signed: true })}
        tone={tone(summary.netFlowUsd)}
      />
      <Stat
        label="Efecto cambiario"
        value={formatUsd(summary.fxEffectUsd, isAmountsVisible, { signed: true })}
        detail={`Oficial venta ${formatAmount(summary.lastRate.toFixed(2), 'ARS')}`}
        tone={tone(summary.fxEffectUsd)}
      />
    </dl>
  );
}

function Stat({ label, value, detail, tone: valueTone }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} ${valueTone ? styles[valueTone] : ''}`}>{value}</dd>
      {detail ? <dd className={styles.statDetail}>{detail}</dd> : null}
    </div>
  );
}

function NetWorthChart({ points, isAmountsVisible }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const geometry = useMemo(() => buildGeometry(points), [points]);

  if (points.length === 0) {
    return null;
  }

  const active = activeIndex === null ? null : geometry.coordinates[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];

  function moveTo(clientX, element) {
    const bounds = element.getBoundingClientRect();

    if (bounds.width <= 0) {
      return;
    }

    const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  function handleKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    setActiveIndex((current) => {
      const start = current === null ? points.length - 1 : current + step;
      return Math.min(Math.max(start, 0), points.length - 1);
    });
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className={styles.chartFigure}>
      <div
        className={styles.chart}
        role="img"
        tabIndex={0}
        aria-label={`Patrimonio en USD del ${formatShortDate(first.date)} al ${formatShortDate(last.date)}: de ${formatUsd(
          first.totalUsd,
          isAmountsVisible
        )} a ${formatUsd(last.totalUsd, isAmountsVisible)}. Usa las flechas para recorrer los dias.`}
        onPointerMove={(event) => moveTo(event.clientX, event.currentTarget)}
        onPointerLeave={() => setActiveIndex(null)}
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <div className={styles.plot}>
          <svg className={styles.chartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.chartArea} d={geometry.areaPath} />
            <path className={styles.chartLine} d={geometry.linePath} vectorEffect="non-scaling-stroke" />
          </svg>

          <svg className={styles.chartOverlay} aria-hidden="true">
            {active ? <line className={styles.chartGuide} x1={`${active.x}%`} x2={`${active.x}%`} y1="-15%" y2="115%" /> : null}
            {points.map((point, index) =>
              Math.abs(point.netFlowUsd) >= MIN_VISIBLE_FLOW_USD ? (
                <circle
                  key={point.date}
                  data-testid="flow-dot"
                  className={`${styles.flowDot} ${point.netFlowUsd > 0 ? styles.flowDotIn : styles.flowDotOut}`}
                  cx={`${geometry.coordinates[index].x}%`}
                  cy={`${geometry.coordinates[index].y}%`}
                  r="4.5"
                />
              ) : null
            )}
            {active ? <circle className={styles.activeDot} cx={`${active.x}%`} cy={`${active.y}%`} r="5.5" /> : null}
          </svg>
        </div>

        {isAmountsVisible ? (
          <>
            <span className={`${styles.axisValue} ${styles.axisValueTop}`}>{formatUsd(geometry.max, true)}</span>
            <span className={`${styles.axisValue} ${styles.axisValueBottom}`}>{formatUsd(geometry.min, true)}</span>
          </>
        ) : null}

        {activePoint ? (
          <div className={`${styles.chartTooltip} ${active.x > 50 ? styles.chartTooltipLeft : styles.chartTooltipRight}`} role="status">
            <strong>{formatShortDate(activePoint.date)}</strong>
            <span>{formatUsd(activePoint.totalUsd, isAmountsVisible)}</span>
            {isAmountsVisible && activePoint.inflowUsd >= MIN_VISIBLE_FLOW_USD ? (
              <span className={styles.positive}>Entradas {formatUsd(activePoint.inflowUsd, true, { signed: true })}</span>
            ) : null}
            {isAmountsVisible && activePoint.outflowUsd >= MIN_VISIBLE_FLOW_USD ? (
              <span className={styles.negative}>Salidas {formatUsd(-activePoint.outflowUsd, true, { signed: true })}</span>
            ) : null}
            <span className={styles.statDetail}>Oficial venta {formatAmount(activePoint.rate.toFixed(2), 'ARS')}</span>
          </div>
        ) : null}
      </div>

      <figcaption className={styles.chartAxis}>
        <span>{formatShortDate(first.date)}</span>
        <span className={styles.chartLegend}>
          <span className={`${styles.legendDot} ${styles.legendIn}`} aria-hidden="true" /> Entrada
          <span className={`${styles.legendDot} ${styles.legendOut}`} aria-hidden="true" /> Salida
        </span>
        <span>{formatShortDate(last.date)}</span>
      </figcaption>
    </figure>
  );
}

function buildGeometry(points) {
  const values = points.map((point) => point.totalUsd);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin;
  const padding = spread > 0 ? spread * 0.12 : Math.max(Math.abs(rawMax) * 0.05, 1);
  const min = Math.max(rawMin - padding, rawMin >= 0 ? 0 : rawMin - padding);
  const max = rawMax + padding;
  const lastIndex = Math.max(points.length - 1, 1);

  const coordinates = values.map((value, index) => ({
    x: points.length === 1 ? 50 : (index / lastIndex) * 100,
    y: 100 - ((value - min) / (max - min)) * 100,
  }));

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(3)},${point.y.toFixed(3)}`)
    .join(' ');
  const firstX = coordinates[0]?.x ?? 0;
  const lastX = coordinates[coordinates.length - 1]?.x ?? 100;
  const areaPath = `${linePath} L${lastX.toFixed(3)},100 L${firstX.toFixed(3)},100 Z`;

  return { coordinates, linePath, areaPath, min: rawMin, max: rawMax };
}

function formatUsd(value, isAmountsVisible, { signed = false } = {}) {
  if (!isAmountsVisible) {
    return '-,---.-- USD';
  }

  const rounded = Math.round(value * 100) / 100;
  const sign = signed && rounded > 0 ? '+' : rounded < 0 ? '-' : '';

  return `${sign}${formatAmount(Math.abs(rounded).toFixed(2), 'USD')}`;
}

function formatSigned(value, decimals) {
  const rounded = Number(value.toFixed(decimals));

  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(decimals)}`;
}

function tone(value) {
  if (value >= MIN_VISIBLE_FLOW_USD) {
    return 'positive';
  }

  return value <= -MIN_VISIBLE_FLOW_USD ? 'negative' : null;
}

function formatShortDate(date) {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
