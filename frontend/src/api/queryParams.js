export function cleanQuery(query) {
  if (!query) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, normalizeQueryValue(key, value)])
  );
}

function normalizeQueryValue(key, value) {
  if ((key === 'from' || key === 'to') && typeof value === 'string' && isDateTimeLocalValue(value)) {
    return new Date(value).toISOString();
  }

  return value;
}

function isDateTimeLocalValue(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
}
