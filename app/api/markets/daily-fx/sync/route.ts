import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNotificationEnv } from "@/lib/env";
import { fetchBcrdDailyHistory } from "@/lib/fx/bcrd";
import {
  buildDailyFxSlug,
  buildDailyFxTitle,
  DAILY_MARKET_CLOSE_MINUTES,
  DAILY_MARKET_RESOLUTION_MINUTES,
  getDailyMarketWindowUtc,
  getRdNowParts,
} from "@/lib/fx/daily-market";
import { opsLogger } from "@/lib/ops/logger";
import { consumeRateLimit } from "@/lib/ops/rate-limit";
import { getRequestId, getRequestIp } from "@/lib/ops/request";

export const runtime = "nodejs";

type MarketRow = {
  id: string;
  status: "draft" | "open" | "closed" | "resolved" | "archived";
  resolution_option_id: string | null;
  fx_reference_source: string | null;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function subtractDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

async function getOperatorUserId(supabase: ReturnType<typeof createAdminClient>) {
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (adminRole?.user_id) {
    return adminRole.user_id;
  }

  const { data: fallbackProfile } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!fallbackProfile?.id) {
    throw new Error("No se encontro usuario para crear mercado diario FX");
  }

  return fallbackProfile.id;
}

async function ensureTodayDailyFxMarket(
  supabase: ReturnType<typeof createAdminClient>,
  isoDate: string,
  labelDate: string,
) {
  const slug = buildDailyFxSlug(isoDate);
  const { opensAt, closesAt } = getDailyMarketWindowUtc(isoDate);

  const { data: existing } = await supabase
    .from("markets")
    .select("id, status, resolution_option_id, fx_reference_source")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return existing as MarketRow;
  }

  const operatorId = await getOperatorUserId(supabase);
  const baseSource = JSON.stringify({
    provider: "BCRD",
    endpoint: "/Home/GetHistoricalExchangeRates",
    local_date: isoDate,
    metric: "usd_venta_cierre",
  });

  const { data: market, error } = await supabase
    .from("markets")
    .insert({
      title: buildDailyFxTitle(labelDate),
      description:
        "Mercado diario especial. Se resuelve con el valor de USD Venta publicado por el Banco Central a las 5:30 PM (hora RD).",
      category: "Economia",
      slug,
      created_by: operatorId,
      status: "open",
      opens_at: opensAt,
      closes_at: closesAt,
      liquidity_b: 100,
      fee_bps: 0,
      is_daily_fx: true,
      fx_reference_source: baseSource,
    })
    .select("id, status, resolution_option_id, fx_reference_source")
    .single();

  if (error || !market) {
    throw new Error(error?.message ?? "No se pudo crear el mercado diario FX");
  }

  const { error: optionsError } = await supabase.from("market_options").insert([
    { market_id: market.id, label: "Sube", sort_order: 0, is_active: true },
    { market_id: market.id, label: "Baja", sort_order: 1, is_active: true },
  ]);

  if (optionsError) {
    throw new Error(optionsError.message);
  }

  return market as MarketRow;
}

async function closeDailyMarketIfNeeded(
  supabase: ReturnType<typeof createAdminClient>,
  market: MarketRow,
  minutesOfDay: number,
) {
  if (minutesOfDay < DAILY_MARKET_CLOSE_MINUTES || market.status !== "open") {
    return market;
  }

  const { data, error } = await supabase
    .from("markets")
    .update({ status: "closed" })
    .eq("id", market.id)
    .select("id, status, resolution_option_id, fx_reference_source")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo cerrar el mercado diario FX");
  }

  return data as MarketRow;
}

