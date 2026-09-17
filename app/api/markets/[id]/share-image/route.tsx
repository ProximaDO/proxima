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
const IMAGE_HEIGHT = 1350;
const CHART_WIDTH = 900;
const CHART_HEIGHT = 380;
const MAX_OPTIONS = 6;
const FX_HISTORY_DAYS = 8;

const paramsSchema = z.object({ id: z.uuid() });

type OptionRow = {
  id: string;
  label: string;
  lmsr_quantity: number;
  sort_order: number;
};

type SnapshotRow = {
  option_probabilities: Record<string, number>;
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

function buildLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";

  if (values.length === 1) {
    const y = height - Math.max(0, Math.min(1, values[0])) * height;
    return `M0 ${y.toFixed(2)} L${width} ${y.toFixed(2)}`;
  }

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const clamped = Math.max(0, Math.min(1, value));
      const y = height - clamped * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

// Satori no renderiza <svg> inline de forma fiable: el grafico va como data URI.
function wrapChartSvg(content: string) {
  const grid = [0.25, 0.5, 0.75]
    .map(
      (ratio) =>
        `<path d="M0 ${(CHART_HEIGHT * ratio).toFixed(2)} H${CHART_WIDTH}" stroke="rgba(255,255,255,0.1)" stroke-width="2" />`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}"><rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="#091b56" /><path d="M0 ${CHART_HEIGHT - 2} H${CHART_WIDTH}" stroke="rgba(255,255,255,0.18)" stroke-width="2" />${grid}${content}</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildChartDataUri(series: { color: string; path: string }[]) {
  const lines = series
    .filter((item) => item.path)
    .map(
      (item) =>
        `<path d="${item.path}" fill="none" stroke="${item.color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />`,
    )
    .join("");

  return wrapChartSvg(lines);
}

function buildFxChartDataUri(values: number[]) {
  if (values.length === 0) return wrapChartSvg("");

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.0001, max - min);
  const padding = 30;
  const usableHeight = CHART_HEIGHT - padding * 2;

  const points = values.map((value, index) => ({
    x: values.length === 1 ? CHART_WIDTH / 2 : (index / (values.length - 1)) * CHART_WIDTH,
    y: padding + usableHeight - ((value - min) / range) * usableHeight,
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const dots = points
    .map(
      (point, index) =>
        `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === points.length - 1 ? 10 : 7}" fill="${index === points.length - 1 ? "#ffffff" : "#f7a93b"}" stroke="#f7a93b" stroke-width="4" />`,
    )
    .join("");

  return wrapChartSvg(
    `<path d="${path}" fill="none" stroke="#f7a93b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />${dots}`,
  );
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

  const [marketResult, optionsResult, snapshotsResult] = await Promise.all([
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
    supabase
      .from("market_snapshots")
      .select("option_probabilities")
      .eq("market_id", marketId)
      .eq("pricing_model", "lmsr")
      .order("snapshot_at", { ascending: true })
      .limit(100),
  ]);

  const market = marketResult.data;

  if (!market) {
    return NextResponse.json({ error: "Mercado no encontrado" }, { status: 404 });
  }

  const options = (optionsResult.data ?? []) as OptionRow[];
  const snapshots = (snapshotsResult.data ?? []) as unknown as SnapshotRow[];

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

  const chartSeries = options.map((option, index) => {
    const timeline = snapshots.length
      ? snapshots.map((snapshot) =>
          Number(snapshot.option_probabilities?.[option.id] ?? defaultProb),
        )
      : [probabilities.get(option.id) ?? defaultProb];

    return {
      color: optionColor(index),
      path: buildLinePath(timeline, CHART_WIDTH, CHART_HEIGHT),
    };
  });

  const closesLabel = market.closes_at
    ? `Cierra ${new Date(market.closes_at).toLocaleDateString("es-DO")}`
    : "Sin fecha de cierre";

  const isDailyFx = Boolean(market.is_daily_fx);
  const fxHistory = isDailyFx ? await loadFxHistory() : [];
  const lastFxPoint = fxHistory.at(-1) ?? null;

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
            {isDailyFx ? "Cierre USD/Venta (BCRD)" : "Evolucion de probabilidad"}
          </div>

          {isDailyFx ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", marginTop: 10, fontSize: 56, fontWeight: 800 }}>
                {lastFxPoint ? lastFxPoint.selling.toFixed(4) : "--"}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.55)" }}>
                {lastFxPoint ? `Ultimo cierre: ${lastFxPoint.label}` : "Sin datos historicos disponibles"}
              </div>
              <img
                src={buildFxChartDataUri(fxHistory.map((item) => item.selling))}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                style={{ marginTop: 16, borderRadius: 20, height: 280 }}
                alt=""
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 16 }}>
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <img
                src={buildChartDataUri(chartSeries)}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                style={{ marginTop: 16, borderRadius: 20 }}
                alt=""
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 16 }}>
                {visibleOptions.map((option, index) => (
                  <div key={option.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: "rgba(255,255,255,0.72)" }}>
                    <div
                      style={{
                        display: "flex",
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        backgroundColor: optionColor(index),
                      }}
                    />
                    <div style={{ display: "flex" }}>
                      {`${option.label}: ${((probabilities.get(option.id) ?? defaultProb) * 100).toFixed(1)}%`}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 22, color: "rgba(255,255,255,0.45)" }}>
                {snapshots.length > 0
                  ? `Basado en ${snapshots.length} snapshots LMSR.`
                  : "Sin compras LMSR recientes; se muestra la probabilidad actual."}
              </div>
            </div>
          )}
        </div>

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
      height: IMAGE_HEIGHT,
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    },
  );
}
