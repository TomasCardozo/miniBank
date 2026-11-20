import { cleanQuery } from './queryParams';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;

  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = null;
    }
  };
}

export async function request(path, options = {}) {
  const { method = 'GET', body, query, headers } = options;
  const url = buildUrl(path, query);
  const isAuthenticatedRequest = Boolean(headers?.Authorization);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401 && isAuthenticatedRequest) {
      unauthorizedHandler?.();
    }

    throw normalizeApiError(response, data);
  }

  return data;
}

export function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function pathSegment(value) {
  return encodeURIComponent(value);
}

function buildUrl(path, query) {
  const url = new URL(path, API_BASE_URL);
  const queryParams = cleanQuery(query);

  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  return url;
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeApiError(response, data) {
  const fallbackMessage = `HTTP ${response.status}`;

  return {
    status: response.status,
    message: getErrorMessage(data) || fallbackMessage,
    code: data && typeof data === 'object' ? data.code : undefined,
    path: data && typeof data === 'object' ? data.path : undefined,
    details: data,
  };
}

function getErrorMessage(data) {
  if (!data) {
    return null;
  }

  if (typeof data === 'string') {
    return data;
  }

  return data.message || data.error || null;
}
