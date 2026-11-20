alter table audit_logs drop constraint ck_audit_logs_action;

alter table audit_logs add constraint ck_audit_logs_action check (action in (
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'TRANSFER_CREATED',
    'TRANSFER_COMPLETED',
    'TRANSFER_REJECTED',
    'DAILY_LIMIT_UPDATED',
    'ACCOUNT_BLOCKED',
    'ACCOUNT_ACTIVATED',
    'USER_BLOCKED',
    'USER_ACTIVATED',
    'ACCOUNT_CREDITED'
));
