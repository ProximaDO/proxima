begin;

do $smoke$
declare
  selected_user_id uuid;
  selected_wallet_id uuid;
  checkout_session_id text := 'cs_test_' || gen_random_uuid()::text;
  deposit_amount numeric := 10.00;
  balance_before numeric;
  balance_after_first numeric;
  balance_after_retry numeric;
  matching_movements integer;
  deposit_status text;
begin
  select w.user_id, w.id, w.balance_available
  into selected_user_id, selected_wallet_id, balance_before
  from public.wallets w
  order by w.created_at
  limit 1;

  if selected_user_id is null then
    raise exception 'No wallet is available for the Stripe smoke test';
  end if;

  insert into public.stripe_deposits (
    user_id,
    stripe_checkout_session_id,
    amount_dop,
    status
  ) values (
    selected_user_id,
    checkout_session_id,
    deposit_amount,
    'pending'
  );

  balance_after_first := public.complete_stripe_deposit(
    checkout_session_id,
    selected_user_id,
    deposit_amount
  );

  balance_after_retry := public.complete_stripe_deposit(
    checkout_session_id,
    selected_user_id,
    deposit_amount
  );

  select count(*)
  into matching_movements
  from public.wallet_movements movement
  where movement.wallet_id = selected_wallet_id
    and movement.metadata ->> 'checkout_session_id' = checkout_session_id;

  select status
  into deposit_status
  from public.stripe_deposits
  where stripe_checkout_session_id = checkout_session_id;

  if balance_after_first <> balance_before + deposit_amount then
    raise exception 'Stripe deposit did not credit the expected amount';
  end if;

  if balance_after_retry <> balance_after_first then
    raise exception 'Stripe retry credited the wallet twice';
  end if;

  if matching_movements <> 1 then
    raise exception 'Stripe retry created duplicate wallet movements';
  end if;

  if deposit_status <> 'completed' then
    raise exception 'Stripe deposit was not completed';
  end if;
end;
$smoke$;

select 'passed' as atomic_stripe_deposit_smoke_test;

rollback;