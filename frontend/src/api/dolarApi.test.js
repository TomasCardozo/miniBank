import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DOLAR_HISTORICO_BASE_URL,
  DOLAR_OFICIAL_URL,
  clearDolarOficialHistoricoCache,
  getDolarOficial,
  getDolarOficialHistorico,
  getDolarOficialPorFecha,
} from './dolarApi';

describe('getDolarOficial', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the official dollar quotation from DolarAPI', async () => {
    const dolarOficial = {
      moneda: 'USD',
      casa: 'oficial',
      nombre: 'Dolar Oficial',
      compra: 1500,
      venta: 1550,
      fechaActualizacion: '2026-07-31T18:55:00.000Z',
    };
    mockFetch(200, dolarOficial);

    await expect(getDolarOficial()).resolves.toEqual(dolarOficial);

    expect(fetch).toHaveBeenCalledWith(DOLAR_OFICIAL_URL, {
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('throws a clear error when DolarAPI returns a non-200 status', async () => {
    mockFetch(500, { message: 'error' });

    await expect(getDolarOficial()).rejects.toThrow('No se pudo consultar DolarAPI: HTTP 500');
  });

  it('throws a clear error when the network request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(getDolarOficial()).rejects.toThrow(
      'No se pudo consultar DolarAPI: error de red'
    );
  });

  it('throws a clear error when the response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      json: () => Promise.reject(new SyntaxError('Invalid JSON')),
    });

    await expect(getDolarOficial()).rejects.toThrow(
      'No se pudo interpretar la respuesta de DolarAPI'
    );
  });
});

describe('getDolarOficialPorFecha', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the quotation of a specific day using the local date path', async () => {
    const cotizacion = { casa: 'oficial', compra: 1465, venta: 1515, fecha: '2026-08-11' };
    mockFetch(200, cotizacion);

    await expect(getDolarOficialPorFecha(new Date(2026, 7, 11))).resolves.toEqual(cotizacion);

    expect(fetch).toHaveBeenCalledWith(`${DOLAR_HISTORICO_BASE_URL}/2026/08/11`, {
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('returns null when that day has no published quotation', async () => {
    mockFetch(404, { message: 'not found' });

    await expect(getDolarOficialPorFecha(new Date(2026, 7, 11))).resolves.toBeNull();
  });

  it('throws a clear error when ArgentinaDatos returns an unexpected status', async () => {
    mockFetch(500, { message: 'error' });

    await expect(getDolarOficialPorFecha(new Date(2026, 7, 11))).rejects.toThrow(
      'No se pudo consultar ArgentinaDatos: HTTP 500'
    );
  });

  it('throws a clear error when the network request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(getDolarOficialPorFecha(new Date(2026, 7, 11))).rejects.toThrow(
      'No se pudo consultar ArgentinaDatos: error de red'
    );
  });

  it('throws a clear error when the response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      json: () => Promise.reject(new SyntaxError('Invalid JSON')),
    });

    await expect(getDolarOficialPorFecha(new Date(2026, 7, 11))).rejects.toThrow(
      'No se pudo interpretar la respuesta de ArgentinaDatos'
    );
  });
});

describe('getDolarOficialHistorico', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearDolarOficialHistoricoCache();
  });

  it('fetches the full official series once and reuses it', async () => {
    const serie = [{ casa: 'oficial', compra: 1465, venta: 1515, fecha: '2026-08-11' }];
    mockFetch(200, serie);

    await expect(getDolarOficialHistorico()).resolves.toEqual(serie);
    await expect(getDolarOficialHistorico()).resolves.toEqual(serie);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(DOLAR_HISTORICO_BASE_URL, {
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('does not cache failures', async () => {
    mockFetch(500, { message: 'error' });

    await expect(getDolarOficialHistorico()).rejects.toThrow('No se pudo consultar ArgentinaDatos: HTTP 500');

    mockFetch(200, []);

    await expect(getDolarOficialHistorico()).resolves.toEqual([]);
  });

  it('rejects a body that is not a list', async () => {
    mockFetch(200, { message: 'unexpected' });

    await expect(getDolarOficialHistorico()).rejects.toThrow('No se pudo interpretar la respuesta de ArgentinaDatos');
  });
});

function mockFetch(status, body) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  });
}
