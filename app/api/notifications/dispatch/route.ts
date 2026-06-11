import { NextResponse } from "next/server";
import { getNotificationEnv } from "@/lib/env";
import { tryDispatchPendingNotifications } from "@/lib/notifications/dispatch";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function dispatchNotifications(request: Request) {
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

  const result = await tryDispatchPendingNotifications(50);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return dispatchNotifications(request);
}

export async function GET(request: Request) {
  return dispatchNotifications(request);
}
