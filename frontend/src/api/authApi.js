import { authHeaders, request } from './client';

export function registerUser(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function getCurrentUser(accessToken) {
  return request('/auth/me', {
    headers: authHeaders(accessToken),
  }).then((response) => response.user || response);
}
