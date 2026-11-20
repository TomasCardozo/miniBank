create table transfers (
    id uuid primary key,
    source_account_id uuid not null,
    target_account_id uuid not null,
    amount numeric(19,2) not null,
    currency varchar(3) not null,
    description varchar(255),
    status varchar(20) not null,
    failure_reason varchar(255),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    completed_at timestamp with time zone,
    constraint fk_transfers_source_account foreign key (source_account_id) references accounts (id),
    constraint fk_transfers_target_account foreign key (target_account_id) references accounts (id),
    constraint ck_transfers_amount_positive check (amount > 0),
    constraint ck_transfers_currency check (currency in ('ARS', 'USD')),
    constraint ck_transfers_status check (status in ('PENDING', 'COMPLETED', 'FAILED', 'REJECTED'))
);

create index idx_transfers_source_account_id on transfers (source_account_id);
create index idx_transfers_target_account_id on transfers (target_account_id);
create index idx_transfers_created_at on transfers (created_at);
create index idx_transfers_status on transfers (status);
create index idx_transfers_source_account_created_at on transfers (source_account_id, created_at desc);
create index idx_transfers_target_account_created_at on transfers (target_account_id, created_at desc);
