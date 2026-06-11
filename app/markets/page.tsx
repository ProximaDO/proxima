import Link from "next/link";
import { computeHybridProbabilities } from "@/lib/markets/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MarketRow = {
  id: string;
  title: string;
  status: "open" | "closed" | "resolved" | "archived" | "draft";
  category: string | null;
  closes_at: string | null;
  liquidity_b: number;
};

type OptionRow = {
  id: string;
  market_id: string;
  label: string;
  sort_order: number;
};

type TradeRow = {
  market_id: string;
  option_id: string;
  price: number;
  notional: number | null;
  created_at: string;
};

type PositionRow = {
  market_id: string;
  option_id: string;
  quantity: number;
};

type OpenOrderRow = {
  market_id: string;
  option_id: string;
  side: "buy" | "sell";
  limit_price: number;
  quantity: number;
  quantity_filled: number;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  closed: "Cerrado",
  resolved: "Resuelto",
  archived: "Archivado",
  draft: "Borrador",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-amber-100 text-amber-700",
  resolved: "bg-blue-100 text-blue-700",
  archived: "bg-zinc-200 text-zinc-600",
  draft: "bg-zinc-100 text-zinc-600",
};

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MarketsPage() {
  const supabase = await createClient();

  const { data: marketsData } = await supabase
    .from("markets")
    .select("id, title, status, category, closes_at, liquidity_b")
    .in("status", ["open", "closed", "resolved"])
    .order("created_at", { ascending: false })
    .limit(30);

  const markets = (marketsData ?? []) as MarketRow[];
  const marketIds = markets.map((m) => m.id);

  const [{ data: optionsData }, { data: tradesData }, { data: positionsData }, { data: openOrdersData }] = await Promise.all([
    marketIds.length
      ? supabase
          .from("market_options")
          .select("id, market_id, label, sort_order")
          .in("market_id", marketIds)
      : Promise.resolve({ data: [] as OptionRow[] }),
    marketIds.length
      ? supabase
          .from("trades")
          .select("market_id, option_id, price, notional, created_at")
          .in("market_id", marketIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as TradeRow[] }),
    marketIds.length
      ? supabase
          .from("positions")
          .select("market_id, option_id, quantity")
          .in("market_id", marketIds)
      : Promise.resolve({ data: [] as PositionRow[] }),
    marketIds.length
      ? supabase
          .from("limit_orders")
          .select("market_id, option_id, side, limit_price, quantity, quantity_filled")
          .in("market_id", marketIds)
          .in("status", ["open", "partially_filled"])
      : Promise.resolve({ data: [] as OpenOrderRow[] }),
  ]);

  const options = (optionsData ?? []) as OptionRow[];
  const trades = (tradesData ?? []) as TradeRow[];
  const positions = (positionsData ?? []) as PositionRow[];
  const openOrders = (openOrdersData ?? []) as OpenOrderRow[];

  const optionsByMarket = new Map<string, OptionRow[]>();
  for (const opt of options) {
    const list = optionsByMarket.get(opt.market_id) ?? [];
    list.push(opt);
    optionsByMarket.set(opt.market_id, list);
  }
  optionsByMarket.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order));

  const volumeByMarket = new Map<string, number>();
  const lastPriceByOption = new Map<string, number>();
  for (const tr of trades) {
    volumeByMarket.set(tr.market_id, (volumeByMarket.get(tr.market_id) ?? 0) + (tr.notional ?? 0));
    if (!lastPriceByOption.has(tr.option_id)) {
      lastPriceByOption.set(tr.option_id, tr.price);
    }
  }

  const positionQtyByOption = new Map<string, number>();
  for (const pos of positions) {
    positionQtyByOption.set(pos.option_id, (positionQtyByOption.get(pos.option_id) ?? 0) + Number(pos.quantity ?? 0));
  }

  const bestBidByOption = new Map<string, number>();
  const bestAskByOption = new Map<string, number>();
  for (const order of openOrders) {
    const remaining = Math.max(0, Number(order.quantity) - Number(order.quantity_filled));
    if (remaining <= 0) continue;

    if (order.side === "buy") {
      const current = bestBidByOption.get(order.option_id);
      if (current === undefined || order.limit_price > current) {
        bestBidByOption.set(order.option_id, order.limit_price);
      }
    } else {
      const current = bestAskByOption.get(order.option_id);
      if (current === undefined || order.limit_price < current) {
        bestAskByOption.set(order.option_id, order.limit_price);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Mercados</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Explora oportunidades activas y resultados recientes.
          </p>
        </div>
        <Link href="/" className="text-sm text-zinc-600 underline">
          Volver al inicio
        </Link>
      </header>

      {markets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-20 text-center text-sm text-zinc-500">
          No hay mercados publicos disponibles todavia.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {markets.map((market) => {
            const marketOptions = optionsByMarket.get(market.id) ?? [];
            const hybrid = computeHybridProbabilities({
              optionIds: marketOptions.map((opt) => opt.id),
              liquidityB: Number(market.liquidity_b ?? 100),
              positionQtyByOption,
              lastTradePriceByOption: lastPriceByOption,
              bestBidByOption,
              bestAskByOption,
            });

            return (
              <Link
                key={market.id}
                href={`/markets/${market.id}`}
                className="rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold leading-snug">{market.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[market.status] ?? STATUS_COLOR.draft}`}
                  >
                    {STATUS_LABEL[market.status] ?? market.status}
                  </span>
                </div>

                <p className="mt-1 text-xs text-zinc-500">
                  {market.category ? `${market.category} · ` : ""}
                  {market.closes_at
                    ? `Cierra ${new Date(market.closes_at).toLocaleDateString("es-DO")}`
                    : "Sin fecha de cierre"}
                </p>

                <div className="mt-4 space-y-2">
                  {marketOptions.slice(0, 3).map((opt) => {
                    const p = hybrid.get(opt.id) ?? (marketOptions.length > 0 ? 1 / marketOptions.length : 0);
                    return (
                      <div key={opt.id} className="flex items-center justify-between text-sm">
                        <span className="truncate pr-3 text-zinc-700">{opt.label}</span>
                        <span className="font-medium text-zinc-900">{formatPct(p)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Volumen total: {formatMoney(volumeByMarket.get(market.id) ?? 0)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
