import Link from "next/link";
import { notFound } from "next/navigation";
import { computeHybridProbabilities } from "@/lib/markets/pricing";
import { createClient } from "@/lib/supabase/server";
import {
  cancelOrderAction,
  placeBuyOrderAction,
  placeSellOrderAction,
} from "@/app/markets/actions";

export const dynamic = "force-dynamic";

type OptionRow = {
  id: string;
  label: string;
  sort_order: number;
};

type TradeRow = {
  id: string;
  option_id: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  notional: number | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  user_id: string;
  option_id: string;
  side: "buy" | "sell";
  status: string;
  limit_price: number;
  quantity: number;
  quantity_filled: number;
  created_at: string;
};

type PositionRow = {
  option_id: string;
  quantity: number;
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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function MarketDetailPublicPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: market } = await supabase
    .from("markets")
    .select("id, title, description, status, category, closes_at, resolved_at, liquidity_b, resolution_option:market_options!markets_resolution_option_id_fkey(label)")
    .eq("id", id)
    .single();

  if (!market) notFound();

  const [{ data: optionsData }, { data: tradesData }, { data: openOrdersData }, { data: positionsData }] = await Promise.all([
    supabase
      .from("market_options")
      .select("id, label, sort_order")
      .eq("market_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("trades")
      .select("id, option_id, side, price, quantity, notional, created_at")
      .eq("market_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("limit_orders")
      .select("id, user_id, option_id, side, status, limit_price, quantity, quantity_filled, created_at")
      .eq("market_id", id)
      .in("status", ["open", "partially_filled"])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("positions")
      .select("option_id, quantity")
      .eq("market_id", id),
  ]);

  const options = (optionsData ?? []) as OptionRow[];
  const trades = (tradesData ?? []) as TradeRow[];
  const openOrders = (openOrdersData ?? []) as OrderRow[];
  const positions = (positionsData ?? []) as PositionRow[];

  const { data: wallet } = session?.user
    ? await supabase
        .from("wallets")
        .select("balance_available")
        .eq("user_id", session.user.id)
        .maybeSingle()
    : { data: null };

  const latestPriceByOption = new Map<string, number>();
  let totalVolume = 0;
  for (const tr of trades) {
    totalVolume += tr.notional ?? 0;
    if (!latestPriceByOption.has(tr.option_id)) {
      latestPriceByOption.set(tr.option_id, tr.price);
    }
  }

  const userOrders = session?.user
    ? openOrders.filter((o) => o.user_id === session.user!.id)
    : [];

  const bidsByOption = new Map<
    string,
    { price: number; remainingQty: number }[]
  >();
  const asksByOption = new Map<
    string,
    { price: number; remainingQty: number }[]
  >();
  for (const order of openOrders) {
    const remainingQty = Math.max(0, order.quantity - order.quantity_filled);
    if (remainingQty <= 0) continue;

    if (order.side === "buy") {
      const bucket = bidsByOption.get(order.option_id) ?? [];
      bucket.push({ price: order.limit_price, remainingQty });
      bidsByOption.set(order.option_id, bucket);
    } else {
      const bucket = asksByOption.get(order.option_id) ?? [];
      bucket.push({ price: order.limit_price, remainingQty });
      asksByOption.set(order.option_id, bucket);
    }
  }

  bidsByOption.forEach((list) =>
    list.sort((a, b) => b.price - a.price || b.remainingQty - a.remainingQty),
  );
  asksByOption.forEach((list) =>
    list.sort((a, b) => a.price - b.price || b.remainingQty - a.remainingQty),
  );

  const positionQtyByOption = new Map<string, number>();
  for (const pos of positions) {
    positionQtyByOption.set(pos.option_id, (positionQtyByOption.get(pos.option_id) ?? 0) + Number(pos.quantity ?? 0));
  }

  const bestBidByOption = new Map<string, number>();
  const bestAskByOption = new Map<string, number>();
  for (const opt of options) {
    const bestBid = bidsByOption.get(opt.id)?.[0]?.price;
    const bestAsk = asksByOption.get(opt.id)?.[0]?.price;
    if (bestBid !== undefined) bestBidByOption.set(opt.id, bestBid);
    if (bestAsk !== undefined) bestAskByOption.set(opt.id, bestAsk);
  }

  const hybridProbabilities = computeHybridProbabilities({
    optionIds: options.map((opt) => opt.id),
    liquidityB: Number(market.liquidity_b ?? 100),
    positionQtyByOption,
    lastTradePriceByOption: latestPriceByOption,
    bestBidByOption,
    bestAskByOption,
  });

  const spreadByOption = new Map<string, { bestBid?: number; bestAsk?: number; spread?: number }>();
  for (const opt of options) {
    const bestBid = bidsByOption.get(opt.id)?.[0]?.price;
    const bestAsk = asksByOption.get(opt.id)?.[0]?.price;
    const spread =
      bestBid !== undefined && bestAsk !== undefined ? Math.max(0, bestAsk - bestBid) : undefined;
    spreadByOption.set(opt.id, { bestBid, bestAsk, spread });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/markets" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Mercados
        </Link>
      </div>

      <header>
        <h1 className="text-3xl font-semibold leading-tight">{market.title}</h1>
        {market.description && (
          <p className="mt-3 max-w-3xl text-sm text-zinc-600">{market.description}</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          {market.category ? `${market.category} · ` : ""}
          Estado: {market.status} · {market.closes_at
            ? `Cierra ${new Date(market.closes_at).toLocaleString("es-DO")}`
            : "Sin fecha de cierre"}
        </p>

        {market.status === "resolved" && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Resultado: <span className="font-semibold">{market.resolution_option?.label ?? "No disponible"}</span>
            {market.resolved_at ? (
              <span className="ml-2 text-xs text-blue-700">
                ({new Date(market.resolved_at).toLocaleString("es-DO")})
              </span>
            ) : null}
          </div>
        )}
      </header>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {decodeURIComponent(success)}
        </div>
      )}

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-medium text-zinc-700">Probabilidades actuales</h2>
          <div className="mt-4 space-y-3">
            {options.map((opt) => {
              const prob = hybridProbabilities.get(opt.id) ?? (options.length > 0 ? 1 / options.length : 0);
              return (
                <div key={opt.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{opt.label}</span>
                    <span className="font-semibold">{formatPct(prob)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-zinc-900"
                      style={{ width: `${Math.max(4, prob * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Volumen reciente: {formatMoney(totalVolume)} · Precio hibrido LMSR + libro + trades
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-medium text-zinc-700">Ultimos trades</h2>
          {trades.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Sin operaciones registradas aun.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {trades.slice(0, 12).map((trade) => {
                const option = options.find((o) => o.id === trade.option_id);
                return (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{option?.label ?? "Opcion"}</p>
                      <p className="text-xs text-zinc-500">
                        {trade.side.toUpperCase()} · {new Date(trade.created_at).toLocaleString("es-DO")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatPct(trade.price)}</p>
                      <p className="text-xs text-zinc-500">Qty {trade.quantity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-medium text-zinc-700">Libro de ordenes</h2>
          {options.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Sin opciones disponibles.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {options.map((opt) => {
                const bids = bidsByOption.get(opt.id) ?? [];
                const asks = asksByOption.get(opt.id) ?? [];
                const spread = spreadByOption.get(opt.id);
                return (
                  <div key={opt.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Bid {spread?.bestBid !== undefined ? formatPct(spread.bestBid) : "—"} · Ask {spread?.bestAsk !== undefined ? formatPct(spread.bestAsk) : "—"} · Spread {spread?.spread !== undefined ? formatPct(spread.spread) : "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-emerald-700">Bids</p>
                        {bids.length === 0 ? (
                          <p className="text-xs text-zinc-400">Sin bids activos.</p>
                        ) : (
                          <div className="space-y-1">
                            {bids.slice(0, 3).map((bid, idx) => (
                              <div
                                key={`${opt.id}-bid-${idx}`}
                                className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-xs"
                              >
                                <span className="font-medium text-emerald-800">{formatPct(bid.price)}</span>
                                <span className="text-emerald-700">Qty {bid.remainingQty.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-medium text-amber-700">Asks</p>
                        {asks.length === 0 ? (
                          <p className="text-xs text-zinc-400">Sin asks activos.</p>
                        ) : (
                          <div className="space-y-1">
                            {asks.slice(0, 3).map((ask, idx) => (
                              <div
                                key={`${opt.id}-ask-${idx}`}
                                className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-xs"
                              >
                                <span className="font-medium text-amber-800">{formatPct(ask.price)}</span>
                                <span className="text-amber-700">Qty {ask.remainingQty.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {session?.user && (
        <section className="mt-8 rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-medium text-zinc-700">Mis ordenes activas en este mercado</h2>
          {userOrders.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No tienes ordenes abiertas aqui.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-3">Opcion</th>
                    <th className="py-2 pr-3">Lado</th>
                    <th className="py-2 pr-3">Precio</th>
                    <th className="py-2 pr-3">Restante</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {userOrders.map((order) => {
                    const option = options.find((o) => o.id === order.option_id);
                    const remaining = Math.max(0, order.quantity - order.quantity_filled);
                    return (
                      <tr key={order.id} className="border-b border-zinc-50">
                        <td className="py-2 pr-3">{option?.label ?? "Opcion"}</td>
                        <td className="py-2 pr-3 uppercase">{order.side}</td>
                        <td className="py-2 pr-3">{formatPct(order.limit_price)}</td>
                        <td className="py-2 pr-3">{remaining.toFixed(2)}</td>
                        <td className="py-2 pr-3">{order.status}</td>
                        <td className="py-2 pr-3">
                          <form action={cancelOrderAction}>
                            <input type="hidden" name="order_id" value={order.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100"
                            >
                              Cancelar
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="mt-8 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-medium text-zinc-700">Enviar orden limit (compra)</h2>

        {session?.user ? (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              Balance disponible: {formatMoney(wallet?.balance_available ?? 0)}
            </p>

            <form action={placeBuyOrderAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
              <input type="hidden" name="market_id" value={market.id} />

              <select
                name="option_id"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              >
                <option value="">Selecciona opcion</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="limit_price"
                min="0.001"
                max="1"
                step="0.001"
                required
                placeholder="Precio (0-1)"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />

              <input
                type="number"
                name="quantity"
                min="1"
                step="1"
                required
                placeholder="Cantidad"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />

              <button
                type="submit"
                disabled={market.status !== "open"}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Comprar
              </button>
            </form>

            <p className="mt-3 text-xs text-zinc-500">
              Nota: las probabilidades mostradas usan un modelo hibrido (LMSR, libro y trades recientes).
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            Para operar, inicia sesion. <Link href="/auth/login" className="underline">Entrar</Link>
          </p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-medium text-zinc-700">Enviar orden limit (venta)</h2>

        {session?.user ? (
          <>
            <p className="mt-2 text-xs text-zinc-500">
              Requiere posicion disponible en la opcion seleccionada.
            </p>

            <form action={placeSellOrderAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
              <input type="hidden" name="market_id" value={market.id} />

              <select
                name="option_id"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              >
                <option value="">Selecciona opcion</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="limit_price"
                min="0.001"
                max="1"
                step="0.001"
                required
                placeholder="Precio (0-1)"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />

              <input
                type="number"
                name="quantity"
                min="1"
                step="1"
                required
                placeholder="Cantidad"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />

              <button
                type="submit"
                disabled={market.status !== "open"}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                Vender
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            Para operar, inicia sesion. <Link href="/auth/login" className="underline">Entrar</Link>
          </p>
        )}
      </section>
    </main>
  );
}
