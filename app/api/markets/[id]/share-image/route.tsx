import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchBcrdDailyHistory } from "@/lib/fx/bcrd";
import { getRdNowParts } from "@/lib/fx/daily-market";
import { computeLmsrLiquidity, computeLmsrProbabilities } from "@/lib/markets/pricing";
import { consumeRateLimit } from "@/lib/ops/rate-limit";
import { getRequestIp } from "@/lib/ops/request";
import { createClient } from "@/lib/supabase/server";
import { labelMarketStatus } from "@/lib/ui/labels-es-do";

export const runtime = "nodejs";

const IMAGE_WIDTH = 1080;
const MAX_OPTIONS = 6;
const FX_HISTORY_DAYS = 8;

const paramsSchema = z.object({ id: z.uuid() });

type OptionRow = {
  id: string;
  label: string;
  lmsr_quantity: number;
  sort_order: number;
};

type FxHistoryRow = {
  date: string;
  label: string;
  purchase: number;
  selling: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function optionColor(index: number) {
  return `hsl(${(index * 97) % 360}, 84%, 68%)`;
}

function subtractDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function getFxHistoryTimestamp(row: FxHistoryRow) {
  const timestamp = Date.parse(row.date);
  if (Number.isFinite(timestamp)) return timestamp;

  const match = row.label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;

  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

async function loadFxHistory(): Promise<FxHistoryRow[]> {
  const rdNow = getRdNowParts();
  const rows = await fetchBcrdDailyHistory(subtractDaysIso(rdNow.isoDate, 16), rdNow.isoDate).catch(
    () => [] as FxHistoryRow[],
  );

  const byDate = new Map<string, FxHistoryRow>();
  for (const row of rows) {
    const timestamp = getFxHistoryTimestamp(row);
    const key = timestamp ? new Date(timestamp).toISOString().slice(0, 10) : row.label;
    const current = byDate.get(key);
    if (!current || timestamp >= getFxHistoryTimestamp(current)) byDate.set(key, row);
  }

  return Array.from(byDate.values())
    .sort((a, b) => getFxHistoryTimestamp(a) - getFxHistoryTimestamp(b))
    .slice(-FX_HISTORY_DAYS);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit(`market-share-image:${getRequestIp(request)}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes de imagen. Intenta nuevamente en unos segundos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } },
    );
  }

  const parsed = paramsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Mercado invalido" }, { status: 400 });
  }

  const marketId = parsed.data.id;
  const supabase = await createClient();

  const [marketResult, optionsResult] = await Promise.all([
    supabase
      .from("markets")
      .select("id, title, description, category, status, closes_at, liquidity_b, is_daily_fx")
      .eq("id", marketId)
      .maybeSingle(),
    supabase
      .from("market_options")
      .select("id, label, lmsr_quantity, sort_order")
      .eq("market_id", marketId)
      .order("sort_order", { ascending: true }),
  ]);

  const market = marketResult.data;

  if (!market) {
    return NextResponse.json({ error: "Mercado no encontrado" }, { status: 404 });
  }

  const options = (optionsResult.data ?? []) as OptionRow[];

  const optionIds = options.map((option) => option.id);
  const liquidityB = Number(market.liquidity_b ?? 100);
  const quantityByOption = new Map(
    options.map((option) => [option.id, Number(option.lmsr_quantity ?? 0)]),
  );

  const probabilities = computeLmsrProbabilities({ optionIds, liquidityB, quantityByOption });
  const liquidity = optionIds.length
    ? computeLmsrLiquidity({ optionIds, liquidityB, quantityByOption })
    : 0;

  const defaultProb = optionIds.length > 0 ? 1 / optionIds.length : 0;
  const visibleOptions = options.slice(0, MAX_OPTIONS);
  const hiddenOptionsCount = options.length - visibleOptions.length;

  const closesLabel = market.closes_at
    ? `Cierra ${new Date(market.closes_at).toLocaleDateString("es-DO")}`
    : "Sin fecha de cierre";

  const isDailyFx = Boolean(market.is_daily_fx);
  const fxHistory = isDailyFx ? await loadFxHistory() : [];
  const lastFxPoint = fxHistory.at(-1) ?? null;

  // Satori exige alto fijo: se estima segun el contenido para no dejar espacio vacio.
  const titleLines = Math.max(1, Math.ceil(market.title.length / 24));
  const headerHeight = 34 + 14 + titleLines * 70 + 24 + 48 + 18 + 34;
  const optionsHeight =
    26 +
    56 +
    30 +
    18 +
    visibleOptions.length * 62 +
    Math.max(0, visibleOptions.length - 1) * 16 +
    (hiddenOptionsCount > 0 ? 42 : 0);
  const fxHeight = isDailyFx ? 26 + 56 + 30 + 67 + 30 + 18 + 56 : 0;
  const imageHeight = Math.round(112 + headerHeight + optionsHeight + fxHeight + 70 + 24);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0b1748",
          backgroundImage: "linear-gradient(160deg, #0b1748 0%, #071033 60%, #050d34 100%)",
          padding: 56,
          color: "#ffffff",
          fontSize: 32,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#65bfff", textTransform: "uppercase" }}>
            {market.category ?? "Mercado"}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 60, fontWeight: 800, lineHeight: 1.15 }}>
            {market.title}
          </div>
          <div style={{ display: "flex", marginTop: 24, gap: 16 }}>
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.18)",
                backgroundColor: "rgba(255,255,255,0.08)",
                padding: "10px 22px",
                fontSize: 26,
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {`Estado: ${labelMarketStatus(market.status)}`}
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.18)",
                backgroundColor: "rgba(255,255,255,0.08)",
                padding: "10px 22px",
                fontSize: 26,
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {closesLabel}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 28, fontWeight: 700, color: "#a7f3d0" }}>
            {`Liquidez de mercado: ${formatMoney(liquidity)}`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 34,
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.04)",
            padding: 28,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
            Probabilidades
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, gap: 16 }}>
            {visibleOptions.map((option, index) => {
              const prob = probabilities.get(option.id) ?? defaultProb;
              return (
                <div key={option.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30 }}>
                      <div
                        style={{
                          display: "flex",
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          backgroundColor: optionColor(index),
                        }}
                      />
                      <div style={{ display: "flex" }}>{option.label}</div>
                    </div>
                    <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "#ff8a66" }}>
                      {`${(prob * 100).toFixed(1)}%`}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: 14,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        height: 14,
                        width: `${Math.max(3, prob * 100)}%`,
                        borderRadius: 999,
                        backgroundImage: "linear-gradient(90deg, #ff6a41 0%, #6538e6 100%)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {hiddenOptionsCount > 0 ? (
              <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.55)" }}>
                {`+${hiddenOptionsCount} opciones mas en Proxima`}
              </div>
            ) : null}
          </div>
        </div>

        {isDailyFx ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 26,
              borderRadius: 28,
              border: "2px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(255,255,255,0.04)",
              padding: 28,
            }}
          >
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
              Cierre USD/Venta (BCRD)
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 56, fontWeight: 800 }}>
              {lastFxPoint ? lastFxPoint.selling.toFixed(4) : "--"}
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.55)" }}>
              {lastFxPoint ? `Ultimo cierre: ${lastFxPoint.label}` : "Sin datos historicos disponibles"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 18 }}>
              {fxHistory.map((item) => (
                <div key={item.date} style={{ display: "flex", flexDirection: "column", fontSize: 22 }}>
                  <div style={{ display: "flex", color: "rgba(255,255,255,0.5)" }}>{item.label.slice(0, 5)}</div>
                  <div style={{ display: "flex", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                    {item.selling.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>PROXIMA</div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.6)" }}>
            Predice ahora en este mercado
          </div>
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: imageHeight,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    },
  );
}
