-- Pure LMSR buy-only execution. Existing order-book rows remain as immutable
-- history; active orders are cancelled and buyer collateral is released.

alter table public.market_options
	add column if not exists lmsr_quantity numeric(20,6) not null default 0;

alter table public.market_options
	drop constraint if exists market_options_lmsr_quantity_check;

alter table public.market_options
	add constraint market_options_lmsr_quantity_check check (lmsr_quantity >= 0);

alter table public.limit_orders
	add column if not exists request_id uuid,
	add column if not exists lmsr_cost numeric(20,6),
	add column if not exists fee_amount numeric(20,6) not null default 0,
	add column if not exists pricing_model text not null default 'legacy_orderbook';

alter table public.limit_orders
	drop constraint if exists limit_orders_fee_amount_check,
	drop constraint if exists limit_orders_pricing_model_check;

alter table public.limit_orders
	add constraint limit_orders_fee_amount_check check (fee_amount >= 0),
	add constraint limit_orders_pricing_model_check
		check (pricing_model in ('legacy_orderbook', 'lmsr'));

create unique index if not exists limit_orders_user_request_id_key
	on public.limit_orders (user_id, request_id)
	where request_id is not null;

alter table public.trades
	add column if not exists lmsr_cost numeric(20,6),
	add column if not exists fee_amount numeric(20,6) not null default 0,
	add column if not exists pricing_model text not null default 'legacy_orderbook';

alter table public.trades
	drop constraint if exists trades_fee_amount_check,
	drop constraint if exists trades_pricing_model_check;

alter table public.trades
	add constraint trades_fee_amount_check check (fee_amount >= 0),
	add constraint trades_pricing_model_check
		check (pricing_model in ('legacy_orderbook', 'lmsr'));

alter table public.market_snapshots
	add column if not exists liquidity numeric(20,6) not null default 0,
	add column if not exists pricing_model text not null default 'legacy_orderbook';

alter table public.market_snapshots
	drop constraint if exists market_snapshots_liquidity_check,
	drop constraint if exists market_snapshots_pricing_model_check;

alter table public.market_snapshots
	add constraint market_snapshots_liquidity_check check (liquidity >= 0),
	add constraint market_snapshots_pricing_model_check
		check (pricing_model in ('legacy_orderbook', 'lmsr'));

-- The migration boundary treats current positive holdings as the initial LMSR
-- outstanding-share vector. This preserves every user's existing contracts.
update public.market_options mo
set lmsr_quantity = coalesce((
	select sum(greatest(p.quantity, 0))
	from public.positions p
	where p.market_id = mo.market_id
		and p.option_id = mo.id
), 0);

do $migration$
declare
	v_order record;
	v_wallet record;
	v_refund numeric(20,4);
	v_new_balance numeric(20,4);
begin
	for v_order in
		select lo.*
		from public.limit_orders lo
		where lo.status in ('open', 'partially_filled')
		order by lo.created_at, lo.id
		for update
	loop
		if v_order.side = 'buy' then
			v_refund := round(
				greatest(0, v_order.quantity - v_order.quantity_filled) * v_order.limit_price,
				4
			);

			if v_refund > 0 then
				select w.*
				into v_wallet
				from public.wallets w
				where w.user_id = v_order.user_id
				for update;

				if v_wallet.id is null then
					raise exception 'Wallet missing while releasing legacy order %', v_order.id;
				end if;

				v_new_balance := v_wallet.balance_available + v_refund;

				update public.wallets
				set balance_available = v_new_balance,
						balance_locked = greatest(0, balance_locked - v_refund),
						updated_at = now()
				where id = v_wallet.id;

				insert into public.wallet_movements (
					user_id,
					wallet_id,
					movement_type,
					amount,
					balance_after,
					market_id,
					order_id,
					metadata
				) values (
					v_order.user_id,
					v_wallet.id,
					'reversal',
					v_refund,
					v_new_balance,
					v_order.market_id,
					v_order.id,
					jsonb_build_object('reason', 'lmsr_migration_order_release')
				);
			end if;
		end if;

		update public.limit_orders
		set status = 'cancelled', updated_at = now()
		where id = v_order.id;
	end loop;
