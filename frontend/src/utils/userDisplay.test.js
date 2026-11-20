import { describe, expect, it } from 'vitest';
import { getFullName, getInitials, getRoleLabel, getStatusDisplay } from './userDisplay';

describe('userDisplay', () => {
  it('builds initials from the name, the email or a fallback', () => {
    expect(getInitials({ firstName: 'ada', lastName: 'lovelace' })).toBe('AL');
    expect(getInitials({ firstName: 'Ada' })).toBe('A');
    expect(getInitials({ email: 'grace@example.com' })).toBe('GR');
    expect(getInitials({})).toBe('MB');
    expect(getInitials(null)).toBe('MB');
  });

  it('translates statuses and keeps unknown values', () => {
    expect(getStatusDisplay('ACTIVE')).toEqual({ label: 'Activo', badge: 'ds-badge-success', dot: 'statusSuccess' });
    expect(getStatusDisplay('BLOCKED').label).toBe('Bloqueado');
    expect(getStatusDisplay('CLOSED').label).toBe('Cerrado');
    expect(getStatusDisplay('OTHER')).toEqual({ label: 'OTHER', badge: '', dot: '' });
    expect(getStatusDisplay(undefined).label).toBe('-');
  });

  it('translates roles and keeps unknown values', () => {
    expect(getRoleLabel('ADMIN')).toBe('Administrador');
    expect(getRoleLabel('CUSTOMER')).toBe('Cliente');
    expect(getRoleLabel('OTHER')).toBe('OTHER');
    expect(getRoleLabel(null)).toBe('-');
  });

  it('joins first and last name', () => {
    expect(getFullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(getFullName({ lastName: 'Lovelace' })).toBe('Lovelace');
    expect(getFullName(null)).toBe('');
  });
});
