-- Cache Auth lookups once per statement and keep private policies off anon.
alter policy "user can insert own bank accounts" on public.bank_accounts
	to authenticated
	with check ((select auth.uid()) = user_id);

alter policy "user can read own bank accounts" on public.bank_accounts
	to authenticated
	using ((select auth.uid()) = user_id);

alter policy "user can update own bank accounts" on public.bank_accounts
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

alter policy "user can read own kyc" on public.kyc_verifications
	to authenticated
	using ((select auth.uid()) = user_id);

alter policy limit_orders_select_own_or_admin on public.limit_orders
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy notification_events_select_own_or_admin on public.notification_events
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy positions_select_own_or_admin on public.positions
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy profiles_insert_own on public.profiles
	to authenticated
	with check (((select auth.uid()) = id) or (select public.is_admin()));

alter policy profiles_select_own_or_admin on public.profiles
	to authenticated
	using (((select auth.uid()) = id) or (select public.is_admin()));

alter policy profiles_update_own_or_admin on public.profiles
	to authenticated
	using (((select auth.uid()) = id) or (select public.is_admin()))
	with check (((select auth.uid()) = id) or (select public.is_admin()));

alter policy "site settings admin insert" on public.site_settings
	to authenticated
	with check (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

alter policy "site settings admin update" on public.site_settings
	to authenticated
	using (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	))
	with check (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

alter policy "user can read own deposits" on public.stripe_deposits
	to authenticated
	using ((select auth.uid()) = user_id);

alter policy user_roles_select_own_or_admin on public.user_roles
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy wallet_movements_select_own_or_admin on public.wallet_movements
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy wallets_select_own_or_admin on public.wallets
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy withdrawals_select_own_or_admin on public.withdrawal_requests
	to authenticated
	using (((select auth.uid()) = user_id) or (select public.is_admin()));

alter policy withdrawals_update_admin on public.withdrawal_requests
	to authenticated
	using ((select public.is_admin()))
	with check ((select public.is_admin()));

alter policy withdrawal_rules_read_authenticated on public.withdrawal_rules
	to authenticated
	using (true);

alter policy audit_logs_admin_read on public.audit_logs
	to authenticated
	using ((select public.is_admin()));

alter policy audit_logs_admin_write on public.audit_logs
	to authenticated
	with check ((select public.is_admin()));

alter policy "market categories admin select" on public.market_categories
	using (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

alter policy "market categories admin insert" on public.market_categories
	with check (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

alter policy "market categories admin update" on public.market_categories
	using (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	))
	with check (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

alter policy "market categories admin delete" on public.market_categories
	using (exists (
		select 1
		from public.user_roles ur
		where ur.user_id = (select auth.uid())
			and ur.role = 'admin'::public.app_role
	));

-- FOR ALL overlaps with the dedicated SELECT policies. Preserve admin writes
-- as operation-specific policies so each role/action evaluates one policy.
drop policy market_options_admin_manage on public.market_options;
drop policy market_resolutions_admin_manage on public.market_resolutions;
drop policy market_snapshots_admin_manage on public.market_snapshots;
drop policy markets_admin_manage on public.markets;
drop policy notification_events_admin_manage on public.notification_events;
drop policy positions_admin_manage on public.positions;
drop policy trades_admin_manage on public.trades;
drop policy user_roles_admin_manage on public.user_roles;
drop policy wallet_movements_admin_manage on public.wallet_movements;
drop policy wallets_admin_manage on public.wallets;
drop policy withdrawal_rules_admin_manage on public.withdrawal_rules;

do $policy_split$
declare
	target_table text;
begin
	foreach target_table in array array[
		'market_options',
		'market_resolutions',
		'market_snapshots',
		'markets',
		'notification_events',
		'positions',
		'trades',
		'user_roles',
		'wallet_movements',
		'wallets',
		'withdrawal_rules'
	]
	loop
		execute format(
			'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
			target_table || '_admin_insert',
			target_table
		);
		execute format(
			'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
			target_table || '_admin_update',
			target_table
		);
		execute format(
			'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
			target_table || '_admin_delete',
			target_table
		);
	end loop;
end
$policy_split$;

-- PostgreSQL does not create indexes for referencing foreign-key columns.
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index limit_orders_option_id_idx on public.limit_orders (option_id);
create index market_resolutions_resolved_by_idx on public.market_resolutions (resolved_by);
create index market_resolutions_winning_option_id_idx on public.market_resolutions (winning_option_id);
create index markets_created_by_idx on public.markets (created_by);
create index markets_resolution_option_id_idx on public.markets (resolution_option_id);
create index positions_option_id_idx on public.positions (option_id);
create index stripe_deposits_user_id_idx on public.stripe_deposits (user_id);
create index trades_buy_order_id_idx on public.trades (buy_order_id);
create index trades_maker_user_id_idx on public.trades (maker_user_id);
create index trades_option_id_idx on public.trades (option_id);
create index trades_sell_order_id_idx on public.trades (sell_order_id);
create index trades_taker_user_id_idx on public.trades (taker_user_id);
create index wallet_movements_market_id_idx on public.wallet_movements (market_id);
create index wallet_movements_order_id_idx on public.wallet_movements (order_id);
create index wallet_movements_trade_id_idx on public.wallet_movements (trade_id);
create index wallet_movements_wallet_id_idx on public.wallet_movements (wallet_id);
create index wallet_movements_withdrawal_request_id_idx on public.wallet_movements (withdrawal_request_id);
create index withdrawal_requests_bank_account_id_idx on public.withdrawal_requests (bank_account_id);
create index withdrawal_requests_user_id_idx on public.withdrawal_requests (user_id);
