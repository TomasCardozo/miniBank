alter table movements alter column transfer_id drop not null;

alter table movements add column origin varchar(20) not null default 'TRANSFER';

alter table movements add constraint ck_movements_origin check (origin in ('TRANSFER', 'ADMIN_CREDIT'));

alter table movements add constraint ck_movements_origin_transfer check (
    (origin = 'TRANSFER' and transfer_id is not null)
    or (origin = 'ADMIN_CREDIT' and transfer_id is null and type = 'CREDIT')
);

alter table movements alter column origin drop default;

create index idx_movements_origin on movements (origin);
