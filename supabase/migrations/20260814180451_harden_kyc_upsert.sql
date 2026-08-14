create or replace function public.upsert_kyc_verification(
	p_user_id uuid,
	p_stripe_session_id text default null,
	p_status public.kyc_status default 'pending',
	p_rejection_reason text default null,
	p_last_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
	insert into public.kyc_verifications (
		user_id,
		stripe_session_id,
		status,
		verified_at,
		rejection_reason,
		last_error
	)
	values (
		p_user_id,
		p_stripe_session_id,
		p_status,
		case when p_status = 'verified' then now() else null end,
		p_rejection_reason,
		p_last_error
	)
	on conflict (user_id) do update set
		stripe_session_id = coalesce(excluded.stripe_session_id, public.kyc_verifications.stripe_session_id),
		status = excluded.status,
		verified_at = case
			when excluded.status = 'verified' then now()
			else public.kyc_verifications.verified_at
		end,
		rejection_reason = excluded.rejection_reason,
		last_error = excluded.last_error,
		updated_at = now();
end;
$function$;

revoke all on function public.upsert_kyc_verification(
	uuid,
	text,
	public.kyc_status,
	text,
	text
) from public, anon, authenticated;

grant execute on function public.upsert_kyc_verification(
	uuid,
	text,
	public.kyc_status,
	text,
	text
) to service_role;
