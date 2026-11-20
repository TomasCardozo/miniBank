import { authHeaders, pathSegment, request } from './client';

export function getAccountLimits(accessToken, accountId) {
  return request(`/accounts/${pathSegment(accountId)}/limits`, {
    headers: authHeaders(accessToken),
  });
}

export function updateAccountLimits(accessToken, accountId, payload) {
  return request(`/accounts/${pathSegment(accountId)}/limits`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: payload,
  });
}
