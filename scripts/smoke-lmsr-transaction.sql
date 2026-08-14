begin;

do $smoke$
declare
  selected_market_id uuid;
  selected_option_id uuid;
  selected_user_id uuid;
  smoke_request_id uuid := gen_random_uuid();
  balance_before numeric;
  balance_after_first numeric;
  balance_after_retry numeric;
  first_result record;
  retry_result record;
  matching_orders integer;
  matching_trades integer;
begin
  select m.id, mo.id
  into selected_market_id, selected_option_id
  from public.markets m
  join public.market_options mo on mo.market_id = m.id and mo.is_active
  where m.status = 'open'
    and m.liquidity_b > 0
    and (
      select count(*)
      from public.market_options active_option
      where active_option.market_id = m.id and active_option.is_active
    ) >= 2
  order by m.created_at desc, mo.sort_order
  limit 1;

  if selected_market_id is null then
    raise exception 'No open LMSR market is available for the smoke test';
  end if;

  select w.user_id, w.balance_available
  into selected_user_id, balance_before
  from public.wallets w
  where w.balance_available >= (
    select quote.total
    from public.quote_lmsr_buy(selected_market_id, selected_option_id, 1) quote
  )
  order by w.balance_available desc
  limit 1;

  if selected_user_id is null then
    raise exception 'No funded wallet is available for the smoke test';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', selected_user_id, 'role', 'authenticated')::text,
    true
  );

  select *
  into first_result
  from public.execute_lmsr_buy(selected_market_id, selected_option_id, 1, smoke_request_id);

  select balance_available
  into balance_after_first
  from public.wallets
  where user_id = selected_user_id;

  select *
  into retry_result
  from public.execute_lmsr_buy(selected_market_id, selected_option_id, 1, smoke_request_id);

  select balance_available
  into balance_after_retry
  from public.wallets
  where user_id = selected_user_id;

  select count(*)
  into matching_orders
  from public.limit_orders
  where user_id = selected_user_id and request_id = smoke_request_id;

  select count(*)
  into matching_trades
  from public.trades
  where buy_order_id = first_result.order_id;

  if first_result.order_id is distinct from retry_result.order_id
    or first_result.trade_id is distinct from retry_result.trade_id then
    raise exception 'Idempotent retry returned different records';
  end if;

  if balance_after_first is distinct from balance_after_retry then
    raise exception 'Idempotent retry debited the wallet twice';
  end if;

  if round(balance_before - balance_after_first, 4) <> round(first_result.total, 4) then
    raise exception 'Wallet debit does not match LMSR total';
  end if;

  if matching_orders <> 1 or matching_trades <> 1 then
    raise exception 'Idempotent retry created duplicate financial records';
  end if;
end;
$smoke$;

select 'passed' as transactional_lmsr_smoke_test;

rollback;