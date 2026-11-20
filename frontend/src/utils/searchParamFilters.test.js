import { describe, expect, it } from 'vitest';
import { buildFilteredPath, readFiltersFromSearchParams, toDateTimeLocalValue } from './searchParamFilters';

const DEFAULTS = { status: '', role: '', size: '20', sort: 'createdAt,DESC' };

describe('readFiltersFromSearchParams', () => {
  it('reads known keys and keeps defaults for missing or empty params', () => {
    const params = new URLSearchParams('status=BLOCKED&size=&unknown=x');

    expect(readFiltersFromSearchParams(params, DEFAULTS)).toEqual({
      status: 'BLOCKED',
      role: '',
      size: '20',
      sort: 'createdAt,DESC',
    });
  });

  it('returns the defaults when there are no params', () => {
    expect(readFiltersFromSearchParams(new URLSearchParams(), DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe('buildFilteredPath', () => {
  it('adds non-empty filters as query params', () => {
    expect(buildFilteredPath('/admin/transfers', { status: 'REJECTED', from: '2026-11-18T10:00', to: '' })).toBe(
      '/admin/transfers?status=REJECTED&from=2026-11-18T10%3A00'
    );
  });

  it('returns the bare path without filters', () => {
    expect(buildFilteredPath('/admin/users', { status: '' })).toBe('/admin/users');
  });
});

describe('toDateTimeLocalValue', () => {
  it('formats local date and time with padding', () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 5, 7, 3))).toBe('2026-01-05T07:03');
  });
});
