import { formatDateTime, formatMoneyAmount } from '../../utils/formatters';

export const TRANSFER_STATUS_LABELS = {
  COMPLETED: 'Completada',
  PENDING: 'Pendiente',
  FAILED: 'Fallida',
  REJECTED: 'Rechazada',
};

const FAILURE_STATUSES = ['FAILED', 'REJECTED'];

export function normalizeStatus(status) {
  return String(status || '').toUpperCase();
}

export function getStatusLabel(status) {
  return TRANSFER_STATUS_LABELS[normalizeStatus(status)] || status || '-';
}

export function isFailureStatus(status) {
  return FAILURE_STATUSES.includes(normalizeStatus(status));
}

export function getStatusToneClassName(status) {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 'COMPLETED') {
    return 'ds-badge-success';
  }

  if (isFailureStatus(normalizedStatus)) {
    return 'ds-badge-danger';
  }

  if (normalizedStatus === 'PENDING') {
    return 'ds-badge-warning';
  }

  return '';
}

export function buildReceiptText(transfer) {
  const lines = [
    'Comprobante de transferencia - MiniBank',
    `Monto: ${formatMoneyAmount(transfer.amount, transfer.currency)}`,
    `Origen: ${transfer.sourceAccountNumber}`,
    `Destino: ${transfer.targetAccountNumber}`,
    `Fecha: ${formatDateTime(transfer.createdAt)}`,
    `Estado: ${getStatusLabel(transfer.status)}`,
    `ID: ${transfer.id}`,
  ];

  if (transfer.failureReason) {
    lines.push(`Motivo de fallo: ${transfer.failureReason}`);
  }

  return lines.join('\n');
}
