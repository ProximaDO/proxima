import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { labelMarketStatus } from "@/lib/ui/labels-es-do";

export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const now = new Date();

  const date30d = new Date(now);
  date30d.setDate(date30d.getDate() - 30);
  const since30d = date30d.toISOString();

  const date14d = new Date(now);
  date14d.setDate(date14d.getDate() - 13);
  const since14d = date14d.toISOString();

  const [
    { data: markets },
    { data: orders30d },
    { data: trades30d },
    { data: movements30d },
    { data: pendingWithdrawals },
    { data: kycRows },
  ] = await Promise.all([
    supabase
      .from("markets")
      .select("id, title, status, category, closes_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("limit_orders")
      .select("id, user_id, market_id, status, quantity, quantity_filled, created_at")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("trades")
      .select("id, market_id, quantity, price, notional, created_at")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("wallet_movements")
      .select("movement_type, amount, created_at")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("withdrawal_requests")
      .select("id, amount, status, requested_at")
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: true })
      .limit(1000),
    supabase
      .from("kyc_verifications")
      .select("status")
      .limit(5000),
  ]);

  const marketRows = (markets ?? []) as {
    id: string;
    title: string;
    status: string;
    category: string | null;
    closes_at: string | null;
    created_at: string;
  }[];

  const orderRows = (orders30d ?? []) as {
    id: string;
    user_id: string;
    market_id: string;
    status: string;
    quantity: number;
    quantity_filled: number;
    created_at: string;
  }[];

  const tradeRows = (trades30d ?? []) as {
    id: string;
    market_id: string;
    quantity: number;
    price: number;
    notional: number | null;
    created_at: string;
  }[];

  const movementRows = (movements30d ?? []) as {
    movement_type: string;
    amount: number;
    created_at: string;
  }[];

  const pendingWithdrawalRows = (pendingWithdrawals ?? []) as {
    id: string;
    amount: number;
    status: "pending" | "processing";
    requested_at: string;
  }[];

  const kycStatusRows = (kycRows ?? []) as { status: string }[];

  const totalMarkets = marketRows.length;
  const openMarkets = marketRows.filter((market) => market.status === "open").length;
  const resolvedMarkets = marketRows.filter((market) => market.status === "resolved").length;

  const uniqueTraders30d = new Set(orderRows.map((order) => order.user_id)).size;
  const predictions30d = orderRows.length;
  const totalOrderQty30d = orderRows.reduce((acc, row) => acc + Number(row.quantity ?? 0), 0);
  const totalOrderFilledQty30d = orderRows.reduce((acc, row) => acc + Number(row.quantity_filled ?? 0), 0);
  const fillRate30d = totalOrderQty30d > 0 ? totalOrderFilledQty30d / totalOrderQty30d : 0;

  const tradedVolume30d = tradeRows.reduce(
    (acc, row) => acc + Number(row.notional ?? Number(row.price ?? 0) * Number(row.quantity ?? 0)),
    0,
  );

  const deposits30d = movementRows
    .filter((row) => row.movement_type === "deposit")
    .reduce((acc, row) => acc + Math.max(0, Number(row.amount ?? 0)), 0);

  const withdrawals30d = movementRows
    .filter((row) => row.movement_type === "withdrawal_approved")
    .reduce((acc, row) => acc + Math.abs(Number(row.amount ?? 0)), 0);

  const netCashflow30d = deposits30d - withdrawals30d;

  const pendingWithdrawalsCount = pendingWithdrawalRows.length;
  const pendingWithdrawalsAmount = pendingWithdrawalRows.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
  const kycQueue = kycStatusRows.filter((row) => ["pending", "submitted", "requires_input"].includes(row.status)).length;

  const marketById = new Map(marketRows.map((market) => [market.id, market]));
  const marketAgg = new Map<
    string,
    {
      predictions: number;
      orderQty: number;
      orderFilledQty: number;
      tradedVolume: number;
      lastActivityAt: string;
    }
  >();

  for (const order of orderRows) {
    const current = marketAgg.get(order.market_id) ?? {
      predictions: 0,
      orderQty: 0,
      orderFilledQty: 0,
      tradedVolume: 0,
      lastActivityAt: order.created_at,
    };

    current.predictions += 1;
    current.orderQty += Number(order.quantity ?? 0);
    current.orderFilledQty += Number(order.quantity_filled ?? 0);
    if (new Date(order.created_at).getTime() > new Date(current.lastActivityAt).getTime()) {
      current.lastActivityAt = order.created_at;
    }

    marketAgg.set(order.market_id, current);
  }

  for (const trade of tradeRows) {
    const current = marketAgg.get(trade.market_id) ?? {
      predictions: 0,
      orderQty: 0,
      orderFilledQty: 0,
      tradedVolume: 0,
      lastActivityAt: trade.created_at,
    };

    current.tradedVolume += Number(trade.notional ?? Number(trade.price ?? 0) * Number(trade.quantity ?? 0));
    if (new Date(trade.created_at).getTime() > new Date(current.lastActivityAt).getTime()) {
      current.lastActivityAt = trade.created_at;
    }

    marketAgg.set(trade.market_id, current);
  }

  const topMarkets = Array.from(marketAgg.entries())
    .map(([marketId, stats]) => ({
      marketId,
      market: marketById.get(marketId),
      ...stats,
      fillRate: stats.orderQty > 0 ? stats.orderFilledQty / stats.orderQty : 0,
    }))
    .sort((a, b) => {
      if (b.predictions !== a.predictions) return b.predictions - a.predictions;
      return b.tradedVolume - a.tradedVolume;
    })
    .slice(0, 8);

  const categoryAgg = new Map<
    string,
    {
      marketCount: number;
      openCount: number;
      resolvedCount: number;
      predictions: number;
      tradedVolume: number;
    }
  >();

  for (const market of marketRows) {
    const category = market.category ?? "Sin categoria";
    const current = categoryAgg.get(category) ?? {
      marketCount: 0,
      openCount: 0,
      resolvedCount: 0,
      predictions: 0,
      tradedVolume: 0,
    };

    current.marketCount += 1;
    if (market.status === "open") current.openCount += 1;
    if (market.status === "resolved") current.resolvedCount += 1;

    categoryAgg.set(category, current);
  }

  for (const [marketId, stats] of marketAgg.entries()) {
    const category = marketById.get(marketId)?.category ?? "Sin categoria";
    const current = categoryAgg.get(category);
    if (!current) continue;
    current.predictions += stats.predictions;
    current.tradedVolume += stats.tradedVolume;
    categoryAgg.set(category, current);
  }

  const categoryRows = Array.from(categoryAgg.entries())
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.predictions - a.predictions)
    .slice(0, 6);

  const dayBuckets = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(date14d);
    day.setDate(date14d.getDate() + index);
    return {
      key: dayKey(day),
      label: day.toLocaleDateString("es-DO", { month: "2-digit", day: "2-digit" }),
      deposits: 0,
      withdrawals: 0,
      net: 0,
    };
  });

  const dayMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  for (const movement of movementRows) {
    if (new Date(movement.created_at).getTime() < new Date(since14d).getTime()) continue;
    const key = dayKey(movement.created_at);
    const bucket = dayMap.get(key);
    if (!bucket) continue;
    const amount = Number(movement.amount ?? 0);

    if (movement.movement_type === "deposit") {
      bucket.deposits += Math.max(0, amount);
    }

    if (movement.movement_type === "withdrawal_approved") {
      bucket.withdrawals += Math.abs(amount);
    }

    bucket.net = bucket.deposits - bucket.withdrawals;
  }

  const maxCashflowDay = Math.max(
    1,
    ...dayBuckets.map((bucket) => Math.max(bucket.deposits, bucket.withdrawals, Math.abs(bucket.net))),
  );

  const operationalTag =
    pendingWithdrawalsCount > 25 || kycQueue > 40
      ? "Carga alta"
      : pendingWithdrawalsCount > 10 || kycQueue > 20
        ? "Carga moderada"
        : "Monitoreo activo";

  const operationalSignals = [
    {
      label: "Cola de retiros",
      value: pendingWithdrawalsCount,
      detail: `${formatMoney(pendingWithdrawalsAmount)} en proceso`,
      pct: Math.min(100, (pendingWithdrawalsCount / 30) * 100),
      tone: pendingWithdrawalsCount > 20 ? "bg-red-300" : pendingWithdrawalsCount > 10 ? "bg-amber-300" : "bg-emerald-300",
    },
    {
      label: "Cola KYC",
      value: kycQueue,
      detail: "Solicitudes por revisar",
      pct: Math.min(100, (kycQueue / 40) * 100),
      tone: kycQueue > 25 ? "bg-red-300" : kycQueue > 12 ? "bg-amber-300" : "bg-emerald-300",
    },
    {
      label: "Ejecucion de ordenes",
      value: Number((fillRate30d * 100).toFixed(1)),
      detail: "Fill rate 30d",
      pct: Math.min(100, Math.max(0, fillRate30d * 100)),
      tone: fillRate30d >= 0.6 ? "bg-emerald-300" : fillRate30d >= 0.3 ? "bg-amber-300" : "bg-red-300",
    },
    {
      label: "Flujo neto",
      value: Number(netCashflow30d.toFixed(0)),
      detail: netCashflow30d >= 0 ? "Balance positivo" : "Balance negativo",
      pct: Math.min(100, Math.max(0, (netCashflow30d / Math.max(1, deposits30d)) * 100 + 50)),
      tone: netCashflow30d >= 0 ? "bg-emerald-300" : "bg-red-300",
    },
  ];

  return (
    <main className="admin-fade-in flex flex-col gap-6">
      <header className="admin-card px-6 py-5">
        <h1 className="font-(family-name:--font-display) text-4xl font-extrabold tracking-tight">
          Panel administrativo
        </h1>
        <p className="mt-2 text-sm text-white/65">Sesion activa: {user.email}</p>
        <p className="mt-1 text-xs text-white/45">Analitica de ultimos 30 dias (actividad de mercados y flujo economico).</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/markets"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Mercados"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Mercados totales</p>
          <p className="mt-2 text-4xl font-extrabold text-white">{totalMarkets ?? 0}</p>
          <p className="mt-1 text-xs text-white/55">Resueltos: {resolvedMarkets}</p>
        </Link>
        <Link
          href="/admin/markets"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Mercados"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Mercados abiertos</p>
          <p className="mt-2 text-4xl font-extrabold text-emerald-300">{openMarkets}</p>
          <p className="mt-1 text-xs text-white/55">En oferta activa ahora mismo</p>
        </Link>
        <Link
          href="/admin/users"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Usuarios"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Traders activos (30d)</p>
          <p className="mt-2 text-4xl font-extrabold text-[#83c9ff]">{uniqueTraders30d}</p>
          <p className="mt-1 text-xs text-white/55">Usuarios con al menos una prediccion</p>
        </Link>
        <Link
          href="/admin/markets"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Mercados"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Predicciones (30d)</p>
          <p className="mt-2 text-4xl font-extrabold text-white">{formatCompact(predictions30d)}</p>
          <p className="mt-1 text-xs text-white/55">Tasa de ejecucion: {(fillRate30d * 100).toFixed(1)}%</p>
        </Link>
        <Link
          href="/admin/markets"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Mercados"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Volumen transado (30d)</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-300">{formatMoney(tradedVolume30d)}</p>
          <p className="mt-1 text-xs text-white/55">Notional total en trades ejecutados</p>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="admin-card block p-5 transition hover:border-white/30 hover:bg-white/8"
          title="Ir a Retiros"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Flujo neto caja (30d)</p>
          <p className={`mt-2 text-3xl font-extrabold ${netCashflow30d >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {netCashflow30d >= 0 ? "+" : ""}
            {formatMoney(netCashflow30d)}
          </p>
          <p className="mt-1 text-xs text-white/55">
            Depositos: {formatMoney(deposits30d)} · Retiros aprobados: {formatMoney(withdrawals30d)}
          </p>
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="admin-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Flujo de caja diario (14 dias)</h2>
            <p className="text-xs text-white/55">Depositos, retiros aprobados y neto</p>
          </div>

          <div className="mt-4 space-y-3">
            {dayBuckets.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                  <span>{bucket.label}</span>
                  <span>
                    Neto: {bucket.net >= 0 ? "+" : ""}
                    {formatMoney(bucket.net)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-linear-to-r from-[#65bfff] to-[#7f30de]"
                    style={{ width: `${Math.max(6, (bucket.deposits / maxCashflowDay) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5">
                  <div
                    className="h-1.5 rounded-full bg-linear-to-r from-[#ff6a41] to-[#f5a24f]"
                    style={{ width: `${Math.max(6, (bucket.withdrawals / maxCashflowDay) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/5">
                  <div
                    className={`h-1 rounded-full ${bucket.net >= 0 ? "bg-emerald-300" : "bg-red-300"}`}
                    style={{ width: `${Math.max(6, (Math.abs(bucket.net) / maxCashflowDay) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                  <span>Depositos: {formatCompact(bucket.deposits)} DOP</span>
                  <span>Retiros: {formatCompact(bucket.withdrawals)} DOP</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card p-5">
          <h2 className="text-lg font-bold text-white">Salud operativa</h2>
          <p className="mt-1 text-xs text-white/55">Cola administrativa y cumplimiento</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">Retiros en cola</p>
              <p className="mt-2 text-2xl font-extrabold text-white">{pendingWithdrawalsCount}</p>
              <p className="mt-1 text-xs text-white/55">Monto: {formatMoney(pendingWithdrawalsAmount)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">KYC pendientes</p>
              <p className="mt-2 text-2xl font-extrabold text-white">{kycQueue}</p>
              <p className="mt-1 text-xs text-white/55">Estado general: {operationalTag}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/3 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-white/50">Pulso operativo</p>
              <p className="text-[11px] text-white/45">Indicadores de carga y ejecucion</p>
            </div>
            <div className="space-y-3">
              {operationalSignals.map((signal) => (
                <div key={signal.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-white/65">
                    <span>{signal.label}</span>
                    <span>
                      {signal.label === "Flujo neto" ? formatMoney(signal.value) : signal.value}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className={`h-1.5 rounded-full ${signal.tone}`}
                      style={{ width: `${Math.max(8, signal.pct)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="admin-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Mercados con mas predicciones (30d)</h2>
          <Link href="/admin/markets" className="admin-btn-muted">
            Ver todos
          </Link>
        </div>

        {topMarkets.length === 0 ? (
          <p className="mt-4 text-sm text-white/60">Sin actividad suficiente en los ultimos 30 dias.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {topMarkets.map((row, index) => (
              <div key={row.marketId} className="rounded-xl border border-white/10 bg-white/4 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/45">#{index + 1}</p>
                    <p className="truncate text-sm font-semibold text-white">{row.market?.title ?? `Mercado ${row.marketId.slice(0, 8)}...`}</p>
                    <p className="mt-1 text-xs text-white/55">
                      {(row.market?.category ?? "Sin categoria")} · {labelMarketStatus(row.market?.status ?? "draft")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-right text-xs text-white/70 sm:grid-cols-4">
                    <div>
                      <p className="text-white/45">Predicciones</p>
                      <p className="font-semibold text-white">{row.predictions}</p>
                    </div>
                    <div>
                      <p className="text-white/45">Volumen</p>
                      <p className="font-semibold text-white">{formatCompact(row.tradedVolume)}</p>
                    </div>
                    <div>
                      <p className="text-white/45">Fill rate</p>
                      <p className="font-semibold text-white">{(row.fillRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-white/45">Ult. actividad</p>
                      <p className="font-semibold text-white">{new Date(row.lastActivityAt).toLocaleDateString("es-DO")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card p-5">
        <h2 className="text-lg font-bold text-white">Rendimiento por categoria (30d)</h2>
        <p className="mt-1 text-xs text-white/55">Comparativo de oferta y demanda por vertical de mercado.</p>

        {categoryRows.length === 0 ? (
          <p className="mt-4 text-sm text-white/60">No hay categorias con datos para analizar.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {categoryRows.map((row) => {
              const width = predictions30d > 0 ? (row.predictions / Math.max(1, predictions30d)) * 100 : 0;
              return (
                <div key={row.category} className="rounded-xl border border-white/10 bg-white/4 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/65">
                    <span className="font-semibold text-white">{row.category}</span>
                    <span>
                      Mercados: {row.marketCount} · Abiertos: {row.openCount} · Resueltos: {row.resolvedCount}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-[#65bfff] to-[#7f30de]"
                      style={{ width: `${Math.max(8, width)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/65">
                    <span>Predicciones: {row.predictions}</span>
                    <span>Volumen: {formatMoney(row.tradedVolume)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/markets"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/8"
        >
          <div>
            <p className="text-lg font-bold text-white">Mercados</p>
            <p className="mt-0.5 text-sm text-white/60">Crear, editar y gestionar mercados</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/8"
        >
          <div>
            <p className="text-lg font-bold text-white">Retiros</p>
            <p className="mt-0.5 text-sm text-white/60">Revisar y procesar solicitudes pendientes</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
        <Link
          href="/admin/site"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/8"
        >
          <div>
            <p className="text-lg font-bold text-white">Configuracion</p>
            <p className="mt-0.5 text-sm text-white/60">Landing, seguridad y administradores</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
        <Link
          href="/admin/users"
          className="admin-card flex items-center justify-between p-5 transition hover:border-white/30 hover:bg-white/8"
        >
          <div>
            <p className="text-lg font-bold text-white">Usuarios</p>
            <p className="mt-0.5 text-sm text-white/60">Editar, balance, KYC y eliminación</p>
          </div>
          <span className="text-xl text-white/55">→</span>
        </Link>
      </nav>

      <section className="admin-empty">
        <p className="text-sm font-semibold text-white/85">Centro de operaciones</p>
        <p className="mt-1 text-sm text-white/60">
          Desde aqui puedes publicar mercados, resolver resultados y mantener la salud economica de la plataforma con indicadores de actividad y flujo.
        </p>
      </section>
    </main>
  );
}
