import { describe, expect, it } from 'vitest';
import { cleanQuery } from './queryParams';

describe('cleanQuery', () => {
  it('removes empty query values', () => {
    expect(
      cleanQuery({
        status: 'COMPLETED',
        empty: '',
        nil: null,
        missing: undefined,
      })
    ).toEqual({
      status: 'COMPLETED',
    });
  });

  it('preserves non-date query params', () => {
    const accountId = '2f7c7a60-723e-4ec8-bc92-4b1e4a73d929';

    expect(
      cleanQuery({
        status: 'COMPLETED',
        type: 'DEBIT',
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        accountId,
        page: 0,
        size: '20',
        sort: 'createdAt,DESC',
      })
    ).toEqual({
      status: 'COMPLETED',
      type: 'DEBIT',
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      accountId,
      page: 0,
      size: '20',
      sort: 'createdAt,DESC',
    });
  });

  it('serializes datetime-local from and to filters as ISO instants', () => {
    expect(
      cleanQuery({
        from: '2026-07-28T10:30',
        to: '2026-07-28T10:30:45',
      })
    ).toEqual({
      from: new Date('2026-07-28T10:30').toISOString(),
      to: new Date('2026-07-28T10:30:45').toISOString(),
    });
  });

  it('leaves already serialized ISO instants unchanged', () => {
    expect(
      cleanQuery({
        from: '2026-07-28T13:30:00.000Z',
        to: '2026-07-28T14:30:00.000Z',
      })
    ).toEqual({
      from: '2026-07-28T13:30:00.000Z',
      to: '2026-07-28T14:30:00.000Z',
    });
  });

  it('leaves incomplete or invalid date strings unchanged', () => {
    expect(
      cleanQuery({
        from: '2026-07-28',
        to: 'not-a-date',
      })
    ).toEqual({
      from: '2026-07-28',
      to: 'not-a-date',
    });
  });
});
