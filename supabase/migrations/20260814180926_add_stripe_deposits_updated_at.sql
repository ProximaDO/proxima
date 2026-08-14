alter table public.stripe_deposits
	add column if not exists updated_at timestamptz not null default now();
