import { afterEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, pathSegment, request, setUnauthorizedHandler } from './client';

describe('pathSegment', () => {
  it('encodes dynamic path segments consistently', () => {
    expect(pathSegment('abc-123')).toBe('abc-123');
    expect(pathSegment('a b')).toBe('a%20b');
    expect(pathSegment('a/b')).toBe('a%2Fb');
    expect(pathSegment('')).toBe('');
  });
});

describe('request unauthorized handler', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  it('calls the unauthorized handler when an authenticated request returns 401', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(401, { message: 'Unauthorized' });

    await expect(
      request('/accounts', {
        headers: authHeaders('token'),
      })
    ).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call the unauthorized handler when a public request returns 401', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(401, { message: 'Unauthorized' });

    await expect(request('/auth/login')).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not call the unauthorized handler for non-401 errors', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch(403, { message: 'Forbidden' });

    await expect(
      request('/admin/users', {
        headers: authHeaders('token'),
      })
    ).rejects.toMatchObject({ status: 403, message: 'Forbidden' });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('clears the handler with the cleanup returned by setUnauthorizedHandler', async () => {
    const onUnauthorized = vi.fn();
    const cleanup = setUnauthorizedHandler(onUnauthorized);
    cleanup();
    mockFetch(401, { message: 'Unauthorized' });

    await expect(
      request('/accounts', {
        headers: authHeaders('token'),
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('request', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends accept, authorization and JSON body headers', async () => {
    mockFetch(201, { ok: true });

    await request('/accounts', {
      method: 'POST',
      headers: authHeaders('token'),
      body: { currency: 'ARS', alias: 'Principal' },
    });

    expect(fetch).toHaveBeenCalledWith(
      new URL('/accounts', 'http://localhost:8080'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({ currency: 'ARS', alias: 'Principal' }),
      })
    );
  });

  it('does not send content type when there is no body', async () => {
    mockFetch(200, []);

    await request('/accounts', {
      headers: authHeaders('token'),
    });

    expect(fetch).toHaveBeenCalledWith(
      new URL('/accounts', 'http://localhost:8080'),
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer token',
        },
      })
    );
  });

  it('appends cleaned query params to the request URL', async () => {
    mockFetch(200, { content: [] });

    await request('/transfers', {
      query: {
        status: 'COMPLETED',
        accountId: 'account-1',
        from: '2026-07-28T10:30',
        to: '',
        page: 0,
        size: '20',
        sort: 'createdAt,DESC',
      },
    });

    const url = fetch.mock.calls[0][0];

    expect(url.pathname).toBe('/transfers');
    expect(url.searchParams.get('status')).toBe('COMPLETED');
    expect(url.searchParams.get('accountId')).toBe('account-1');
    expect(url.searchParams.get('from')).toBe(new Date('2026-07-28T10:30').toISOString());
    expect(url.searchParams.has('to')).toBe(false);
    expect(url.searchParams.get('page')).toBe('0');
    expect(url.searchParams.get('size')).toBe('20');
    expect(url.searchParams.get('sort')).toBe('createdAt,DESC');
  });

  it('returns null for an empty successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    });

    await expect(request('/health')).resolves.toBeNull();
  });

  it('normalizes backend error details', async () => {
    mockFetch(400, {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      path: '/accounts',
      fieldErrors: { currency: 'required' },
    });

    await expect(request('/accounts')).rejects.toMatchObject({
      status: 400,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      path: '/accounts',
      details: {
        fieldErrors: { currency: 'required' },
      },
    });
  });
});

function mockFetch(status, body) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}
