import { authHeaders, pathSegment, request } from './client';

export function createTransfer(accessToken, payload) {
  return request('/transfers', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: payload,
  });
}

export function getTransfers(accessToken, query) {
  return request('/transfers', {
    headers: authHeaders(accessToken),
    query,
  });
}

export function getTransfer(accessToken, id) {
  return request(`/transfers/${pathSegment(id)}`, {
    headers: authHeaders(accessToken),
  });
}