end;
$migration$;

create or replace function public.quote_lmsr_buy(
	p_market_id uuid,
	p_option_id uuid,
	p_quantity numeric
)
returns table (
	quantity numeric,
	probability_before numeric,
	probability_after numeric,
	cost numeric,
	fee numeric,
	total numeric,
	average_price numeric,
	liquidity_before numeric,
	liquidity_after numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
	v_b numeric;
	v_fee_bps integer;
	v_status public.market_status;
	v_option_count integer;
	v_current_max numeric;
	v_new_max numeric;
	v_current_sum numeric;
	v_new_sum numeric;
	v_current_cost numeric;
	v_new_cost numeric;
	v_selected_q numeric;
	v_raw_cost numeric;
	v_cost numeric(20,6);
	v_fee numeric(20,6);
	v_initial_cost numeric;
begin
	if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
		raise exception 'Cantidad invalida';
	end if;

	if trunc(p_quantity) <> p_quantity then
		raise exception 'La cantidad de contratos debe ser entera';
	end if;

	select m.liquidity_b, m.fee_bps, m.status
	into v_b, v_fee_bps, v_status
	from public.markets m
	where m.id = p_market_id;

	if v_b is null then
		raise exception 'Mercado no encontrado';
	end if;

	if v_b <= 0 then
		raise exception 'Parametro de liquidez invalido';
	end if;

	if v_status <> 'open' then
		raise exception 'Este mercado no acepta predicciones';
	end if;

	select count(*), max(mo.lmsr_quantity / v_b)
	into v_option_count, v_current_max
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	if v_option_count < 2 then
		raise exception 'El mercado necesita al menos dos opciones activas';
	end if;

	select mo.lmsr_quantity
	into v_selected_q
	from public.market_options mo
	where mo.id = p_option_id
		and mo.market_id = p_market_id
		and mo.is_active = true;

	if v_selected_q is null then
		raise exception 'Opcion invalida para este mercado';
	end if;

	select sum(exp((mo.lmsr_quantity / v_b) - v_current_max))
	into v_current_sum
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	select max((mo.lmsr_quantity + case when mo.id = p_option_id then p_quantity else 0 end) / v_b)
	into v_new_max
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	select sum(exp(
		((mo.lmsr_quantity + case when mo.id = p_option_id then p_quantity else 0 end) / v_b)
		- v_new_max
	))
	into v_new_sum
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	v_current_cost := v_b * (v_current_max + ln(v_current_sum));
	v_new_cost := v_b * (v_new_max + ln(v_new_sum));
	v_initial_cost := v_b * ln(v_option_count::numeric);
	v_raw_cost := v_new_cost - v_current_cost;
	v_cost := ceil(v_raw_cost * 10000) / 10000;
	v_fee := round(v_cost * v_fee_bps / 10000.0, 4);

	return query select
		p_quantity,
		round(exp((v_selected_q / v_b) - v_current_max) / v_current_sum, 10),
		round(exp(((v_selected_q + p_quantity) / v_b) - v_new_max) / v_new_sum, 10),
		v_cost,
		v_fee,
		v_cost + v_fee,
		round(v_cost / p_quantity, 10),
		round(greatest(0, v_current_cost - v_initial_cost), 6),
		round(greatest(0, v_new_cost - v_initial_cost), 6);
end;
$function$;

create or replace function public.resolve_market(
	p_market_id uuid,
	p_winning_option_id uuid,
	p_resolution_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
	v_actor_user_id uuid;
	v_is_service_role boolean;
	v_market public.markets%rowtype;
	v_order record;
	v_position record;
	v_wallet public.wallets%rowtype;
	v_refund numeric(20,4);
	v_payout numeric(20,4);
	v_new_balance numeric(20,4);
begin
	select m.*
	into v_market
	from public.markets m
	where m.id = p_market_id
	for update;

	if v_market.id is null then
		raise exception 'Mercado no encontrado';
	end if;

	v_actor_user_id := auth.uid();
	v_is_service_role := coalesce(auth.jwt() ->> 'role', '') = 'service_role';

	if v_is_service_role then
		v_actor_user_id := v_market.created_by;
	elsif v_actor_user_id is null or not public.is_admin(v_actor_user_id) then
		raise exception 'Solo administradores pueden resolver mercados';
	end if;

	if v_market.status = 'resolved' then
		if v_market.resolution_option_id = p_winning_option_id then
			return true;
		end if;

		raise exception 'El mercado ya fue resuelto con otra opcion';
	end if;

	if v_market.status <> 'closed' then
		raise exception 'Solo se pueden resolver mercados cerrados';
	end if;

	if not exists (
		select 1
		from public.market_options mo
		where mo.id = p_winning_option_id
			and mo.market_id = p_market_id
			and mo.is_active = true
	) then
		raise exception 'Opcion ganadora invalida para este mercado';
	end if;

	if exists (
		select 1
		from public.market_resolutions mr
		where mr.market_id = p_market_id
	) then
		raise exception 'El mercado ya tiene una resolucion inconsistente';
	end if;

	for v_order in
		select lo.*
		from public.limit_orders lo
		where lo.market_id = p_market_id
			and lo.status in ('open', 'partially_filled')
		order by lo.user_id, lo.created_at, lo.id
		for update
	loop
		if v_order.side = 'buy' then
			v_refund := round(
				greatest(0, v_order.quantity - v_order.quantity_filled) * v_order.limit_price,
				4
			);

			if v_refund > 0 then
				select w.*
				into v_wallet
				from public.wallets w
				where w.user_id = v_order.user_id
				for update;

				if v_wallet.id is null then
					raise exception 'Wallet no encontrada para usuario %', v_order.user_id;
				end if;

				v_new_balance := v_wallet.balance_available + v_refund;

				update public.wallets
				set balance_available = v_new_balance,
						balance_locked = greatest(0, balance_locked - v_refund),
						updated_at = now()
				where id = v_wallet.id;

				insert into public.wallet_movements (
					user_id,
					wallet_id,
					movement_type,
					amount,
					balance_after,
					market_id,
					order_id,
					metadata
				) values (
					v_order.user_id,
					v_wallet.id,
					'reversal',
					v_refund,
					v_new_balance,
					p_market_id,
					v_order.id,
					jsonb_build_object('reason', 'market_resolution_unlock')
				);
			end if;
		end if;

		update public.limit_orders
		set status = 'cancelled', updated_at = now()
		where id = v_order.id;
	end loop;

	for v_position in
		select p.*
		from public.positions p
		where p.market_id = p_market_id
			and p.quantity > 0
		order by p.user_id, p.id
		for update
	loop
		if v_position.option_id = p_winning_option_id then
			v_payout := round(v_position.quantity, 4);

			if v_payout > 0 then
				select w.*
				into v_wallet
				from public.wallets w
				where w.user_id = v_position.user_id
				for update;

				if v_wallet.id is null then
					raise exception 'Wallet no encontrada para usuario %', v_position.user_id;
				end if;

				v_new_balance := v_wallet.balance_available + v_payout;

				update public.wallets
				set balance_available = v_new_balance,
						updated_at = now()
				where id = v_wallet.id;

				insert into public.wallet_movements (
					user_id,
					wallet_id,
					movement_type,
					amount,
					balance_after,
					market_id,
					metadata
				) values (
					v_position.user_id,
					v_wallet.id,
					'payout',
					v_payout,
					v_new_balance,
					p_market_id,
					jsonb_build_object(
						'reason', 'market_resolution_payout',
						'pricing_model', 'lmsr',
						'option_id', p_winning_option_id,
						'position_id', v_position.id
					)
				);
			end if;
		end if;

		update public.positions
		set quantity = 0,
				avg_entry_price = 0,
				updated_at = now()
		where id = v_position.id;
	end loop;

	insert into public.market_resolutions (
		market_id,
		winning_option_id,
		resolved_by,
		resolution_note
	) values (
		p_market_id,
		p_winning_option_id,
		v_actor_user_id,
		p_resolution_note
	);

	update public.markets
	set status = 'resolved',
			resolution_option_id = p_winning_option_id,
			resolved_at = now(),
			updated_at = now()
	where id = p_market_id;

	insert into public.audit_logs (
		actor_user_id,
		action,
		entity_type,
		entity_id,
		metadata
	) values (
		v_actor_user_id,
		'market_resolved',
		'market',
		p_market_id,
		jsonb_build_object(
			'winning_option_id', p_winning_option_id,
			'resolution_note', p_resolution_note,
			'pricing_model', 'lmsr',
			'automated', v_is_service_role
		)
	);

	return true;
end;
$function$;

create or replace function public.execute_lmsr_buy(
	p_market_id uuid,
	p_option_id uuid,
	p_quantity numeric,
	p_request_id uuid
)
returns table (
	order_id uuid,
	trade_id uuid,
	cost numeric,
	fee numeric,
	total numeric,
	probability_after numeric,
	liquidity_after numeric
)
language plpgsql
security definer
set search_path = public
as $function$
declare
	v_user_id uuid;
	v_existing_order public.limit_orders%rowtype;
	v_market public.markets%rowtype;
	v_option public.market_options%rowtype;
	v_wallet public.wallets%rowtype;
	v_quote record;
	v_order_id uuid;
	v_trade_id uuid;
	v_new_balance numeric(20,4);
	v_probability_map jsonb;
	v_probability_max numeric;
	v_probability_sum numeric;
begin
	v_user_id := auth.uid();

	if v_user_id is null then
		raise exception 'Debes iniciar sesion para predecir';
	end if;

	if p_request_id is null then
		raise exception 'Identificador de solicitud requerido';
	end if;

	select lo.*
	into v_existing_order
	from public.limit_orders lo
	where lo.user_id = v_user_id
		and lo.request_id = p_request_id;

	if v_existing_order.id is not null then
		select t.id
		into v_trade_id
		from public.trades t
		where t.buy_order_id = v_existing_order.id
		order by t.created_at
		limit 1;

		return query select
			v_existing_order.id,
			v_trade_id,
			coalesce(v_existing_order.lmsr_cost, v_existing_order.total_cost),
			v_existing_order.fee_amount,
			v_existing_order.total_cost,
			null::numeric,
			null::numeric;
		return;
	end if;

	select m.*
	into v_market
	from public.markets m
	where m.id = p_market_id
	for update;

	if v_market.id is null then
		raise exception 'Mercado no encontrado';
	end if;

	if v_market.status <> 'open' then
		raise exception 'Este mercado no acepta predicciones';
	end if;

	-- A concurrent retry may have completed while this transaction waited for
	-- the market lock. Re-check under the serialization boundary.
	select lo.*
	into v_existing_order
	from public.limit_orders lo
	where lo.user_id = v_user_id
		and lo.request_id = p_request_id;

	if v_existing_order.id is not null then
		select t.id
		into v_trade_id
		from public.trades t
		where t.buy_order_id = v_existing_order.id
		order by t.created_at
		limit 1;

		return query select
			v_existing_order.id,
			v_trade_id,
			coalesce(v_existing_order.lmsr_cost, v_existing_order.total_cost),
			v_existing_order.fee_amount,
			v_existing_order.total_cost,
			null::numeric,
			null::numeric;
		return;
	end if;

	select mo.*
	into v_option
	from public.market_options mo
	where mo.id = p_option_id
		and mo.market_id = p_market_id
		and mo.is_active = true
	for update;

	if v_option.id is null then
		raise exception 'Opcion invalida para este mercado';
	end if;

	select *
	into v_quote
	from public.quote_lmsr_buy(p_market_id, p_option_id, p_quantity);

	select w.*
	into v_wallet
	from public.wallets w
	where w.user_id = v_user_id
	for update;

	if v_wallet.id is null then
		raise exception 'No se encontro tu wallet';
	end if;

	if v_wallet.balance_available < v_quote.total then
		raise exception 'Balance insuficiente para esta prediccion';
	end if;

	v_new_balance := v_wallet.balance_available - v_quote.total;

	update public.wallets
	set balance_available = v_new_balance,
			updated_at = now()
	where id = v_wallet.id;

	insert into public.limit_orders (
		market_id,
		option_id,
		user_id,
		side,
		status,
		limit_price,
		quantity,
		quantity_filled,
		total_cost,
		request_id,
		lmsr_cost,
		fee_amount,
		pricing_model
	) values (
		p_market_id,
		p_option_id,
		v_user_id,
		'buy',
		'filled',
		v_quote.average_price,
		p_quantity,
		p_quantity,
		v_quote.total,
		p_request_id,
		v_quote.cost,
		v_quote.fee,
		'lmsr'
	)
	returning id into v_order_id;

	update public.market_options
	set lmsr_quantity = lmsr_quantity + p_quantity
	where id = p_option_id;

	insert into public.positions (
		user_id,
		market_id,
		option_id,
		quantity,
		avg_entry_price,
		realized_pnl
	) values (
		v_user_id,
		p_market_id,
		p_option_id,
		p_quantity,
		v_quote.average_price,
		0
	)
	on conflict (market_id, option_id, user_id)
	do update set
		avg_entry_price = (
			(public.positions.quantity * public.positions.avg_entry_price)
			+ (excluded.quantity * excluded.avg_entry_price)
		) / (public.positions.quantity + excluded.quantity),
		quantity = public.positions.quantity + excluded.quantity,
		updated_at = now();

	insert into public.trades (
		market_id,
		option_id,
		buy_order_id,
		taker_user_id,
		side,
		price,
		quantity,
		lmsr_cost,
		fee_amount,
		pricing_model
	) values (
		p_market_id,
		p_option_id,
		v_order_id,
		v_user_id,
		'buy',
		v_quote.average_price,
		p_quantity,
		v_quote.cost,
		v_quote.fee,
		'lmsr'
	)
	returning id into v_trade_id;

	insert into public.wallet_movements (
		user_id,
		wallet_id,
		movement_type,
		amount,
		balance_after,
		market_id,
		order_id,
		trade_id,
		metadata
	) values (
		v_user_id,
		v_wallet.id,
		'participation',
		-v_quote.total,
		v_new_balance,
		p_market_id,
		v_order_id,
		v_trade_id,
		jsonb_build_object(
			'pricing_model', 'lmsr',
			'lmsr_cost', v_quote.cost,
			'fee_amount', v_quote.fee,
			'quantity', p_quantity,
			'option_id', p_option_id
		)
	);

	select max(mo.lmsr_quantity / v_market.liquidity_b)
	into v_probability_max
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	select sum(exp((mo.lmsr_quantity / v_market.liquidity_b) - v_probability_max))
	into v_probability_sum
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	select jsonb_object_agg(
		mo.id::text,
		round(exp((mo.lmsr_quantity / v_market.liquidity_b) - v_probability_max) / v_probability_sum, 10)
	)
	into v_probability_map
	from public.market_options mo
	where mo.market_id = p_market_id
		and mo.is_active = true;

	insert into public.market_snapshots (
		market_id,
		total_volume,
		total_trades,
		option_probabilities,
		option_volumes,
		liquidity,
		pricing_model
	)
	values (
		p_market_id,
		(
			select coalesce(sum(coalesce(tr.lmsr_cost, tr.notional)), 0)
			from public.trades tr
			where tr.market_id = p_market_id
		),
		(
			select count(*)
			from public.trades tr
			where tr.market_id = p_market_id
		),
		v_probability_map,
		coalesce((
			select jsonb_object_agg(option_totals.option_id::text, option_totals.volume)
			from (
				select tr.option_id, sum(tr.quantity) as volume
				from public.trades tr
				where tr.market_id = p_market_id
				group by tr.option_id
			) option_totals
		), '{}'::jsonb),
		v_quote.liquidity_after,
		'lmsr'
	);

	return query select
		v_order_id,
		v_trade_id,
		v_quote.cost,
		v_quote.fee,
		v_quote.total,
		v_quote.probability_after,
		v_quote.liquidity_after;
end;
$function$;

revoke all on function public.quote_lmsr_buy(uuid, uuid, numeric) from public;
grant execute on function public.quote_lmsr_buy(uuid, uuid, numeric) to anon, authenticated;

revoke all on function public.execute_lmsr_buy(uuid, uuid, numeric, uuid) from public;
grant execute on function public.execute_lmsr_buy(uuid, uuid, numeric, uuid) to authenticated;

revoke all on function public.resolve_market(uuid, uuid, text) from public, anon;
grant execute on function public.resolve_market(uuid, uuid, text) to authenticated, service_role;

-- Disable all client entry points that can create sells or browser-priced buys.
revoke all on function public.place_limit_order(uuid, uuid, public.order_side, numeric, numeric) from public, anon, authenticated;
revoke all on function public.place_buy_limit_order(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.place_sell_limit_order(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.cancel_user_order(uuid) from public, anon, authenticated;

-- Remove the MVP self-credit endpoint. Deposits may only be completed by the
-- Stripe webhook using the service role and an existing pending deposit row.
drop function if exists public.credit_user_wallet(numeric);
drop function if exists public.credit_user_wallet(numeric, uuid);

create or replace function public.complete_stripe_deposit(
	p_checkout_session_id text,
	p_user_id uuid,
	p_amount_dop numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
	v_deposit public.stripe_deposits%rowtype;
	v_wallet public.wallets%rowtype;
	v_new_balance numeric(20,4);
begin
	if p_checkout_session_id is null or length(p_checkout_session_id) < 5 then
		raise exception 'Sesion de pago invalida';
	end if;

	if p_user_id is null or p_amount_dop is null or p_amount_dop <= 0 then
		raise exception 'Datos de deposito invalidos';
	end if;

	select sd.*
	into v_deposit
	from public.stripe_deposits sd
	where sd.stripe_checkout_session_id = p_checkout_session_id
	for update;

	if v_deposit.id is null then
		raise exception 'Deposito no registrado';
	end if;

	if v_deposit.user_id <> p_user_id or v_deposit.amount_dop <> p_amount_dop then
		raise exception 'El deposito no coincide con la sesion registrada';
	end if;

	select w.*
	into v_wallet
	from public.wallets w
	where w.user_id = p_user_id
	for update;

	if v_wallet.id is null then
		raise exception 'Wallet no encontrada para el deposito';
	end if;

	if v_deposit.status = 'completed' then
		return v_wallet.balance_available;
	end if;

	if v_deposit.status <> 'pending' then
		raise exception 'El deposito no esta pendiente';
	end if;

	v_new_balance := v_wallet.balance_available + p_amount_dop;

	update public.wallets
	set balance_available = v_new_balance,
			updated_at = now()
	where id = v_wallet.id;

	insert into public.wallet_movements (
		user_id,
		wallet_id,
		movement_type,
		amount,
		balance_after,
		metadata
	) values (
		p_user_id,
		v_wallet.id,
		'deposit',
		p_amount_dop,
		v_new_balance,
		jsonb_build_object(
			'provider', 'stripe',
			'checkout_session_id', p_checkout_session_id
		)
	);

	update public.stripe_deposits
	set status = 'completed',
			completed_at = now(),
			updated_at = now()
	where id = v_deposit.id;

	return v_new_balance;
end;
$function$;

revoke all on function public.complete_stripe_deposit(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.complete_stripe_deposit(text, uuid, numeric) to service_role;
