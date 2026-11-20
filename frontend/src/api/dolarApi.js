export const DOLAR_OFICIAL_URL = 'https://dolarapi.com/v1/dolares/oficial';
export const DOLAR_HISTORICO_BASE_URL =
  'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';

export async function getDolarOficial() {
  let response;

  try {
    response = await fetch(DOLAR_OFICIAL_URL, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error('No se pudo consultar DolarAPI: error de red');
  }

  if (response.status !== 200) {
    throw new Error(`No se pudo consultar DolarAPI: HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('No se pudo interpretar la respuesta de DolarAPI');
  }
}

export async function getDolarOficialPorFecha(date) {
  const url = `${DOLAR_HISTORICO_BASE_URL}/${formatDatePath(date)}`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error('No se pudo consultar ArgentinaDatos: error de red');
  }

  if (response.status === 404) {
    return null;
  }

  if (response.status !== 200) {
    throw new Error(`No se pudo consultar ArgentinaDatos: HTTP ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('No se pudo interpretar la respuesta de ArgentinaDatos');
  }
}

let historicoCache = null;

export function getDolarOficialHistorico() {
  if (!historicoCache) {
    historicoCache = fetchDolarOficialHistorico().catch((error) => {
      historicoCache = null;
      throw error;
    });
  }

  return historicoCache;
}

export function clearDolarOficialHistoricoCache() {
  historicoCache = null;
}

async function fetchDolarOficialHistorico() {
  let response;

  try {
    response = await fetch(DOLAR_HISTORICO_BASE_URL, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error('No se pudo consultar ArgentinaDatos: error de red');
  }

  if (response.status !== 200) {
    throw new Error(`No se pudo consultar ArgentinaDatos: HTTP ${response.status}`);
  }

  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error('No se pudo interpretar la respuesta de ArgentinaDatos');
  }

  if (!Array.isArray(body)) {
    throw new Error('No se pudo interpretar la respuesta de ArgentinaDatos');
  }

  return body;
}

function formatDatePath(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}/${month}/${day}`;
}
