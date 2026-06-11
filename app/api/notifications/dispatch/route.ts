import { NextResponse } from "next/server";
import { getNotificationEnv } from "@/lib/env";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";
import { opsLogger } from "@/lib/ops/logger";
import { consumeRateLimit } from "@/lib/ops/rate-limit";
import { getRequestId, getRequestIp } from "@/lib/ops/request";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function dispatchNotifications(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const ip = getRequestIp(request);

  const rateLimit = consumeRateLimit(`notifications:dispatch:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) {
    opsLogger.warn("notifications.dispatch.rate_limited", {
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
    opsLogger.error("notifications.dispatch.env_missing", { requestId, ip });
    return NextResponse.json(
      { ok: false, error: "notifications env not configured", requestId },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== env.NOTIFICATIONS_DISPATCH_TOKEN) {
    opsLogger.warn("notifications.dispatch.unauthorized", { requestId, ip });
    return unauthorized();
  }

  const result = await tryDispatchPendingNotifications(50);

  opsLogger.info("notifications.dispatch.completed", {
    requestId,
    ip,
    durationMs: Date.now() - startedAt,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    reason: result.reason ?? null,
  });

  return NextResponse.json({ ok: true, requestId, ...result });
}

export async function POST(request: Request) {
  return dispatchNotifications(request);
}

export async function GET(request: Request) {
  return dispatchNotifications(request);
}
