create table accounts (
    id uuid primary key,
    user_id uuid not null,
    account_number varchar(12) not null,
    alias varchar(100),
    currency varchar(3) not null,
    balance numeric(19,2) not null default 0.00,
    status varchar(20) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint fk_accounts_user foreign key (user_id) references users (id),
    constraint uk_accounts_account_number unique (account_number),
    constraint ck_accounts_account_number_format check (account_number ~ '^[0-9]{12}$'),
    constraint ck_accounts_currency check (currency in ('ARS', 'USD')),
    constraint ck_accounts_status check (status in ('ACTIVE', 'BLOCKED', 'CLOSED')),
    constraint ck_accounts_balance_non_negative check (balance >= 0)
);

create index idx_accounts_user_id on accounts (user_id);
