drop policy if exists limit_orders_insert_own on public.limit_orders;
drop policy if exists limit_orders_update_own_or_admin on public.limit_orders;
drop policy if exists withdrawals_insert_own on public.withdrawal_requests;

revoke insert, update, delete, truncate, references, trigger
on public.limit_orders
from anon, authenticated;

revoke insert, delete, truncate, references, trigger
on public.withdrawal_requests
from anon, authenticated;