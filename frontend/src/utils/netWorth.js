export function buildRateLookup(quotes) {
  const sorted = (Array.isArray(quotes) ? quotes : [])
    .filter((quote) => typeof quote?.fecha === 'string' && Number(quote.venta) > 0)
    .map((quote) => ({ date: quote.fecha, rate: Number(quote.venta) }))
    .sort((a, b) => compareDates(a.date, b.date));

  return (date) => {
    if (sorted.length === 0) {
      return null;
    }

    let low = 0;
    let high = sorted.length - 1;
    let found = -1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);

      if (compareDates(sorted[middle].date, date) <= 0) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return sorted[found === -1 ? 0 : found].rate;
  };
}

export function buildUsdNetWorth(history, rateFor) {
  const arsSeries = findSeries(history, 'ARS');
  const usdSeries = findSeries(history, 'USD');
  const usdByDate = new Map((usdSeries?.points ?? []).map((point) => [point.date, point]));
  const dates = (arsSeries?.points ?? usdSeries?.points ?? []).map((point) => point.date);
  const arsByDate = new Map((arsSeries?.points ?? []).map((point) => [point.date, point]));

  const openingRate = rateFor(previousDate(history.from));

  if (!openingRate) {
    throw new Error('No hay cotizacion del dolar oficial para convertir el patrimonio');
  }

  const startUsd = toNumber(usdSeries?.openingBalance) + toNumber(arsSeries?.openingBalance) / openingRate;

  const points = dates.map((date) => {
    const rate = rateFor(date);
    const ars = arsByDate.get(date);
    const usd = usdByDate.get(date);
    const arsBalance = toNumber(ars?.closingBalance);
    const usdBalance = toNumber(usd?.closingBalance);
    const inflowUsd = toNumber(usd?.externalInflow) + toNumber(ars?.externalInflow) / rate;
    const outflowUsd = toNumber(usd?.externalOutflow) + toNumber(ars?.externalOutflow) / rate;

    return {
      date,
      rate,
      arsBalance,
      usdBalance,
      totalUsd: usdBalance + arsBalance / rate,
      inflowUsd,
      outflowUsd,
      netFlowUsd: inflowUsd - outflowUsd,
    };
  });

  const endUsd = points.length > 0 ? points[points.length - 1].totalUsd : startUsd;
  const netFlowUsd = points.reduce((total, point) => total + point.netFlowUsd, 0);
  const changeUsd = endUsd - startUsd;

  return {
    points,
    summary: {
      startUsd,
      endUsd,
      changeUsd,
      changePercent: startUsd > 0 ? (changeUsd / startUsd) * 100 : null,
      netFlowUsd,
      fxEffectUsd: changeUsd - netFlowUsd,
      lastRate: points.length > 0 ? points[points.length - 1].rate : openingRate,
    },
  };
}

export function rangeEndingToday(days, today = new Date()) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  return { from: formatLocalDate(from), to: formatLocalDate(to) };
}

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function previousDate(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  const previous = new Date(year, month - 1, day);
  previous.setDate(previous.getDate() - 1);

  return formatLocalDate(previous);
}

function findSeries(history, currency) {
  return (history?.series ?? []).find((series) => series.currency === currency);
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function compareDates(a, b) {
  if (a < b) {
    return -1;
  }

  return a > b ? 1 : 0;
}
