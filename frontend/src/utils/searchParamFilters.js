export function readFiltersFromSearchParams(searchParams, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => {
      const value = searchParams.get(key);
      return [key, value ? value : defaultValue];
    })
  );
}

export function buildFilteredPath(pathname, filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function toDateTimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}
