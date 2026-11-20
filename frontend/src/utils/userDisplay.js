export const STATUSES = {
  ACTIVE: { label: 'Activo', badge: 'ds-badge-success', dot: 'statusSuccess' },
  BLOCKED: { label: 'Bloqueado', badge: 'ds-badge-danger', dot: 'statusDanger' },
  CLOSED: { label: 'Cerrado', badge: 'ds-badge-danger', dot: 'statusDanger' },
};

export const ROLES = {
  ADMIN: 'Administrador',
  CUSTOMER: 'Cliente',
};

export function getStatusDisplay(status) {
  return STATUSES[status] || { label: status || '-', badge: '', dot: '' };
}

export function getRoleLabel(role) {
  return ROLES[role] || role || '-';
}

export function getFullName(user) {
  if (!user) {
    return '';
  }

  return `${user.firstName || ''} ${user.lastName || ''}`.trim();
}

export function getInitials(user) {
  if (user?.firstName || user?.lastName) {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
  }

  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return 'MB';
}
