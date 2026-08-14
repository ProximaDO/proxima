create or replace function public.submit_kyc_document(
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
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'No autenticado';
	end if;

	if p_document_path is null
		or btrim(p_document_path) = ''
		or split_part(p_document_path, '/', 1) <> v_user_id::text
		or not exists (
			select 1
			from storage.objects object
			where object.bucket_id = 'kyc-documents'
				and object.name = p_document_path
		)
	then
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

	insert into public.kyc_verifications (
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
		v_user_id,
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

revoke all on function public.submit_kyc_document(text, text, text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.submit_kyc_document(text, text, text, text, text)
to authenticated;