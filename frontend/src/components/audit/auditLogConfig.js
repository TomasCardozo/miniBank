export const AUDIT_LOG_DEFAULT_FILTERS = {
  userId: '',
  action: '',
  entityType: '',
  entityId: '',
  from: '',
  to: '',
  size: '20',
  sort: 'createdAt,DESC',
};

export const AUDIT_LOG_FILTER_KEYS = ['userId', 'action', 'entityType', 'entityId', 'from', 'to'];

export const AUDIT_LOG_PAGE_SIZES = ['10', '20', '50', '100'];

export const AUDIT_LOG_SORT_OPTIONS = [
  { value: 'createdAt,DESC', label: 'Más recientes primero' },
  { value: 'createdAt,ASC', label: 'Más antiguos primero' },
  { value: 'action,ASC', label: 'Acción (A-Z)' },
  { value: 'action,DESC', label: 'Acción (Z-A)' },
  { value: 'entityType,ASC', label: 'Tipo de entidad (A-Z)' },
  { value: 'entityType,DESC', label: 'Tipo de entidad (Z-A)' },
];

export const UUID_INPUT_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const AUDIT_ACTION_LABELS = {
  LOGIN_SUCCESS: 'Inicio de sesión',
  LOGIN_FAILURE: 'Inicio de sesión fallido',
  TRANSFER_CREATED: 'Transferencia creada',
  TRANSFER_COMPLETED: 'Transferencia completada',
  TRANSFER_REJECTED: 'Transferencia rechazada',
  DAILY_LIMIT_UPDATED: 'Límite diario actualizado',
  ACCOUNT_BLOCKED: 'Cuenta bloqueada',
  ACCOUNT_ACTIVATED: 'Cuenta activada',
  ACCOUNT_CREDITED: 'Cuenta acreditada',
  USER_BLOCKED: 'Usuario bloqueado',
  USER_ACTIVATED: 'Usuario activado',
};

export const AUDIT_ENTITY_TYPE_LABELS = {
  AUTH: 'Autenticación',
  USER: 'Usuario',
  ACCOUNT: 'Cuenta',
  TRANSFER: 'Transferencia',
  DAILY_LIMIT: 'Límite diario',
};

const AUDIT_ACTION_TONES = {
  LOGIN_SUCCESS: 'success',
  TRANSFER_COMPLETED: 'success',
  ACCOUNT_ACTIVATED: 'success',
  USER_ACTIVATED: 'success',
  ACCOUNT_CREDITED: 'success',
  LOGIN_FAILURE: 'danger',
  TRANSFER_REJECTED: 'danger',
  ACCOUNT_BLOCKED: 'warning',
  USER_BLOCKED: 'warning',
};

export function getAuditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action || '-';
}

export function getAuditEntityTypeLabel(entityType) {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] || entityType || '-';
}

export function getAuditActionTone(action) {
  return AUDIT_ACTION_TONES[String(action || '').toUpperCase()] || 'neutral';
}

export function getAuditActionBadgeClassName(action) {
  const tone = getAuditActionTone(action);

  return tone === 'neutral' ? 'ds-badge' : `ds-badge ds-badge-${tone}`;
}
