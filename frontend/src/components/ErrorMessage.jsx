export default function ErrorMessage({ error }) {
  if (!error) {
    return null;
  }

  return (
    <section className="ds-error" role="alert">
      <h2 className="mb-2">Error</h2>
      <p>{error.message || 'Ocurrio un error inesperado.'}</p>
      {error.status ? <p>Status HTTP: {error.status}</p> : null}
      {error.code ? <p>Codigo: {error.code}</p> : null}
      {error.path ? <p>Path: {error.path}</p> : null}
      <ErrorDetails details={error.details} />
    </section>
  );
}

function ErrorDetails({ details }) {
  if (!details || typeof details !== 'object') {
    return null;
  }

  const entries = Object.entries(details).filter(([key]) => !['message', 'error', 'code', 'path'].includes(key));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <p>Detalle:</p>
      <ul>
        {entries.map(([key, value]) => (
          <li key={key}>
            {key}: {formatDetail(value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDetail(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