async function resolveDailyMarketIfNeeded(
  supabase: ReturnType<typeof createAdminClient>,
  market: MarketRow,
  rdIsoDate: string,
  minutesOfDay: number,
) {
  if (minutesOfDay < DAILY_MARKET_RESOLUTION_MINUTES) {
    return { resolved: false, reason: "before_resolution_window" as const };
  }

  if (market.status !== "closed" || market.resolution_option_id) {
    return { resolved: false, reason: "already_processed" as const };
  }

  const fromDate = subtractDaysIso(rdIsoDate, 14);
  const rates = await fetchBcrdDailyHistory(fromDate, rdIsoDate);

  const normalized = rates
    .map((rate) => ({
      ...rate,
      isoDate: String(rate.date).slice(0, 10),
      selling: Number(rate.selling ?? 0),
    }))
    .filter((rate) => Number.isFinite(rate.selling) && rate.selling > 0)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const todayIndex = normalized.findIndex((item) => item.isoDate === rdIsoDate);
  if (todayIndex <= 0) {
    return { resolved: false, reason: "missing_today_or_previous_rate" as const };
  }

  const previous = normalized[todayIndex - 1];
  const today = normalized[todayIndex];
  const winningLabel = today.selling >= previous.selling ? "Sube" : "Baja";

  const { data: options } = await supabase
    .from("market_options")
    .select("id, label")
    .eq("market_id", market.id)
    .order("sort_order", { ascending: true });

  const winner = (options ?? []).find((option) => option.label.toLowerCase() === winningLabel.toLowerCase());
  if (!winner?.id) {
    throw new Error(`No se encontro opcion ganadora '${winningLabel}' en mercado diario FX`);
  }

  const resolutionNote =
    `BCRD USD/Venta cierre ${rdIsoDate}: ${today.selling.toFixed(4)} (previo ${previous.isoDate}: ${previous.selling.toFixed(4)}). ` +
    `Resultado: ${winningLabel}.`;

  const { error: resolveError } = await supabase.rpc("resolve_market", {
    p_market_id: market.id,
    p_winning_option_id: winner.id,
    p_resolution_note: resolutionNote,
  });

  if (resolveError) {
    throw new Error(resolveError.message);
  }

  let sourceMetadata: Record<string, unknown> = {};
  if (market.fx_reference_source) {
    try {
      sourceMetadata = JSON.parse(market.fx_reference_source);
    } catch {
      sourceMetadata = {};
    }
  }

  sourceMetadata = {
    ...sourceMetadata,
    resolved_at: new Date().toISOString(),
    resolved_with: {
      date: rdIsoDate,
      previous_date: previous.isoDate,
      selling_close: today.selling,
      previous_selling_close: previous.selling,
      winner: winningLabel,
      source_page: "https://bancentral.gov.do/SectorExterno/HistoricoTasas",
    },
  };

  await supabase
    .from("markets")
    .update({ fx_reference_source: JSON.stringify(sourceMetadata) })
    .eq("id", market.id);

  return { resolved: true, reason: "resolved" as const };
}

async function syncDailyFxMarket(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const ip = getRequestIp(request);

  const rateLimit = consumeRateLimit(`daily-fx-sync:${ip}`, 60, 60_000);
  if (!rateLimit.allowed) {
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

  const env = getNotificationEnv();
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== env.NOTIFICATIONS_DISPATCH_TOKEN) {
    opsLogger.warn("daily_fx_sync.unauthorized", { requestId, ip });
    return unauthorized();
  }

  const rdNow = getRdNowParts();
  const supabase = createAdminClient();

  const market = await ensureTodayDailyFxMarket(supabase, rdNow.isoDate, rdNow.labelDate);
  const closedMarket = await closeDailyMarketIfNeeded(supabase, market, rdNow.minutesOfDay);
  const resolution = await resolveDailyMarketIfNeeded(
    supabase,
    closedMarket,
    rdNow.isoDate,
    rdNow.minutesOfDay,
  );

  opsLogger.info("daily_fx_sync.completed", {
    requestId,
    ip,
    durationMs: Date.now() - startedAt,
    marketId: closedMarket.id,
    marketStatus: closedMarket.status,
    rdDate: rdNow.isoDate,
    rdHour: rdNow.hour,
    rdMinute: rdNow.minute,
    resolution: resolution.reason,
  });

  return NextResponse.json({
    ok: true,
    requestId,
    marketId: closedMarket.id,
    marketStatus: closedMarket.status,
    rdDate: rdNow.isoDate,
    resolution,
  });
}

export async function POST(request: Request) {
  try {
    return await syncDailyFxMarket(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "daily_fx_sync_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await syncDailyFxMarket(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "daily_fx_sync_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
