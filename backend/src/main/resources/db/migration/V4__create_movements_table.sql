create table movements (
    id uuid primary key,
    account_id uuid not null,
    transfer_id uuid not null,
    type varchar(20) not null,
    amount numeric(19,2) not null,
    balance_after numeric(19,2) not null,
    description varchar(255),
    created_at timestamp with time zone not null,
    constraint fk_movements_account foreign key (account_id) references accounts (id),
    constraint fk_movements_transfer foreign key (transfer_id) references transfers (id),
    constraint uk_movements_transfer_type unique (transfer_id, type),
    constraint ck_movements_type check (type in ('DEBIT', 'CREDIT')),
    constraint ck_movements_amount_positive check (amount > 0),
    constraint ck_movements_balance_after_non_negative check (balance_after >= 0)
);

create index idx_movements_account_id on movements (account_id);
create index idx_movements_transfer_id on movements (transfer_id);
create index idx_movements_created_at on movements (created_at);
create index idx_movements_type on movements (type);
create index idx_movements_account_created_at on movements (account_id, created_at desc);
