import { NextResponse } from "next/server";
import { getNotificationEnv } from "@/lib/env";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { opsLogger } from "@/lib/ops/logger";
import { consumeRateLimit } from "@/lib/ops/rate-limit";
import { getRequestId, getRequestIp } from "@/lib/ops/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function processWithdrawals(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const ip = getRequestIp(request);

  const rateLimit = consumeRateLimit(`withdrawals:process:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    opsLogger.warn("withdrawals.process.rate_limited", {
      requestId,
      ip,
      retryAfterSec: rateLimit.retryAfterSec,
    });

    return NextResponse.json(
      { ok: false, error: "too_many_requests", requestId },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      },
    );
  }

  let env: ReturnType<typeof getNotificationEnv>;

  try {
    env = getNotificationEnv();
  } catch {
    opsLogger.error("withdrawals.process.env_missing", { requestId, ip });
    return NextResponse.json(
      { ok: false, error: "notifications env not configured", requestId },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== env.NOTIFICATIONS_DISPATCH_TOKEN) {
    opsLogger.warn("withdrawals.process.unauthorized", { requestId, ip });
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
    opsLogger.error("withdrawals.process.rpc_error", {
      requestId,
      ip,
      message: error.message,
    });
    return NextResponse.json({ ok: false, error: error.message, requestId }, { status: 500 });
  }

  const dispatch = await tryDispatchPendingNotifications(50);

  opsLogger.info("withdrawals.process.completed", {
    requestId,
    ip,
    durationMs: Date.now() - startedAt,
    processed: Number(data ?? 0),
    dispatchSent: dispatch.sent,
    dispatchFailed: dispatch.failed,
  });

  return NextResponse.json({ ok: true, requestId, processed: Number(data ?? 0), dispatch });
}

export async function POST(request: Request) {
  return processWithdrawals(request);
}

export async function GET(request: Request) {
  return processWithdrawals(request);
}