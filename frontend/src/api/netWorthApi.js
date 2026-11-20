import { authHeaders, request } from './client';

export function getNetWorthHistory(accessToken, query) {
  return request('/me/net-worth/history', {
    headers: authHeaders(accessToken),
    query,
  });
}
