import { describe, expect, it } from 'vitest';
import { buildRateLookup, buildUsdNetWorth, rangeEndingToday } from './netWorth';

const QUOTES = [
  { casa: 'oficial', compra: 1200, venta: 1250, fecha: '2026-10-03' },
  { casa: 'oficial', compra: 950, venta: 1000, fecha: '2026-10-01' },
  { casa: 'oficial', compra: 0, venta: 0, fecha: '2026-10-02' },
];

describe('buildRateLookup', () => {
  const rateFor = buildRateLookup(QUOTES);

  it('uses the venta quotation of the same day', () => {
    expect(rateFor('2026-10-01')).toBe(1000);
    expect(rateFor('2026-10-03')).toBe(1250);
  });

  it('falls back to the last published quotation for days without one', () => {
    expect(rateFor('2026-10-02')).toBe(1000);
    expect(rateFor('2026-10-10')).toBe(1250);
  });

  it('uses the first quotation for dates before the series starts', () => {
    expect(rateFor('2020-01-01')).toBe(1000);
  });

  it('returns null without quotations', () => {
    expect(buildRateLookup([])('2026-10-01')).toBeNull();
  });
});

describe('buildUsdNetWorth', () => {
  const history = {
    from: '2026-10-02',
    to: '2026-10-03',
    timezone: 'America/Argentina/Buenos_Aires',
    series: [
      {
        currency: 'ARS',
        openingBalance: 100000,
        points: [
          { date: '2026-10-02', closingBalance: 100000, externalInflow: 0, externalOutflow: 0 },
          { date: '2026-10-03', closingBalance: 150000, externalInflow: 50000, externalOutflow: 0 },
        ],
      },
      {
        currency: 'USD',
        openingBalance: 50,
        points: [
          { date: '2026-10-02', closingBalance: 50, externalInflow: 0, externalOutflow: 0 },
          { date: '2026-10-03', closingBalance: 40, externalInflow: 0, externalOutflow: 10 },
        ],
      },
    ],
  };

  it('converts every day to USD with that day quotation', () => {
    const { points } = buildUsdNetWorth(history, buildRateLookup(QUOTES));

    expect(points.map((point) => point.totalUsd)).toEqual([150, 160]);
    expect(points[1]).toMatchObject({ rate: 1250, inflowUsd: 40, outflowUsd: 10, netFlowUsd: 30 });
  });

  it('splits the period change into external flows and exchange rate effect', () => {
    const { summary } = buildUsdNetWorth(history, buildRateLookup(QUOTES));

    expect(summary.startUsd).toBe(150);
    expect(summary.endUsd).toBe(160);
    expect(summary.changeUsd).toBe(10);
    expect(summary.netFlowUsd).toBe(30);
    expect(summary.fxEffectUsd).toBe(-20);
    expect(summary.changePercent).toBeCloseTo(6.667, 2);
    expect(summary.lastRate).toBe(1250);
  });

  it('fails clearly when there are no quotations', () => {
    expect(() => buildUsdNetWorth(history, buildRateLookup([]))).toThrow('No hay cotizacion');
  });
});

describe('rangeEndingToday', () => {
  it('builds an inclusive range of local dates', () => {
    expect(rangeEndingToday(30, new Date(2026, 10, 18, 23, 30))).toEqual({ from: '2026-10-20', to: '2026-11-18' });
  });
});
