import { NextResponse } from "next/server";
import { getNotificationEnv } from "@/lib/env";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function processWithdrawals(request: Request) {
  let env: ReturnType<typeof getNotificationEnv>;

  try {
    env = getNotificationEnv();
  } catch {
    return NextResponse.json(
      { ok: false, error: "notifications env not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== env.NOTIFICATIONS_DISPATCH_TOKEN) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 25;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("process_withdrawal_queue", {
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const dispatch = await tryDispatchPendingNotifications(50);
  return NextResponse.json({ ok: true, processed: Number(data ?? 0), dispatch });
}

export async function POST(request: Request) {
  return processWithdrawals(request);
}

export async function GET(request: Request) {
  return processWithdrawals(request);
}