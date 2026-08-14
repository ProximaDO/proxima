begin;

do $validation$
begin
  if to_regprocedure('public.quote_lmsr_buy(uuid,uuid,numeric)') is null then
    raise exception 'quote_lmsr_buy is missing';
  end if;

  if to_regprocedure('public.execute_lmsr_buy(uuid,uuid,numeric,uuid)') is null then
    raise exception 'execute_lmsr_buy is missing';
  end if;

  if to_regprocedure('public.resolve_market(uuid,uuid,text)') is null then
    raise exception 'resolve_market is missing';
  end if;

  if to_regprocedure('public.complete_stripe_deposit(text,uuid,numeric)') is null then
    raise exception 'complete_stripe_deposit is missing';
  end if;

  if has_function_privilege('anon', 'public.execute_lmsr_buy(uuid,uuid,numeric,uuid)', 'EXECUTE') then
    raise exception 'anon can execute execute_lmsr_buy';
  end if;

  if not has_function_privilege('authenticated', 'public.execute_lmsr_buy(uuid,uuid,numeric,uuid)', 'EXECUTE') then
    raise exception 'authenticated cannot execute execute_lmsr_buy';
  end if;

  if has_function_privilege('anon', 'public.complete_stripe_deposit(text,uuid,numeric)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.complete_stripe_deposit(text,uuid,numeric)', 'EXECUTE') then
    raise exception 'client role can execute complete_stripe_deposit';
  end if;

  if not has_function_privilege('service_role', 'public.complete_stripe_deposit(text,uuid,numeric)', 'EXECUTE') then
    raise exception 'service_role cannot execute complete_stripe_deposit';
  end if;

  if exists (
    select 1
    from public.limit_orders
    where status in ('open', 'partially_filled')
  ) then
    raise exception 'legacy active orders remain after LMSR migration';
  end if;

  if exists (
    select 1
    from public.market_options
    where lmsr_quantity < 0
  ) then
    raise exception 'negative LMSR quantity found';
  end if;

  if exists (
    select 1
    from public.wallets
    where balance_available < 0 or balance_locked < 0
  ) then
    raise exception 'negative wallet balance found';
  end if;

  if exists (
    select 1
    from (
      select
        mo.market_id,
        sum(exp(mo.lmsr_quantity / m.liquidity_b))
      from public.market_options mo
      join public.markets m on m.id = mo.market_id
      where mo.is_active = true and m.liquidity_b > 0
      group by mo.market_id
      having abs(
        sum(
          exp(mo.lmsr_quantity / m.liquidity_b)
          / nullif((
            select sum(exp(inner_mo.lmsr_quantity / m.liquidity_b))
            from public.market_options inner_mo
            where inner_mo.market_id = mo.market_id and inner_mo.is_active = true
          ), 0)
        ) - 1
      ) > 0.00000001
    ) invalid_probability_sums
  ) then
    raise exception 'LMSR probabilities do not sum to one';
  end if;
end;
$validation$;

select
  (select count(*) from public.markets) as markets,
  (select count(*) from public.market_options where lmsr_quantity > 0) as options_with_contracts,
  (select count(*) from public.limit_orders where pricing_model = 'lmsr') as lmsr_orders,
  (select count(*) from public.trades where pricing_model = 'lmsr') as lmsr_trades,
  (select count(*) from public.market_snapshots where pricing_model = 'lmsr') as lmsr_snapshots;

rollback;