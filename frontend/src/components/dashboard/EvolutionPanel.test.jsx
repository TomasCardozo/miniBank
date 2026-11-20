import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDolarOficialHistorico } from '../../api/dolarApi';
import { getNetWorthHistory } from '../../api/netWorthApi';
import { useAuth } from '../../auth/useAuth';
import EvolutionPanel from './EvolutionPanel';

vi.mock('../../api/netWorthApi', () => ({
  getNetWorthHistory: vi.fn(),
}));

vi.mock('../../api/dolarApi', () => ({
  getDolarOficialHistorico: vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('EvolutionPanel', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows the net worth in USD split into external flows and exchange rate effect', async () => {
    mockData();

    render(<EvolutionPanel />);

    expect(await findStat('Patrimonio actual')).toHaveTextContent('160.00 USD');
    expect(await findStat('Variacion del periodo')).toHaveTextContent('+10.00 USD');
    expect(await findStat('Variacion del periodo')).toHaveTextContent('+6.7%');
    expect(await findStat('Flujo neto con terceros')).toHaveTextContent('+30.00 USD');
    expect(await findStat('Efecto cambiario')).toHaveTextContent('-20.00 USD');
    expect(await findStat('Efecto cambiario')).toHaveTextContent('Oficial venta 1,250.00 ARS');
    expect(screen.getAllByTestId('flow-dot')).toHaveLength(1);
    expect(getNetWorthHistory).toHaveBeenCalledWith('token-123', expect.objectContaining({ from: expect.any(String) }));
    expect(daysInRange(getNetWorthHistory.mock.calls[0][1])).toBe(90);
  });

  it('hides amounts when the dashboard hides numbers', async () => {
    mockData();

    render(<EvolutionPanel isAmountsVisible={false} />);

    expect(await findStat('Patrimonio actual')).toHaveTextContent('-,---.-- USD');
    expect(screen.queryByText('160.00 USD')).not.toBeInTheDocument();
  });

  it('reloads the history when the period changes', async () => {
    mockData();

    render(<EvolutionPanel />);
    await findStat('Patrimonio actual');

    await userEvent.click(screen.getByRole('button', { name: 'Ultimos 30 dias' }));

    expect(screen.getByRole('button', { name: 'Ultimos 30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(getNetWorthHistory).toHaveBeenCalledTimes(2);
    expect(daysInRange(getNetWorthHistory.mock.calls[1][1])).toBe(30);
  });

  it('walks the chart days with the keyboard', async () => {
    mockData();

    render(<EvolutionPanel />);
    const chart = await screen.findByRole('img', { name: /Patrimonio en USD/ });

    chart.focus();
    await userEvent.keyboard('{ArrowRight}');

    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('160.00 USD');
    expect(tooltip).toHaveTextContent('Entradas +40.00 USD');
    expect(tooltip).toHaveTextContent('Salidas -10.00 USD');
  });

  it('shows API errors', async () => {
    useAuth.mockReturnValue({ accessToken: 'token-123' });
    getNetWorthHistory.mockRejectedValue(new Error('Backend caido'));
    getDolarOficialHistorico.mockResolvedValue(QUOTES);

    render(<EvolutionPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend caido');
  });

  it('shows an error when the exchange rate series is empty', async () => {
    useAuth.mockReturnValue({ accessToken: 'token-123' });
    getNetWorthHistory.mockResolvedValue(HISTORY);
    getDolarOficialHistorico.mockResolvedValue([]);

    render(<EvolutionPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay cotizacion del dolar oficial');
  });
});

const QUOTES = [
  { casa: 'oficial', compra: 950, venta: 1000, fecha: '2026-10-01' },
  { casa: 'oficial', compra: 1200, venta: 1250, fecha: '2026-10-03' },
];

const HISTORY = {
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

function mockData() {
  useAuth.mockReturnValue({ accessToken: 'token-123' });
  getNetWorthHistory.mockResolvedValue(HISTORY);
  getDolarOficialHistorico.mockResolvedValue(QUOTES);
}

async function findStat(label) {
  const term = await screen.findByText(label);

  return within(term.parentElement).getAllByRole('definition').reduce((text, node) => {
    text.textContent += ` ${node.textContent}`;
    return text;
  }, document.createElement('span'));
}

function daysInRange({ from, to }) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  return Math.round((end - start) / 86400000) + 1;
}
