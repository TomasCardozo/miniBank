import { formatAmount } from '../../utils/formatters';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAIR_SEGMENT_REGEX = /^\s*[A-Za-z_][\w.]*\s*=/;

const AMOUNT_KEYS = new Set(['amount', 'balance', 'limit']);

const DETAIL_KEY_LABELS = {
  accountId: 'cuenta',
  userId: 'usuario',
  targetUserId: 'usuario',
  sourceAccountId: 'origen',
  targetAccountId: 'destino',
  amount: 'monto',
  currency: 'moneda',
  reason: 'motivo',
  status: 'estado',
  balance: 'saldo',
  limit: 'límite',
  role: 'rol',
};

export function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function shortId(value, length = 8) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  const text = String(value);

  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function parseAuditDetails(details) {
  if (details === undefined || details === null) {
    return { type: 'empty' };
  }

  const text = String(details).trim();

  if (!text) {
    return { type: 'empty' };
  }

  const segments = text.split(',');

  if (!PAIR_SEGMENT_REGEX.test(segments[0])) {
    return { type: 'text', text };
  }

  const pairs = [];

  for (const segment of segments) {
    if (PAIR_SEGMENT_REGEX.test(segment)) {
      const separatorIndex = segment.indexOf('=');
      pairs.push({ key: segment.slice(0, separatorIndex).trim(), value: segment.slice(separatorIndex + 1).trim() });
    } else {
      pairs[pairs.length - 1].value += `,${segment}`;
    }
  }

  return { type: 'pairs', pairs };
}

export function buildAuditDetailItems(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return [];
  }

  const values = new Map(pairs.map((pair) => [pair.key, pair.value]));
  const currency = values.get('currency');
  const hasAmounts = pairs.some((pair) => AMOUNT_KEYS.has(baseKey(pair.key)));
  const consumed = new Set();
  const items = [];

  for (const { key, value } of pairs) {
    if (consumed.has(key)) {
      continue;
    }

    if (key === 'currency' && hasAmounts) {
      consumed.add(key);
      continue;
    }

    const change = getChangeKeys(key, values);

    if (change) {
      consumed.add(change.previousKey);
      consumed.add(change.nextKey);
      items.push({
        key: change.field,
        label: labelFor(change.field),
        kind: 'change',
        previous: formatValue(change.field, values.get(change.previousKey), currency),
        next: formatValue(change.field, values.get(change.nextKey), currency),
      });
      continue;
    }

    consumed.add(key);
    items.push({
      key,
      label: labelFor(key),
      kind: 'value',
      value: formatValue(key, value, currency),
    });
  }

  return items;
}

function getChangeKeys(key, values) {
  const match = key.match(/^(previous|new)([A-Z]\w*)$/);

  if (!match) {
    return null;
  }

  const suffix = match[2];
  const previousKey = `previous${suffix}`;
  const nextKey = `new${suffix}`;

  if (!values.has(previousKey) || !values.has(nextKey)) {
    return null;
  }

  return { field: lowerFirst(suffix), previousKey, nextKey };
}

function baseKey(key) {
  const match = key.match(/^(?:previous|new)([A-Z]\w*)$/);

  return match ? lowerFirst(match[1]) : key;
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function labelFor(key) {
  return DETAIL_KEY_LABELS[key] || key;
}

function formatValue(key, value, currency) {
  if (value === undefined || value === null || value === '' || value === 'null') {
    return { text: '-' };
  }

  if (isUuid(value)) {
    return { text: shortId(value), title: value };
  }

  if (AMOUNT_KEYS.has(key)) {
    return { text: formatAmount(value, currency) };
  }

  return { text: value };
}
