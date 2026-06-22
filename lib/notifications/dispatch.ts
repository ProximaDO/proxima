import { Resend } from "resend";
import { getNotificationEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildNotificationTemplate } from "@/lib/notifications/templates";

type DispatchResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

type EventType =
  | "trade_fill"
  | "order_cancelled"
  | "market_closed"
  | "market_resolved"
  | "withdrawal_approved"
  | "withdrawal_rejected";

type NotificationEvent = {
  id: string;
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  attempt_count: number;
  created_at: string;
};

export async function tryDispatchPendingNotifications(limit = 25): Promise<DispatchResult> {
  let env: ReturnType<typeof getNotificationEnv>;

  try {
    env = getNotificationEnv();
  } catch {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "notification env not configured",
    };
  }

  const supabase = createAdminClient();
  const resend = new Resend(env.RESEND_API_KEY);

  const nowIso = new Date().toISOString();
  const { data: pendingRaw, error: fetchError } = await supabase
    .from("notification_events")
    .select("id, user_id, event_type, payload, attempt_count, created_at")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError || !pendingRaw) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: fetchError?.message ?? "cannot load pending notifications",
    };
  }

  const pending = pendingRaw as NotificationEvent[];
  if (pending.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }

  const userIds = [...new Set(pending.map((ev) => ev.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", userIds);

  if (profileError || !profiles) {
    return {
      sent: 0,
      failed: 0,
      skipped: true,
      reason: profileError?.message ?? "cannot load profile emails",
    };
  }

  const emailByUserId = new Map<string, string>();
  for (const p of profiles) {
    if (p.email) emailByUserId.set(p.id, p.email);
  }

  let sent = 0;
  let failed = 0;

  for (const ev of pending) {
    if (ev.event_type === "order_cancelled") {
      const suppress = await shouldSuppressOrderCancelled(supabase, ev);

      if (suppress) {
        await supabase
          .from("notification_events")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            read_at: new Date().toISOString(),
            attempt_count: ev.attempt_count + 1,
            payload: {
              ...(ev.payload ?? {}),
              notification_suppressed: true,
              notification_suppressed_reason: "market_closure_auto_cancel",
            },
            last_error: null,
          })
          .eq("id", ev.id);

        continue;
      }
    }

    const recipient = emailByUserId.get(ev.user_id);

    if (!recipient) {
      failed += 1;
      await markFailed(supabase, ev, "Usuario sin email en perfil");
      continue;
    }

    const template = buildNotificationTemplate(ev.event_type, ev.payload ?? {});

    try {
      const res = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: recipient,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      if (res.error) {
        failed += 1;
        await markFailed(supabase, ev, res.error.message);
        continue;
      }

      sent += 1;
      await supabase
        .from("notification_events")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempt_count: ev.attempt_count + 1,
          last_error: null,
        })
        .eq("id", ev.id);
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : "Error desconocido en Resend";
      await markFailed(supabase, ev, msg);
    }
  }

  return { sent, failed, skipped: false };
}

async function shouldSuppressOrderCancelled(
  supabase: ReturnType<typeof createAdminClient>,
  ev: NotificationEvent,
) {
  const marketId = String(ev.payload?.market_id ?? "");
  const quantityFilled = Number(ev.payload?.quantity_filled ?? 0);

  if (!marketId || Number.isNaN(quantityFilled) || quantityFilled > 0) {
    return false;
  }

  // Si el usuario quedó sin posición al cierre, el aviso "orden cancelada"
  // es redundante frente a "mercado resuelto".
  const { data: relatedResolution } = await supabase
    .from("notification_events")
    .select("id")
    .eq("user_id", ev.user_id)
    .eq("event_type", "market_resolved")
    .eq("payload->>market_id", marketId)
    .eq("payload->>resolution_status", "no_position_at_close")
    .limit(1)
    .maybeSingle();

  if (relatedResolution) {
    return true;
  }

  const { data: relatedClose } = await supabase
    .from("notification_events")
    .select("id")
    .eq("user_id", ev.user_id)
    .eq("event_type", "market_closed")
    .eq("payload->>market_id", marketId)
    .limit(1)
    .maybeSingle();

  return Boolean(relatedClose);
}

async function markFailed(
  supabase: ReturnType<typeof createAdminClient>,
  ev: NotificationEvent,
  message: string,
) {
  await supabase
    .from("notification_events")
    .update({
      status: ev.attempt_count + 1 >= 3 ? "failed" : "pending",
      attempt_count: ev.attempt_count + 1,
      scheduled_at:
        ev.attempt_count + 1 >= 3
          ? new Date().toISOString()
          : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      last_error: message.slice(0, 500),
    })
    .eq("id", ev.id);
}
