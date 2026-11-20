export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

export function formatAmount(amount, currency) {
  if (amount === undefined || amount === null || amount === '') {
    return '-';
  }

  const value = formatDecimalAmount(amount, getAmountSeparators());

  return currency ? `${value} ${currency}` : value;
}

export function formatMoneyAmount(amount, currency) {
  const value = formatAmount(amount, currency);

  return value === '-' ? value : `$${value}`;
}

export function getAmountSeparators() {
  const language = getBrowserLanguage();

  if (language.startsWith('es')) {
    return { thousands: '.', decimal: ',' };
  }

  return { thousands: ',', decimal: '.' };
}

function getBrowserLanguage() {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  return (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
}

function formatDecimalAmount(amount, separators) {
  const rawValue = String(amount).trim();
  const match = rawValue.match(/^(-?)(\d+)(?:\.(\d+))?$/);

  if (!match) {
    return rawValue;
  }

  const [, sign, integerPart, decimalPart = ''] = match;
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separators.thousands);
  const cents = decimalPart.padEnd(2, '0').slice(0, 2);

  return `${sign}${groupedInteger}${separators.decimal}${cents}`;
}
