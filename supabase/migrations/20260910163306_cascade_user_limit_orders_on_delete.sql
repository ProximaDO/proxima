alter table public.limit_orders
	drop constraint if exists limit_orders_user_id_fkey;

alter table public.limit_orders
	add constraint limit_orders_user_id_fkey
	foreign key (user_id)
	references public.profiles(id)
	on delete cascade;
