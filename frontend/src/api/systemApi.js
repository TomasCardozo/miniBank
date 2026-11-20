import { authHeaders, request } from './client';

export function getHealth(accessToken) {
  return request('/actuator/health', {
    headers: authHeaders(accessToken),
  });
}

export function getFlywayInfo(accessToken) {
  return request('/actuator/flyway', {
    headers: authHeaders(accessToken),
  });
}
