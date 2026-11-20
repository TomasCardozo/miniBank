import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';
import AuditDetails from './AuditDetails';
import { shortId } from './auditDetails';
import { getAuditActionBadgeClassName, getAuditActionLabel, getAuditEntityTypeLabel } from './auditLogConfig';

const COPY_FEEDBACK_MS = 2500;

export default function AuditLogsTable({ auditLogs, caption, classNames = {} }) {
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyFeedbackTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(copyFeedbackTimeoutRef.current), []);

  async function handleCopy(key, text, label) {
    clearTimeout(copyFeedbackTimeoutRef.current);

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ key, message: `Copiamos ${label} al portapapeles.` });
    } catch {
      setCopyFeedback({ key: null, message: 'No pudimos copiar al portapapeles. Intentá de nuevo.' });
    }

    copyFeedbackTimeoutRef.current = setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_MS);
  }

  const tableClasses = ['ds-table', classNames.table].filter(Boolean).join(' ');

  return (
    <>
      <table className={tableClasses}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Acción</th>
            <th scope="col">Entidad</th>
            <th scope="col">Usuario</th>
            <th scope="col">Detalle</th>
            <th scope="col">IP</th>
          </tr>
        </thead>
        <tbody>
          {auditLogs.map((auditLog) => (
            <tr key={auditLog.id} title={`ID de log: ${auditLog.id}`} className={classNames.row}>
              <td className={classNames.dateCell} data-label="Fecha">
                <time dateTime={auditLog.createdAt}>{formatDateTime(auditLog.createdAt)}</time>
              </td>
              <td className={classNames.actionCell} data-label="Acción">
                <span className={classNames.actionStack}>
                  <span className={getAuditActionBadgeClassName(auditLog.action)}>{getAuditActionLabel(auditLog.action)}</span>
                  <code className={classNames.actionCode}>{auditLog.action}</code>
                </span>
              </td>
              <td className={classNames.entityCell} data-label="Entidad">
                <span className={classNames.entityStack}>
                  <span className="ds-badge" title={auditLog.entityType}>
                    {getAuditEntityTypeLabel(auditLog.entityType)}
                  </span>
                  <CopyableId
                    id={auditLog.entityId}
                    copyKey={`${auditLog.id}-entity`}
                    label="el ID de entidad"
                    copiedKey={copyFeedback?.key}
                    onCopy={handleCopy}
                    classNames={classNames}
                  />
                </span>
              </td>
              <td className={classNames.userCell} data-label="Usuario">
                <CopyableId
                  id={auditLog.userId}
                  copyKey={`${auditLog.id}-user`}
                  label="el ID de usuario"
                  copiedKey={copyFeedback?.key}
                  onCopy={handleCopy}
                  classNames={classNames}
                />
              </td>
              <td className={classNames.detailsCell} data-label="Detalle">
                <AuditDetails details={auditLog.details} classNames={classNames} />
              </td>
              <td className={classNames.ipCell} data-label="IP">
                {auditLog.ipAddress || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={classNames.visuallyHidden} role="status" aria-live="polite">
        {copyFeedback?.message || ''}
      </p>
    </>
  );
}

function CopyableId({ id, copyKey, label, copiedKey, onCopy, classNames }) {
  if (!id) {
    return <span className={classNames.muted}>-</span>;
  }

  const copied = copiedKey === copyKey;
  const Icon = copied ? Check : Copy;

  return (
    <span className={classNames.copyableId}>
      <code className={classNames.idText} title={id}>
        {shortId(id)}
      </code>
      <button
        type="button"
        className={classNames.copyButton}
        onClick={() => onCopy(copyKey, id, label)}
        aria-label={`Copiar ${label} ${id}`}
        title="Copiar"
      >
        <Icon size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
