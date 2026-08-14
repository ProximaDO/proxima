-- Remove the legacy order-book primitive that allowed arbitrary position writes.
drop function if exists public.apply_position_fill(
	uuid,
	uuid,
	uuid,
	public.order_side,
	numeric,
	numeric
);

-- Trigger functions are invoked by PostgreSQL and never need Data API access.
revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_market_closed_notifications() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_market_resolved_notifications() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_order_cancelled_notification() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_trade_fill_notifications() from public, anon, authenticated, service_role;
revoke all on function public.enqueue_withdrawal_review_notifications() from public, anon, authenticated, service_role;

-- User RPCs validate auth.uid() internally and are only callable by signed-in users.
revoke all on function public.deactivate_bank_account(uuid) from public, anon, authenticated, service_role;
grant execute on function public.deactivate_bank_account(uuid) to authenticated;

revoke all on function public.mark_all_notifications_read() from public, anon, authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke all on function public.mark_notification_read(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.mark_notification_read(uuid, boolean) to authenticated;

revoke all on function public.request_withdrawal(numeric, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.request_withdrawal(numeric, jsonb) to authenticated;

revoke all on function public.set_primary_bank_account(uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_primary_bank_account(uuid) to authenticated;

revoke all on function public.submit_kyc_document(text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_kyc_document(text, text, text, text, text) to authenticated;

-- Administrative RPCs enforce the admin role internally; queue processing is also used by cron.
revoke all on function public.review_withdrawal_request(uuid, text, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.review_withdrawal_request(uuid, text, text, text, text)
to authenticated;

revoke all on function public.process_withdrawal_queue(integer)
from public, anon, authenticated, service_role;
grant execute on function public.process_withdrawal_queue(integer)
to authenticated, service_role;

-- Keep role checks unavailable to anonymous Data API callers.
revoke all on function public.is_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_admin(uuid) to authenticated, service_role;