-- ============================================================
-- Migración: Añadir p_user_id a credit_user_wallet
-- Permite acreditar desde service role (webhooks) sin sesión activa
-- Fecha: 2026-06-22
-- ============================================================

-- La función original solo acepta p_amount y usa auth.uid().
-- Esta versión añade p_user_id opcional: si se provee, lo usa;
-- si no, cae al auth.uid() original (retrocompatible).

create or replace function credit_user_wallet(
  p_amount  numeric,
  p_user_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_wallet_id  uuid;
  v_new_balance numeric;
begin
  -- Resolver user_id: parámetro explícito (service role) o sesión activa
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    raise exception 'Debes iniciar sesion';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto debe ser positivo';
  end if;

  -- Actualizar balance disponible y obtener wallet_id
  update wallets
  set balance_available = balance_available + p_amount
  where user_id = v_user_id
  returning id, balance_available into v_wallet_id, v_new_balance;

  if not found then
    raise exception 'Wallet no encontrado para el usuario';
  end if;

  -- Registrar movimiento
  insert into wallet_movements (user_id, wallet_id, movement_type, amount, balance_after)
  values (v_user_id, v_wallet_id, 'deposit', p_amount, v_new_balance);

  return v_new_balance;
end;
$$;
