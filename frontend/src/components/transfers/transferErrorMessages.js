export const TRANSFER_ERROR_MESSAGES = {
  TRANSFER_INVALID_TARGET: 'No encontramos una cuenta disponible con ese número. Verificá que sea correcto y que use la misma moneda que tu cuenta origen.',
  TRANSFER_SAME_ACCOUNT: 'La cuenta origen y la cuenta destino son la misma. Seleccioná una cuenta distinta para continuar.',
  TRANSFER_SOURCE_INACTIVE: 'Tu cuenta origen no está activa en este momento. Probá con otra de tus cuentas o escribinos para revisarlo.',
  TRANSFER_INVALID_AMOUNT: 'El monto a transferir tiene que ser mayor a cero.',
  TRANSFER_INSUFFICIENT_FUNDS: 'El saldo de tu cuenta origen no alcanza para este monto. Probá con un importe menor.',
  DAILY_LIMIT_EXCEEDED: 'Este monto supera el límite diario de transferencias de tu cuenta. Probá con un importe menor o esperá al día siguiente.',
  VALIDATION_ERROR: 'Hay un campo incompleto o con un formato que no podemos procesar. Corregilo e intentá de nuevo.',
  NOT_FOUND: 'Una de las cuentas de la operación ya no está disponible. Verificá los datos e intentá de nuevo.',
  UNAUTHORIZED: 'Tu sesión expiró. Volvé a iniciar sesión para poder completar la transferencia.',
  FORBIDDEN: 'Tu usuario no tiene permisos sobre alguna de las cuentas involucradas.',
  CONFLICT: 'Los datos cambiaron mientras confirmabas la operación. Revisalos y volvé a intentar.',
  BUSINESS_RULE_VIOLATION: 'La operación no cumple con alguna de las reglas de la cuenta. Revisá los datos e intentá de nuevo.',
  INTERNAL_ERROR: 'Tuvimos un problema de nuestro lado. Intentá nuevamente en unos minutos.',
};

export const TRANSFER_GENERIC_ERROR = 'Ocurrió un problema al procesar la transferencia. Intentá nuevamente en unos minutos.';

export function resolveTransferError(error) {
  return TRANSFER_ERROR_MESSAGES[error?.code] || TRANSFER_GENERIC_ERROR;
}
