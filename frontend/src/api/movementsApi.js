import { authHeaders, pathSegment, request } from './client';

export function getAccountMovements(accessToken, accountId, query) {
  return request(`/accounts/${pathSegment(accountId)}/movements`, {
    headers: authHeaders(accessToken),
    query,
  });
}
