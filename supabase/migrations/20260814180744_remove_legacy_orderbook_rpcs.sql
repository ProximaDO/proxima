drop function if exists public.cancel_user_order(uuid);
drop function if exists public.place_buy_limit_order(uuid, uuid, numeric, numeric);
drop function if exists public.place_sell_limit_order(uuid, uuid, numeric, numeric);
drop function if exists public.place_limit_order(
	uuid,
	uuid,
	public.order_side,
	numeric,
	numeric
);
