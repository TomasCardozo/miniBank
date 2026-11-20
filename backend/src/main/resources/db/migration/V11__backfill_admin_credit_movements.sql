insert into movements (id, account_id, transfer_id, type, origin, amount, balance_after, description, created_at)
select gen_random_uuid(),
       credited.account_id,
       null,
       'CREDIT',
       'ADMIN_CREDIT',
       credited.new_balance - credited.previous_balance,
       credited.new_balance,
       'Acreditacion administrativa',
       credited.created_at
from (
    select accounts.id as account_id,
           substring(audit_logs.details from 'previousBalance=([0-9]+(?:\.[0-9]+)?)')::numeric(19, 2) as previous_balance,
           substring(audit_logs.details from 'newBalance=([0-9]+(?:\.[0-9]+)?)')::numeric(19, 2) as new_balance,
           audit_logs.created_at
    from audit_logs
    join accounts on accounts.id = audit_logs.entity_id
    where audit_logs.action = 'ACCOUNT_CREDITED'
      and audit_logs.entity_type = 'ACCOUNT'
) credited
where credited.previous_balance is not null
  and credited.new_balance is not null
  and credited.new_balance > credited.previous_balance;
