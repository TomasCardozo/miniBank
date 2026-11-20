create table daily_limits (
    id uuid primary key,
    account_id uuid not null,
    daily_limit numeric(19,2) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint fk_daily_limits_account foreign key (account_id) references accounts (id),
    constraint uk_daily_limits_account unique (account_id),
    constraint ck_daily_limits_non_negative check (daily_limit >= 0)
);

create index idx_transfers_completed_daily_limit
    on transfers (source_account_id, completed_at)
    where status = 'COMPLETED';
