create table audit_logs (
    id uuid primary key,
    user_id uuid,
    action varchar(40) not null,
    entity_type varchar(40) not null,
    entity_id uuid,
    details text,
    ip_address varchar(45),
    created_at timestamp with time zone not null,
    constraint fk_audit_logs_user foreign key (user_id) references users (id),
    constraint ck_audit_logs_action check (action in (
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'TRANSFER_CREATED',
        'TRANSFER_COMPLETED',
        'TRANSFER_REJECTED',
        'DAILY_LIMIT_UPDATED',
        'ACCOUNT_BLOCKED',
        'USER_BLOCKED'
    )),
    constraint ck_audit_logs_entity_type check (entity_type in (
        'AUTH',
        'USER',
        'ACCOUNT',
        'TRANSFER',
        'DAILY_LIMIT'
    ))
);

create index idx_audit_logs_user_id on audit_logs (user_id);
create index idx_audit_logs_action on audit_logs (action);
create index idx_audit_logs_entity_type on audit_logs (entity_type);
create index idx_audit_logs_entity_id on audit_logs (entity_id);
create index idx_audit_logs_created_at on audit_logs (created_at desc);
