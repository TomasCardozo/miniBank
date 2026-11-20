import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoneyAmount, getAmountSeparators } from './formatters';

describe('formatAmount', () => {
  it('formats thousands and decimals for English browsers', () => {
    mockNavigatorLanguage('en-US');

    expect(formatAmount(1500.5, 'ARS')).toBe('1,500.50 ARS');
    expect(formatAmount('1234567.89')).toBe('1,234,567.89');
  });

  it('formats thousands and decimals for Spanish browsers', () => {
    mockNavigatorLanguage('es-AR');

    expect(formatAmount(1500.5, 'ARS')).toBe('1.500,50 ARS');
    expect(formatAmount('1234567.89')).toBe('1.234.567,89');
  });

  it('uses English separators as fallback for unsupported languages', () => {
    mockNavigatorLanguage('pt-BR');

    expect(formatAmount(1500.5, 'ARS')).toBe('1,500.50 ARS');
    expect(getAmountSeparators()).toEqual({ thousands: ',', decimal: '.' });
  });

  it('keeps empty values as a dash', () => {
    mockNavigatorLanguage('en-US');

    expect(formatAmount(null, 'USD')).toBe('-');
    expect(formatAmount(undefined, 'USD')).toBe('-');
    expect(formatAmount('', 'USD')).toBe('-');
  });

  it('keeps invalid amounts readable', () => {
    mockNavigatorLanguage('es-AR');

    expect(formatAmount('not-a-number', 'USD')).toBe('not-a-number USD');
  });

  it('formats money amounts with a leading symbol', () => {
    mockNavigatorLanguage('en-US');

    expect(formatMoneyAmount(1500.5, 'ARS')).toBe('$1,500.50 ARS');
  });
});

function mockNavigatorLanguage(language) {
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    value: [language],
  });

  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: language,
  });
}
