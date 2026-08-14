-- ============================================================
-- Migracion: Campos obligatorios de identidad en KYC
-- Fecha: 2026-06-25
-- ============================================================

alter table if exists kyc_verifications
  add column if not exists legal_full_name text,
  add column if not exists id_number text,
  add column if not exists phone text,
  add column if not exists address_line text;

create or replace function submit_kyc_document(
  p_document_path text,
  p_legal_full_name text,
  p_id_number text,
  p_phone text,
  p_address_line text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_document_path is null or btrim(p_document_path) = '' then
    raise exception 'Documento invalido';
  end if;

  if p_legal_full_name is null or btrim(p_legal_full_name) = '' then
    raise exception 'Nombre completo requerido';
  end if;

  if p_id_number is null or btrim(p_id_number) = '' then
    raise exception 'Numero de identificacion requerido';
  end if;

  if p_phone is null or btrim(p_phone) = '' then
    raise exception 'Telefono requerido';
  end if;

  if p_address_line is null or btrim(p_address_line) = '' then
    raise exception 'Direccion requerida';
  end if;

  insert into kyc_verifications (
    user_id,
    status,
    id_document_path,
    id_document_uploaded_at,
    legal_full_name,
    id_number,
    phone,
    address_line,
    rejection_reason,
    last_error
  )
  values (
    auth.uid(),
    'submitted',
    p_document_path,
    now(),
    btrim(p_legal_full_name),
    btrim(p_id_number),
    btrim(p_phone),
    btrim(p_address_line),
    null,
    null
  )
  on conflict (user_id)
  do update set
    status = 'submitted',
    id_document_path = excluded.id_document_path,
    id_document_uploaded_at = now(),
    legal_full_name = excluded.legal_full_name,
    id_number = excluded.id_number,
    phone = excluded.phone,
    address_line = excluded.address_line,
    rejection_reason = null,
    last_error = null,
    updated_at = now();
end;
$$;

drop function if exists submit_kyc_document(text);

revoke all on function submit_kyc_document(text, text, text, text, text) from public;
grant execute on function submit_kyc_document(text, text, text, text, text) to authenticated;
