import { Link } from 'react-router';
import { formatAmount, formatDateTime } from '../../utils/formatters';

export default function TransfersTable({
  transfers,
  caption,
  showId = false,
  detailPathForTransfer,
  tableClassName,
  statusClassName,
  detailLinkClassName,
  renderId,
  renderAccount,
  renderStatus,
  renderFailureReason,
}) {
  const tableClasses = ['ds-table', tableClassName].filter(Boolean).join(' ');

  return (
    <table className={tableClasses}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {showId ? <th scope="col">ID</th> : null}
          <th scope="col">Origen</th>
          <th scope="col">Destino</th>
          <th scope="col">Monto</th>
          <th scope="col">Moneda</th>
          <th scope="col">Estado</th>
          <th scope="col">Descripcion</th>
          <th scope="col">Fecha</th>
          <th scope="col">Fallo</th>
          {detailPathForTransfer ? <th scope="col">Acciones</th> : null}
        </tr>
      </thead>
      <tbody>
        {transfers.map((transfer) => (
          <tr key={transfer.id}>
            {showId ? <td>{renderId ? renderId(transfer) : transfer.id}</td> : null}
            <td>{renderAccount ? renderAccount(transfer, 'source') : transfer.sourceAccountNumber}</td>
            <td>{renderAccount ? renderAccount(transfer, 'target') : transfer.targetAccountNumber}</td>
            <td>{formatAmount(transfer.amount, transfer.currency)}</td>
            <td>{transfer.currency}</td>
            <td>
              {renderStatus ? (
                renderStatus(transfer)
              ) : (
                <span className={getStatusBadgeClassName(transfer.status, statusClassName)}>{transfer.status}</span>
              )}
            </td>
            <td>{transfer.description || '-'}</td>
            <td>{formatDateTime(transfer.createdAt)}</td>
            <td>{renderFailureReason ? renderFailureReason(transfer) : transfer.failureReason || '-'}</td>
            {detailPathForTransfer ? (
              <td>
                <Link to={detailPathForTransfer(transfer)} className={detailLinkClassName}>
                  Detalle
                </Link>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function resolveClassName(className, value) {
  return typeof className === 'function' ? className(value) : className;
}

function getStatusBadgeClassName(status, statusClassName) {
  const toneClassName = getStatusToneClassName(status);
  const customClassName = statusClassName ? resolveClassName(statusClassName, status) : '';

  return ['ds-badge', toneClassName, customClassName].filter(Boolean).join(' ');
}

function getStatusToneClassName(status) {
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus === 'COMPLETED') {
    return 'ds-badge-success';
  }

  if (normalizedStatus === 'REJECTED' || normalizedStatus === 'FAILED' || normalizedStatus === 'CANCELLED') {
    return 'ds-badge-danger';
  }

  if (normalizedStatus === 'PENDING' || normalizedStatus === 'PROCESSING') {
    return 'ds-badge-warning';
  }

  return '';
}
