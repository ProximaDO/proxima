import { NextResponse } from "next/server";
import { getPublicEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  try {
    getPublicEnv();

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        error: "missing_public_env",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
