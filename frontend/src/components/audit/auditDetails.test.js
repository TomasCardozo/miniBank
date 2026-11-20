import { describe, expect, it } from 'vitest';
import { buildAuditDetailItems, isUuid, parseAuditDetails, shortId } from './auditDetails';
import { getAuditActionBadgeClassName, getAuditActionTone } from './auditLogConfig';

const UUID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('parseAuditDetails', () => {
  it('returns empty for null, undefined and blank strings', () => {
    expect(parseAuditDetails(null)).toEqual({ type: 'empty' });
    expect(parseAuditDetails(undefined)).toEqual({ type: 'empty' });
    expect(parseAuditDetails('')).toEqual({ type: 'empty' });
    expect(parseAuditDetails('   ')).toEqual({ type: 'empty' });
  });

  it('returns free text when the string is not key=value', () => {
    expect(parseAuditDetails('Login successful')).toEqual({ type: 'text', text: 'Login successful' });
    expect(parseAuditDetails('Invalid credentials, user locked')).toEqual({
      type: 'text',
      text: 'Invalid credentials, user locked',
    });
  });

  it('parses comma separated key=value pairs', () => {
    expect(parseAuditDetails(`accountId=${UUID},previousStatus=ACTIVE,newStatus=BLOCKED`)).toEqual({
      type: 'pairs',
      pairs: [
        { key: 'accountId', value: UUID },
        { key: 'previousStatus', value: 'ACTIVE' },
        { key: 'newStatus', value: 'BLOCKED' },
      ],
    });
  });

  it('splits only on the first "=" so values can contain "="', () => {
    expect(parseAuditDetails('reason=a=b,amount=10')).toEqual({
      type: 'pairs',
      pairs: [
        { key: 'reason', value: 'a=b' },
        { key: 'amount', value: '10' },
      ],
    });
  });

  it('keeps commas inside a value when the next segment is not a pair', () => {
    expect(parseAuditDetails('reason=Saldo insuficiente, reintentar,amount=10').pairs).toEqual([
      { key: 'reason', value: 'Saldo insuficiente, reintentar' },
      { key: 'amount', value: '10' },
    ]);
  });
});

describe('buildAuditDetailItems', () => {
  it('groups previousX/newX pairs into a single change', () => {
    const { pairs } = parseAuditDetails(`accountId=${UUID},previousStatus=ACTIVE,newStatus=BLOCKED`);

    expect(buildAuditDetailItems(pairs)).toEqual([
      { key: 'accountId', label: 'cuenta', kind: 'value', value: { text: '3f2b1c4d…', title: UUID } },
      { key: 'status', label: 'estado', kind: 'change', previous: { text: 'ACTIVE' }, next: { text: 'BLOCKED' } },
    ]);
  });

  it('keeps an unpaired previousX as a plain value', () => {
    const items = buildAuditDetailItems([{ key: 'previousStatus', value: 'ACTIVE' }]);

    expect(items).toEqual([{ key: 'previousStatus', label: 'previousStatus', kind: 'value', value: { text: 'ACTIVE' } }]);
  });

  it('formats amounts and folds currency into them', () => {
    const { pairs } = parseAuditDetails(`sourceAccountId=${UUID},targetAccountId=${UUID},amount=500,currency=ARS`);
    const items = buildAuditDetailItems(pairs);

    expect(items.map((item) => item.key)).toEqual(['sourceAccountId', 'targetAccountId', 'amount']);
    expect(items[2].value.text).toMatch(/^500[.,]00 ARS$/);
  });

  it('formats balance changes as amounts', () => {
    const { pairs } = parseAuditDetails('amount=100,previousBalance=50,newBalance=150');
    const [, balance] = buildAuditDetailItems(pairs);

    expect(balance.kind).toBe('change');
    expect(balance.label).toBe('saldo');
    expect(balance.previous.text).toMatch(/^50[.,]00$/);
    expect(balance.next.text).toMatch(/^150[.,]00$/);
  });
});

describe('id helpers', () => {
  it('shortens ids to 8 characters', () => {
    expect(shortId(UUID)).toBe('3f2b1c4d…');
    expect(shortId('abc')).toBe('abc');
    expect(shortId(null)).toBe('-');
  });

  it('detects UUIDs', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid('ACTIVE')).toBe(false);
  });
});

describe('getAuditActionTone', () => {
  it('maps actions to semantic tones', () => {
    expect(getAuditActionTone('ACCOUNT_CREDITED')).toBe('success');
    expect(getAuditActionTone('LOGIN_FAILURE')).toBe('danger');
    expect(getAuditActionTone('USER_BLOCKED')).toBe('warning');
    expect(getAuditActionTone('TRANSFER_CREATED')).toBe('neutral');
    expect(getAuditActionBadgeClassName('TRANSFER_CREATED')).toBe('ds-badge');
    expect(getAuditActionBadgeClassName('TRANSFER_REJECTED')).toBe('ds-badge ds-badge-danger');
  });
});
