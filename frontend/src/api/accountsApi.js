import { authHeaders, pathSegment, request } from './client';

export function createAccount(accessToken, payload) {
  return request('/accounts', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: payload,
  });
}

export function getAccounts(accessToken) {
  return request('/accounts', {
    headers: authHeaders(accessToken),
  });
}

export function getAccount(accessToken, id) {
  return request(`/accounts/${pathSegment(id)}`, {
    headers: authHeaders(accessToken),
  });
}

export function getAccountBalance(accessToken, id) {
  return request(`/accounts/${pathSegment(id)}/balance`, {
    headers: authHeaders(accessToken),
  });
}

export function updateAccountAlias(accessToken, id, payload) {
  return request(`/accounts/${pathSegment(id)}/alias`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: payload,
  });
}
