create or replace function public.get_public_trader_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
	select count(distinct user_id)::bigint
	from public.limit_orders;
$$;

revoke all on function public.get_public_trader_count() from public, anon, authenticated;
grant execute on function public.get_public_trader_count() to anon, authenticated;
