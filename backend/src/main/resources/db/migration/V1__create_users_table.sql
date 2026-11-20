create table users (
    id uuid primary key,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    email varchar(255) not null,
    document_number varchar(50) not null,
    password_hash varchar(255) not null,
    role varchar(20) not null,
    status varchar(20) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_users_email unique (email),
    constraint uk_users_document_number unique (document_number),
    constraint ck_users_role check (role in ('CUSTOMER', 'ADMIN')),
    constraint ck_users_status check (status in ('ACTIVE', 'BLOCKED', 'CLOSED'))
);
