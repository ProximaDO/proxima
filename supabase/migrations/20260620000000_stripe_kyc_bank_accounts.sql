-- ============================================================
-- Migración: Stripe Payments + KYC + Bank Accounts
-- Fecha: 2026-06-20
-- ============================================================

-- --------------------------------------------------------
-- 1. kyc_verifications
-- --------------------------------------------------------
do $$ begin
  create type kyc_status as enum (
    'pending',
    'submitted',
    'verified',
    'rejected',
    'requires_input'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists kyc_verifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  stripe_session_id   text,
  status              kyc_status not null default 'pending',
  verified_at         timestamptz,
  rejection_reason    text,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id)
);

-- Solo el usuario puede leer su propia fila; nadie puede escribir directamente (solo service role)
alter table kyc_verifications enable row level security;

create policy "user can read own kyc"
  on kyc_verifications for select
  using (auth.uid() = user_id);

-- --------------------------------------------------------
-- 2. bank_accounts
-- --------------------------------------------------------
create table if not exists bank_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  bank_name                text not null,
  account_holder_name      text not null,
  account_last4            char(4) not null,
  account_number_encrypted text not null,
  account_type             text not null check (account_type in ('checking', 'savings')),
  is_primary               boolean not null default false,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table bank_accounts enable row level security;

create policy "user can read own bank accounts"
  on bank_accounts for select
  using (auth.uid() = user_id);

create policy "user can insert own bank accounts"
  on bank_accounts for insert
  with check (auth.uid() = user_id);

create policy "user can update own bank accounts"
  on bank_accounts for update
  using (auth.uid() = user_id);

-- Asegurar que solo haya una cuenta primaria por usuario
create unique index if not exists bank_accounts_user_primary_idx
  on bank_accounts (user_id)
  where is_primary = true and is_active = true;

-- --------------------------------------------------------
-- 3. Ampliar withdrawal_requests
-- --------------------------------------------------------
alter table withdrawal_requests
  add column if not exists bank_account_id uuid references bank_accounts(id),
  add column if not exists process_after   timestamptz,
  add column if not exists stripe_checkout_session_id text;

-- --------------------------------------------------------
-- 4. Ampliar withdrawal_rules
-- --------------------------------------------------------
alter table withdrawal_rules
  add column if not exists min_processing_days int not null default 3;

-- --------------------------------------------------------
-- 5. Tabla de depósitos Stripe para auditoría
-- --------------------------------------------------------
create table if not exists stripe_deposits (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  amount_dop                 numeric(14,2) not null,
  status                     text not null default 'pending' check (status in ('pending','completed','failed')),
  completed_at               timestamptz,
  created_at                 timestamptz not null default now()
);

alter table stripe_deposits enable row level security;

create policy "user can read own deposits"
  on stripe_deposits for select
  using (auth.uid() = user_id);

-- --------------------------------------------------------
-- 6. RPC: set_primary_bank_account
-- --------------------------------------------------------
create or replace function set_primary_bank_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verificar que la cuenta pertenece al usuario autenticado
  if not exists (
    select 1 from bank_accounts
    where id = p_account_id and user_id = auth.uid() and is_active = true
  ) then
    raise exception 'Cuenta bancaria no encontrada';
  end if;

  -- Quitar primaria de todas las cuentas del usuario
  update bank_accounts
  set is_primary = false
  where user_id = auth.uid();

  -- Marcar la nueva primaria
  update bank_accounts
  set is_primary = true
  where id = p_account_id;
end;
$$;

-- --------------------------------------------------------
-- 7. RPC: deactivate_bank_account
-- --------------------------------------------------------
create or replace function deactivate_bank_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from bank_accounts
    where id = p_account_id and user_id = auth.uid()
  ) then
    raise exception 'Cuenta bancaria no encontrada';
  end if;

  update bank_accounts
  set is_active = false, is_primary = false
  where id = p_account_id and user_id = auth.uid();
end;
$$;

-- --------------------------------------------------------
-- 8. RPC: upsert_kyc_verification (solo service role)
-- --------------------------------------------------------
create or replace function upsert_kyc_verification(
  p_user_id           uuid,
  p_stripe_session_id text,
  p_status            kyc_status,
  p_rejection_reason  text default null,
  p_last_error        text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into kyc_verifications (user_id, stripe_session_id, status, verified_at, rejection_reason, last_error)
  values (
    p_user_id,
    p_stripe_session_id,
    p_status,
    case when p_status = 'verified' then now() else null end,
    p_rejection_reason,
    p_last_error
  )
  on conflict (user_id) do update set
    stripe_session_id  = excluded.stripe_session_id,
    status             = excluded.status,
    verified_at        = case when excluded.status = 'verified' then now() else kyc_verifications.verified_at end,
    rejection_reason   = excluded.rejection_reason,
    last_error         = excluded.last_error,
    updated_at         = now();
end;
$$;
