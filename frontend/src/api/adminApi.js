import { authHeaders, pathSegment, request } from './client';

export function getAdminUsers(accessToken, query) {
  return request('/admin/users', {
    headers: authHeaders(accessToken),
    query,
  });
}

export function getAdminUser(accessToken, id) {
  return request(`/admin/users/${pathSegment(id)}`, {
    headers: authHeaders(accessToken),
  });
}

export function blockAdminUser(accessToken, id) {
  return request(`/admin/users/${pathSegment(id)}/block`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
  });
}

export function activateAdminUser(accessToken, id) {
  return request(`/admin/users/${pathSegment(id)}/activate`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
  });
}

export function getAdminAccounts(accessToken, query) {
  return request('/admin/accounts', {
    headers: authHeaders(accessToken),
    query,
  });
}

export function blockAdminAccount(accessToken, id) {
  return request(`/admin/accounts/${pathSegment(id)}/block`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
  });
}

export function activateAdminAccount(accessToken, id) {
  return request(`/admin/accounts/${pathSegment(id)}/activate`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
  });
}

export function creditAdminAccount(accessToken, id, body) {
  return request(`/admin/accounts/${pathSegment(id)}/balance/credit`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body,
  });
}

export function getAdminTransfers(accessToken, query) {
  return request('/admin/transfers', {
    headers: authHeaders(accessToken),
    query,
  });
}

export function getAdminAuditLogs(accessToken, query) {
  return request('/admin/audit-logs', {
    headers: authHeaders(accessToken),
    query,
  });
}
