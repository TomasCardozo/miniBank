import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Braces, Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { getFlywayInfo, getHealth } from '../api/systemApi';
import { useAuth } from '../auth/useAuth';
import { formatDateTime } from '../utils/formatters';
import styles from './SystemPage.module.css';

const HEALTH_PATH = '/actuator/health';
const COPY_FEEDBACK_MS = 2000;

const COMPONENT_LABELS = {
  db: 'Base de datos',
  diskSpace: 'Espacio en disco',
  ping: 'Ping',
  ssl: 'Certificados SSL',
  livenessState: 'Liveness',
  readinessState: 'Readiness',
};

const STATUS_DISPLAY = {
  UP: { label: 'Operativo', tone: 'ok' },
  DOWN: { label: 'Caído', tone: 'down' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', tone: 'down' },
  UNKNOWN: { label: 'Desconocido', tone: 'warn' },
};

export default function SystemPage() {
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'ADMIN';
  const accessToken = auth.accessToken;
  const [check, setCheck] = useState({ status: 'idle', health: null, error: null, latencyMs: null, checkedAt: null });
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  const swaggerUrl = new URL('/swagger-ui.html', API_BASE_URL).toString();
  const openApiUrl = new URL('/v3/api-docs', API_BASE_URL).toString();
  const healthUrl = new URL(HEALTH_PATH, API_BASE_URL).toString();

  const runCheck = useCallback(async () => {
    setCheck((current) => ({ ...current, status: 'loading' }));
    const startedAt = performance.now();

    try {
      const health = await getHealth(isAdmin ? accessToken : undefined);
      setCheck({
        status: 'done',
        health,
        error: null,
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date(),
      });
    } catch (error) {
      setCheck({ status: 'done', health: null, error, latencyMs: null, checkedAt: new Date() });
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  async function copyBaseUrl() {
    try {
      await navigator.clipboard.writeText(API_BASE_URL);
      setCopied(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  const loading = check.status === 'loading';
  const status = getStatusDisplay(check);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeading}>
          <h1 className="h1">Sistema</h1>
          <p className={styles.metadata}>Estado técnico del backend y documentación de la API</p>
        </div>
        <button className={`ds-button ds-button-secondary ${styles.refreshButton}`} type="button" onClick={runCheck} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? styles.spinning : undefined} />
          {loading ? 'Verificando…' : 'Verificar de nuevo'}
        </button>
      </header>

      <section className={`${styles.hero} ${styles[status.tone]}`} aria-label="Estado del backend" aria-busy={loading}>
        <div className={styles.heroMain}>
          <span className={styles.heroLabel}>Backend</span>
          <p className={styles.heroStatus} role="status">
            <span className={styles.statusDot} aria-hidden="true" />
            {status.label}
            {check.health?.status ? <span className={styles.statusCode}>{check.health.status}</span> : null}
          </p>
          <p className={styles.heroUrl}>{API_BASE_URL}</p>
        </div>
        <dl className={styles.heroStats}>
          <div>
            <dt>Latencia</dt>
            <dd>{check.latencyMs !== null ? `${check.latencyMs} ms` : '—'}</dd>
          </div>
          <div>
            <dt>Última verificación</dt>
            <dd>{check.checkedAt ? check.checkedAt.toLocaleTimeString('es-AR') : '—'}</dd>
          </div>
        </dl>
      </section>

      {check.error ? (
        <p className={styles.errorNote} role="alert">
          No se pudo contactar al backend{check.error.status ? ` (HTTP ${check.error.status})` : ''}. Revisá que esté levantado en{' '}
          <span className={styles.mono}>{API_BASE_URL}</span>.
        </p>
      ) : null}

      {isAdmin ? (
        <div className={styles.grid}>
          <ComponentsPanel health={check.health} loading={loading} failed={Boolean(check.error)} />
          <SchemaPanel accessToken={accessToken} refreshKey={check.checkedAt?.getTime()} />
        </div>
      ) : (
        <p className={styles.adminNote}>
          El detalle por componente (base de datos, disco) y la versión del esquema están disponibles para administradores.
        </p>
      )}

      <div className={styles.grid}>
        <section className={`ds-panel ${styles.panel}`} aria-labelledby="system-connection-title">
          <h2 id="system-connection-title" className={styles.panelTitle}>
            Conexión
          </h2>
          <dl className={styles.infoList}>
            <div className={styles.infoRow}>
              <dt>URL base</dt>
              <dd>
                <span className={styles.mono}>{API_BASE_URL}</span>
                <button
                  type="button"
                  className="ds-icon-button"
                  onClick={copyBaseUrl}
                  aria-label="Copiar URL base"
                  title="Copiar URL base"
                >
                  {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                </button>
              </dd>
            </div>
            <div className={styles.infoRow}>
              <dt>Healthcheck</dt>
              <dd>
                <a className={styles.mono} href={healthUrl} target="_blank" rel="noreferrer">
                  {HEALTH_PATH}
                </a>
              </dd>
            </div>
            <div className={styles.infoRow}>
              <dt>Entorno frontend</dt>
              <dd>{import.meta.env.MODE}</dd>
            </div>
          </dl>
          <p className={styles.copyStatus} role="status">
            {copied ? 'URL base copiada' : ''}
          </p>
        </section>

        <section className={`ds-panel ${styles.panel}`} aria-labelledby="system-docs-title">
          <h2 id="system-docs-title" className={styles.panelTitle}>
            Documentación técnica
          </h2>
          <div className={styles.docsList}>
            <DocLink href={swaggerUrl} icon={<BookOpen size={18} aria-hidden="true" />} title="Swagger UI" description="Explorar y probar los endpoints" />
            <DocLink href={openApiUrl} icon={<Braces size={18} aria-hidden="true" />} title="OpenAPI JSON" description="Especificación de la API" />
          </div>
        </section>
      </div>

      {check.health ? (
        <details className={`ds-panel ${styles.rawPanel}`}>
          <summary>Respuesta del healthcheck (JSON)</summary>
          <pre className={styles.raw}>{JSON.stringify(check.health, null, 2)}</pre>
        </details>
      ) : null}
    </main>
  );
}

function ComponentsPanel({ health, loading, failed }) {
  const components = Object.entries(health?.components ?? {});

  return (
    <section className={`ds-panel ${styles.panel}`} aria-labelledby="system-components-title" aria-busy={loading}>
      <h2 id="system-components-title" className={styles.panelTitle}>
        Componentes
      </h2>
      {components.length === 0 ? (
        <p className={styles.panelEmpty}>
          {failed ? 'Sin datos: el backend no respondió.' : loading ? 'Verificando…' : 'El backend no informó componentes.'}
        </p>
      ) : (
        <ul className={styles.componentList}>
          {components.map(([name, component]) => {
            const display = STATUS_DISPLAY[component.status] || STATUS_DISPLAY.UNKNOWN;

            return (
              <li key={name} className={styles.componentItem}>
                <span className={styles.componentName}>{COMPONENT_LABELS[name] || name}</span>
                <span className={styles.componentDetail}>{describeComponent(name, component)}</span>
                <span className={`ds-badge ${styles.componentBadge} ${styles[`badge_${display.tone}`]}`}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  {display.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function describeComponent(name, component) {
  const details = component.details ?? {};

  if (name === 'db') {
    return details.database || '';
  }

  if (name === 'diskSpace' && details.free !== undefined && details.total !== undefined) {
    return `${formatBytes(details.free)} libres de ${formatBytes(details.total)}`;
  }

  return '';
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toLocaleString('es-AR', { maximumFractionDigits: unit >= 3 ? 1 : 0 })} ${units[unit]}`;
}

function SchemaPanel({ accessToken, refreshKey }) {
  const [state, setState] = useState({ loading: true, migrations: [], error: null });

  useEffect(() => {
    if (!refreshKey) {
      return undefined;
    }

    let ignore = false;

    setState((current) => ({ ...current, loading: true, error: null }));
    getFlywayInfo(accessToken)
      .then((response) => {
        if (!ignore) {
          setState({ loading: false, migrations: extractMigrations(response), error: null });
        }
      })
      .catch((error) => {
        if (!ignore) {
          setState({ loading: false, migrations: [], error });
        }
      });

    return () => {
      ignore = true;
    };
  }, [accessToken, refreshKey]);

  const applied = state.migrations.filter((migration) => migration.state === 'SUCCESS');
  const versioned = applied.filter((migration) => migration.version);
  const current = versioned[versioned.length - 1];
  const lastApplied = [...applied].sort((a, b) => String(a.installedOn).localeCompare(String(b.installedOn))).at(-1);
  const pending = state.migrations.filter((migration) => migration.state === 'PENDING').length;
  const failed = state.migrations.filter((migration) => migration.state === 'FAILED').length;

  return (
    <section className={`ds-panel ${styles.panel}`} aria-labelledby="system-schema-title" aria-busy={state.loading}>
      <h2 id="system-schema-title" className={styles.panelTitle}>
        Esquema de base de datos
      </h2>

      {state.error ? (
        <p className={styles.panelEmpty} role="alert">
          No se pudo leer el estado de las migraciones{state.error.status ? ` (HTTP ${state.error.status})` : ''}.
        </p>
      ) : state.loading && state.migrations.length === 0 ? (
        <p className={styles.panelEmpty}>Cargando migraciones…</p>
      ) : (
        <>
          <dl className={styles.schemaStats}>
            <div>
              <dt>Versión actual</dt>
              <dd>{current ? `V${current.version}` : '—'}</dd>
            </div>
            <div>
              <dt>Aplicadas</dt>
              <dd>{applied.length}</dd>
            </div>
            <div>
              <dt>Pendientes</dt>
              <dd className={pending > 0 ? styles.warnText : undefined}>{pending}</dd>
            </div>
            <div>
              <dt>Fallidas</dt>
              <dd className={failed > 0 ? styles.dangerText : undefined}>{failed}</dd>
            </div>
          </dl>
          {current ? <p className={styles.schemaCurrent}>{current.description}</p> : null}
          {lastApplied ? (
            <p className={styles.schemaMeta}>Última migración aplicada el {formatDateTime(lastApplied.installedOn)}</p>
          ) : null}
          <details className={styles.migrationsDetails}>
            <summary>Ver las {state.migrations.length} migraciones</summary>
            <ol className={styles.migrationList}>
              {state.migrations.map((migration) => (
                <li key={`${migration.version ?? 'R'}-${migration.script}`}>
                  <span className={styles.mono}>{migration.version ? `V${migration.version}` : 'R'}</span>
                  <span>{migration.description}</span>
                  <span className={migration.state === 'SUCCESS' ? styles.mutedText : styles.warnText}>
                    {migration.state === 'SUCCESS' ? 'aplicada' : migration.state.toLowerCase()}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}

function extractMigrations(response) {
  const contexts = Object.values(response?.contexts ?? {});
  const beans = contexts.flatMap((context) => Object.values(context.flywayBeans ?? {}));

  return beans.flatMap((bean) => bean.migrations ?? []);
}

function DocLink({ href, icon, title, description }) {
  return (
    <a className={styles.docLink} href={href} target="_blank" rel="noreferrer">
      <span className={styles.docIcon}>{icon}</span>
      <span className={styles.docText}>
        <span className={styles.docTitle}>{title}</span>
        <span className={styles.docDescription}>{description}</span>
      </span>
      <ExternalLink size={15} className={styles.docExternal} aria-hidden="true" />
    </a>
  );
}

function getStatusDisplay(check) {
  if (check.status !== 'done') {
    return { label: 'Verificando…', tone: 'pending' };
  }

  if (check.error) {
    return { label: 'No disponible', tone: 'down' };
  }

  return STATUS_DISPLAY[check.health?.status] || STATUS_DISPLAY.UNKNOWN;
}
