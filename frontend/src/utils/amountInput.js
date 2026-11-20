export function buildRawAmountFromDigits(digits) {
  if (!digits) {
    return '';
  }

  const cents = BigInt(digits);

  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export function formatAmountInput(amount) {
  if (!amount) {
    return '';
  }

  const [integerPart, decimalPart = ''] = String(amount).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${groupedInteger}.${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}
