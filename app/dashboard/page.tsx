import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { cancelOrderAction } from "@/app/markets/actions";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  requestWithdrawalAction,
} from "@/app/dashboard/actions";
import { requireNonAdmin } from "@/lib/auth/server";
import {
  labelNotificationEvent,
  labelMovementType,
  labelNotificationStatus,
  labelOrderSide,
  labelOrderStatus,
  labelTradeRole,
  labelWithdrawalStatus,
} from "@/lib/ui/labels-es-do";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return values
    .map((value, idx) => {
      const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildNotificationSummary(
  eventType:
    | "trade_fill"
    | "order_cancelled"
    | "market_closed"
    | "market_resolved"
    | "withdrawal_approved"
    | "withdrawal_rejected",
  payload: Record<string, unknown>,
) {
  if (eventType === "trade_fill") {
    const market = String(payload.market_title ?? "Mercado");
    const option = String(payload.option_label ?? "Opcion");
    const sideRaw = String(payload.side ?? "buy").toLowerCase();
    const side = sideRaw === "sell" ? labelOrderSide("sell") : labelOrderSide("buy");
    const qty = Number(payload.quantity ?? 0).toFixed(2);
    return `${market} · ${option} · ${side} · Cant. ${qty}`;
  }

  if (eventType === "order_cancelled") {
    const market = String(payload.market_title ?? "Mercado");
    const option = String(payload.option_label ?? "Opcion");
    return `${market} · ${option} · Prediccion cancelada`;
  }

  const market = String(payload.market_title ?? "Mercado");
  if (eventType === "market_closed") {
    return `${market} · Mercado cerrado`;
  }

  if (eventType === "withdrawal_approved") {
    const amount = Number(payload.amount ?? 0);
    return `Retiro aprobado · ${formatMoney(amount)}`;
  }

  if (eventType === "withdrawal_rejected") {
    const amount = Number(payload.amount ?? 0);
    const reason = String(payload.rejection_reason ?? "Sin motivo especificado");
    return `Retiro rechazado · ${formatMoney(amount)} · ${reason}`;
  }

  const winner = String(payload.winning_option_label ?? "Opcion ganadora");
  return `${market} · Resuelto · ${winner}`;
}

interface Props {
  searchParams: Promise<{
    error?: string;
    success?: string;
    notifications?: "all" | "unread";
    notificationType?: "all" | "trading" | "markets" | "withdrawals";
    notificationsPage?: string;
    resolvedStatus?: "all" | "won" | "lost";
  }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const {
    error,
    success,
    notifications: notificationsFilterRaw,
    notificationType: notificationTypeRaw,
    notificationsPage: notificationsPageRaw,
    resolvedStatus: resolvedStatusRaw,
  } = await searchParams;
  const user = await requireNonAdmin();
  const supabase = await createClient();
  const notificationsFilter = notificationsFilterRaw === "unread" ? "unread" : "all";
  const notificationTypeFilter =
    notificationTypeRaw === "trading" ||
    notificationTypeRaw === "markets" ||
    notificationTypeRaw === "withdrawals"
      ? notificationTypeRaw
      : "all";
  const resolvedStatusFilter =
    resolvedStatusRaw === "won" ||
    resolvedStatusRaw === "lost"
      ? resolvedStatusRaw
      : "all";
  const notificationsPage = Math.max(1, Number.parseInt(notificationsPageRaw ?? "1", 10) || 1);
  const notificationsPageSize = 10;
  const notificationsFrom = (notificationsPage - 1) * notificationsPageSize;
  const notificationsTo = notificationsFrom + notificationsPageSize - 1;

  const [
    { data: wallet },
    { data: ordersData },
    { data: movementsData },
    { data: withdrawalRules },
    { data: withdrawalsData },
    { data: positionsData },
    { data: tradesData },
    { data: resolvedNotificationsData },
    { data: resolutionPayoutsData },
    { data: kycData },
    { data: bankAccountsData },
  ] = await Promise.all([
    supabase
      .from("wallets")
      .select("balance_available, balance_locked")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("limit_orders")
      .select(
        "id, status, side, limit_price, quantity, quantity_filled, created_at, market:markets(title), option:market_options(label)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_movements")
      .select("id, movement_type, amount, balance_after, market_id, order_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("withdrawal_rules")
      .select("min_amount, max_amount, max_per_day, max_per_month, cooldown_days, min_processing_days")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("withdrawal_requests")
      .select("id, amount, status, admin_note, rejection_reason, requested_at, reviewed_at, processed_at")
      .eq("user_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(20),
    supabase
      .from("positions")
      .select("id, quantity, avg_entry_price, realized_pnl, market:markets(title), option:market_options(label)")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("trades")
      .select("id, side, price, quantity, notional, created_at, maker_user_id, taker_user_id, market:markets(title), option:market_options(label)")
      .or(`maker_user_id.eq.${user.id},taker_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notification_events")
      .select("id, payload, created_at")
      .eq("event_type", "market_resolved")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("wallet_movements")
      .select("id, market_id, amount, metadata, created_at")
      .eq("user_id", user.id)
      .eq("movement_type", "payout")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("kyc_verifications")
      .select("status, verified_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bank_accounts")
      .select("id, bank_name, account_last4, is_primary")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(5),
  ]);

  const notificationsCountQuery = supabase
    .from("notification_events")
    .select("id", { count: "exact", head: true });

  const notificationsDataQuery = supabase
    .from("notification_events")
    .select("id, event_type, payload, status, read_at, created_at")
    .order("created_at", { ascending: false })
    .range(notificationsFrom, notificationsTo);

  const notificationTypesByFilter: Record<
    "trading" | "markets" | "withdrawals",
    Array<
      | "trade_fill"
      | "order_cancelled"
      | "market_closed"
      | "market_resolved"
      | "withdrawal_approved"
      | "withdrawal_rejected"
    >
  > = {
    trading: ["trade_fill", "order_cancelled"],
    markets: ["market_closed", "market_resolved"],
    withdrawals: ["withdrawal_approved", "withdrawal_rejected"],
  };

  if (notificationsFilter === "unread") {
    notificationsCountQuery.is("read_at", null);
    notificationsDataQuery.is("read_at", null);
  }

  if (notificationTypeFilter !== "all") {
    const eventTypes = notificationTypesByFilter[notificationTypeFilter];
    notificationsCountQuery.in("event_type", eventTypes);
    notificationsDataQuery.in("event_type", eventTypes);
  }

  const [{ count: notificationsTotalCount }, { data: notificationsData }] = await Promise.all([
    notificationsCountQuery,
    notificationsDataQuery,
  ]);

  const isAdminUser = false;

  type OrderRow = {
    id: string;
    status: string;
    side: "buy" | "sell";
    limit_price: number;
    quantity: number;
    quantity_filled: number;
    created_at: string;
    market: { title: string } | null;
    option: { label: string } | null;
  };

  const orders = (ordersData ?? []) as unknown as OrderRow[];
  const movements = (movementsData ?? []) as {
    id: string;
    movement_type: string;
    amount: number;
    balance_after: number | null;
    market_id: string | null;
    order_id: string | null;
    created_at: string;
  }[];
  const positions = (positionsData ?? []) as {
    id: string;
    quantity: number;
    avg_entry_price: number;
    realized_pnl: number;
    market: { title: string } | null;
    option: { label: string } | null;
  }[];
  const withdrawals = (withdrawalsData ?? []) as {
    id: string;
    amount: number;
    status: "pending" | "approved" | "rejected" | "processing" | "completed" | "failed";
    admin_note: string | null;
    rejection_reason: string | null;
    requested_at: string;
    reviewed_at: string | null;
    processed_at: string | null;
  }[];
  const trades = (tradesData ?? []) as {
    id: string;
    side: "buy" | "sell";
    price: number;
    quantity: number;
    notional: number | null;
    created_at: string;
    maker_user_id: string | null;
    taker_user_id: string | null;
    market: { title: string } | null;
    option: { label: string } | null;
  }[];
  const notificationsRaw = (notificationsData ?? []) as {
    id: string;
    event_type:
      | "trade_fill"
      | "order_cancelled"
      | "market_closed"
      | "market_resolved"
      | "withdrawal_approved"
      | "withdrawal_rejected";
    payload: Record<string, unknown>;
    status: "pending" | "sent" | "failed";
    read_at: string | null;
    created_at: string;
  }[];
  const resolvedNotifications = (resolvedNotificationsData ?? []) as {
    id: string;
    payload: Record<string, unknown>;
    created_at: string;
  }[];
  const resolutionPayouts = (resolutionPayoutsData ?? []) as {
    id: string;
    market_id: string | null;
    amount: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }[];
  const notifications = notificationsRaw.filter((n) => {
    const suppressed = Boolean(n.payload?.notification_suppressed);
    if (suppressed) return false;

    return true;
  });

  const notificationsTotalPages = Math.max(1, Math.ceil((notificationsTotalCount ?? 0) / notificationsPageSize));
  const safeNotificationsPage = Math.min(notificationsPage, notificationsTotalPages);
  const notificationsHasPrev = safeNotificationsPage > 1;
  const notificationsHasNext = safeNotificationsPage < notificationsTotalPages;
  const notificationsContextUrl = `/dashboard?notifications=${notificationsFilter}&notificationType=${notificationTypeFilter}&notificationsPage=${safeNotificationsPage}#notificaciones`;
  const unreadNotifications = notifications.filter((n) => n.read_at === null).length;
  const unreadBadge = unreadNotifications > 99 ? "99+" : String(unreadNotifications);
  const openOrders = orders.filter((o) => o.status === "open" || o.status === "partially_filled");

  const resolutionPayoutByMarket = new Map<string, number>();
  for (const movement of resolutionPayouts) {
    if (!movement.market_id) continue;
    const reason = String(movement.metadata?.reason ?? "");
    if (reason !== "market_resolution_payout") continue;

    resolutionPayoutByMarket.set(
      movement.market_id,
      (resolutionPayoutByMarket.get(movement.market_id) ?? 0) + movement.amount,
    );
  }

  const resolvedMarketMap = new Map<
    string,
    { marketTitle: string; winner: string; resolvedAt: string; resolutionStatus: string }
  >();
  for (const notification of resolvedNotifications) {
    const marketId = String(notification.payload.market_id ?? "");
    if (!marketId || resolvedMarketMap.has(marketId)) continue;

    resolvedMarketMap.set(marketId, {
      marketTitle: String(notification.payload.market_title ?? "Mercado"),
      winner: String(notification.payload.winning_option_label ?? "Opcion ganadora"),
      resolvedAt: String(notification.payload.resolved_at ?? notification.created_at),
      resolutionStatus: String(notification.payload.resolution_status ?? "unknown"),
    });
  }

  const resolvedMarkets = Array.from(resolvedMarketMap.entries()).map(([marketId, item]) => ({
    marketId,
    marketTitle: item.marketTitle,
    winner: item.winner,
    resolvedAt: item.resolvedAt,
    payout: resolutionPayoutByMarket.get(marketId) ?? 0,
    resolutionStatus: item.resolutionStatus,
  }));
  const filteredResolvedMarkets =
    resolvedStatusFilter === "all"
      ? resolvedMarkets
      : resolvedMarkets.filter((market) => market.resolutionStatus === resolvedStatusFilter);
  const totalResolutionPayout = resolvedMarkets.reduce((acc, market) => acc + market.payout, 0);
  const filteredResolutionPayout = filteredResolvedMarkets.reduce((acc, market) => acc + market.payout, 0);

  const openNotional = openOrders.reduce((acc, order) => {
    const remainingQty = Math.max(0, order.quantity - order.quantity_filled);
    return acc + remainingQty * order.limit_price;
  }, 0);

  const availableBalance = wallet?.balance_available ?? 0;
  const lockedBalance = wallet?.balance_locked ?? 0;
  const totalEquity = availableBalance + lockedBalance;
  const liquidityRatio = totalEquity > 0 ? availableBalance / totalEquity : 0;

  const positionPalette = [
    "#18181b",
    "#2563eb",
    "#0891b2",
    "#059669",
    "#d97706",
    "#dc2626",
    "#7c3aed",
  ];

  const positionExposure = positions
    .map((position, idx) => ({
      id: position.id,
      label: `${position.market?.title ?? "Mercado"} · ${position.option?.label ?? "Opcion"}`,
      exposure: Math.max(0, position.quantity * position.avg_entry_price),
      realizedPnl: position.realized_pnl,
      color: positionPalette[idx % positionPalette.length],
    }))
    .filter((position) => position.exposure > 0);

  const totalExposure = positionExposure.reduce((acc, position) => acc + position.exposure, 0);
  const portfolioSlices =
    totalExposure > 0
      ? positionExposure.map((position) => ({
          ...position,
          weight: position.exposure / totalExposure,
        }))
      : [];

  const topExposure =
    positionExposure.length > 0
      ? [...positionExposure].sort((a, b) => b.exposure - a.exposure)[0]
      : null;

  const realizedPnlTotal = positions.reduce((acc, position) => acc + position.realized_pnl, 0);
  const movementSeries = movements
    .filter((movement) => movement.balance_after !== null)
    .slice()
    .reverse()
    .map((movement) => Number(movement.balance_after ?? 0));
  const equitySeries = movementSeries.length > 1 ? movementSeries : [availableBalance, totalEquity];
  const equityTrendPath = buildSparklinePath(equitySeries, 360, 120);

  let sliceOffset = 0;
  const exposureRing =
    portfolioSlices.length > 0
      ? `conic-gradient(${portfolioSlices
          .map((slice) => {
            const start = sliceOffset;
            const end = sliceOffset + slice.weight * 100;
            sliceOffset = end;
            return `${slice.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
          })
          .join(", ")})`
      : "conic-gradient(#e4e4e7 0% 100%)";

  const referenceTimeMs = movements.length > 0 ? new Date(movements[0].created_at).getTime() : 0;
  const sevenDaysAgoMs = referenceTimeMs - 7 * 24 * 60 * 60 * 1000;
  const recentCashflow = movements
    .filter((movement) => {
      const movementTimeMs = new Date(movement.created_at).getTime();
      return movementTimeMs <= referenceTimeMs && movementTimeMs >= sevenDaysAgoMs;
    })
    .reduce((acc, movement) => acc + movement.amount, 0);

  return (
    <main className="user-theme user-dashboard relative min-h-screen bg-[#040b2f] text-white">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-35" />
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-[#0d3a8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#7a31de]/26 blur-3xl" />

      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#07123b]/85 backdrop-blur sm:sticky">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <Link href="/dashboard" className="inline-flex items-center gap-3">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima"
              width={164}
              height={42}
              className="h-auto w-[128px] sm:w-[164px]"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/dashboard"
              aria-label="Ir al dashboard"
              title="Dashboard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
            >
              <span className="sm:hidden" aria-hidden="true">📊</span>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            {isAdminUser ? (
              <Link
                href="/admin"
                aria-label="Ir al panel admin"
                title="Admin"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
              >
                <span className="sm:hidden" aria-hidden="true">🛠️</span>
                <span className="hidden sm:inline">Admin</span>
              </Link>
            ) : null}
            <Link
              href="/dashboard/depositar"
              className="rounded-full bg-gradient-to-r from-[#ff613f] to-[#7f30de] px-3 py-2 text-xs font-bold text-white shadow-[0_10px_26px_rgba(133,40,223,0.35)] transition hover:scale-[1.02] sm:px-5 sm:text-sm"
            >
              Depositar
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
              >
                <span className="sm:hidden" aria-hidden="true">↪</span>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-12 pt-32 sm:pt-12">
      <section className="mb-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight">Panel de usuario</h1>
        <p className="mt-1 text-sm text-white/70">{user.email}</p>
      </section>

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

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500">Balance disponible</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            {formatMoney(wallet?.balance_available ?? 0)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500">Balance bloqueado</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {formatMoney(wallet?.balance_locked ?? 0)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500">Capital en órdenes abiertas</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(openNotional)}</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-medium">Asignacion de portafolio</h2>
          <p className="mt-1 text-sm text-zinc-600">Distribucion por posicion abierta segun costo promedio.</p>

          <div className="mt-4 flex items-center gap-5">
            <div className="relative h-32 w-32 shrink-0">
              <div
                className="h-32 w-32 rounded-full"
                style={{ background: exposureRing }}
              />
              <div className="absolute inset-4 rounded-full bg-white" />
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Exposicion</p>
                  <p className="text-sm font-semibold text-zinc-900">{formatMoney(totalExposure)}</p>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              {portfolioSlices.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin posiciones activas para graficar.</p>
              ) : (
                portfolioSlices.slice(0, 5).map((slice) => (
                  <div key={slice.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <p className="truncate text-zinc-700">{slice.label}</p>
                      <p className="font-medium text-zinc-900">{(slice.weight * 100).toFixed(1)}%</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${clamp(slice.weight * 100, 4, 100)}%`, backgroundColor: slice.color }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-600">
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <p>Posicion principal</p>
              <p className="mt-1 truncate font-medium text-zinc-900">{topExposure?.label ?? "Sin datos"}</p>
            </div>
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <p>Ganancia/Perdida realizada</p>
              <p className={`mt-1 font-medium ${realizedPnlTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatMoney(realizedPnlTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6 lg:col-span-3">
          <h2 className="text-lg font-medium">Evolucion y liquidez</h2>
          <p className="mt-1 text-sm text-zinc-600">Linea de balance registrado y lectura operativa del cashflow reciente.</p>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <svg viewBox="0 0 360 120" className="h-36 w-full" role="img" aria-label="Evolucion de balance">
              <defs>
                <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6ee7ff" />
                  <stop offset="55%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <path d="M0 120 H360" stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" />
              <path d="M0 1 H360" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
              {equityTrendPath ? <path d={equityTrendPath} stroke="url(#equityStroke)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-zinc-200 px-3 py-2">
              <p className="text-xs text-zinc-500">Patrimonio total</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(totalEquity)}</p>
            </div>
            <div className="rounded-md border border-zinc-200 px-3 py-2">
              <p className="text-xs text-zinc-500">Liquidez inmediata</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{(liquidityRatio * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-md border border-zinc-200 px-3 py-2">
              <p className="text-xs text-zinc-500">Flujo neto 7 dias</p>
              <p className={`mt-1 text-sm font-semibold ${recentCashflow >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {recentCashflow >= 0 ? "+" : ""}
                {formatMoney(recentCashflow)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Depositar fondos</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pago seguro con Stripe. El saldo se acredita inmediatamente al confirmar.
            </p>
          </div>
          <Link
            href="/dashboard/depositar"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Depositar →
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-medium">Solicitar retiro</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Retiro sujeto a revision administrativa. El monto se reserva al solicitar.
        </p>

        {/* Estado KYC */}
        {(() => {
          const kyc = kycData as { status: string; verified_at: string | null } | null;
          const kycVerified = kyc?.status === "verified";
          const bankAccounts = (bankAccountsData ?? []) as { id: string; bank_name: string; account_last4: string; is_primary: boolean }[];
          const primaryBank = bankAccounts.find((a) => a.is_primary) ?? bankAccounts[0] ?? null;

          if (!kycVerified) {
            return (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Verificacion requerida.</span>{" "}
                Debes verificar tu identidad antes de solicitar retiros.{" "}
                <Link href="/dashboard/verificacion" className="font-semibold underline">
                  Verificar identidad →
                </Link>
              </div>
            );
          }

          if (!primaryBank) {
            return (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Cuenta bancaria requerida.</span>{" "}
                Registra una cuenta bancaria para recibir tus retiros.{" "}
                <Link href="/dashboard/cuenta-bancaria" className="font-semibold underline">
                  Agregar cuenta →
                </Link>
              </div>
            );
          }

          return (
            <>
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Destino: <span className="font-semibold">{primaryBank.bank_name} · **** {primaryBank.account_last4}</span>{" "}
                <Link href="/dashboard/cuenta-bancaria" className="ml-1 text-zinc-500 underline">cambiar</Link>
              </div>
              {withdrawalRules && (
                <p className="mt-2 text-xs text-zinc-500">
                  Min: {formatMoney(withdrawalRules.min_amount)} · Max: {formatMoney(withdrawalRules.max_amount)} · Procesamiento: {withdrawalRules.min_processing_days ?? 3} dias habiles
                </p>
              )}
              <form action={requestWithdrawalAction} className="mt-4 flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label htmlFor="withdraw_amount" className="text-xs text-zinc-500">
                    Monto DOP
                  </label>
                  <input
                    id="withdraw_amount"
                    name="amount"
                    type="number"
                    min={withdrawalRules?.min_amount ?? 1}
                    max={withdrawalRules?.max_amount ?? 1000000}
                    step="1"
                    required
                    className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Solicitar retiro
                </button>
              </form>
            </>
          );
        })()}

        {withdrawals.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Aun no has creado solicitudes de retiro.</p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {withdrawals.map((w) => (
              <article key={w.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{formatMoney(w.amount)}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      w.status === "approved" || w.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : w.status === "rejected" || w.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : w.status === "processing"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {labelWithdrawalStatus(w.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">{w.rejection_reason || w.admin_note || "Sin detalle"}</p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-500">
                  <p>Solicitado: {new Date(w.requested_at).toLocaleString("es-DO")}</p>
                  <p>Revisado: {w.reviewed_at ? new Date(w.reviewed_at).toLocaleString("es-DO") : "Pendiente"}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Detalle</th>
                  <th className="py-2 pr-3">Solicitado</th>
                  <th className="py-2 pr-3">Revisado</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-50">
                    <td className="py-2 pr-3 font-medium">{formatMoney(w.amount)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          w.status === "approved" || w.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : w.status === "rejected" || w.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : w.status === "processing"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {labelWithdrawalStatus(w.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-600">
                      {w.rejection_reason || w.admin_note || "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{new Date(w.requested_at).toLocaleString("es-DO")}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {w.reviewed_at ? new Date(w.reviewed_at).toLocaleString("es-DO") : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section id="notificaciones" className="mt-8 rounded-xl border border-zinc-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Mis predicciones</h2>
          <Link href="/#activos" className="text-sm underline">
            Ir a mercados
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Aun no tienes predicciones. Visita mercados para crear tu primera prediccion.
          </p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {orders.map((order) => {
              const canCancel = order.status === "open" || order.status === "partially_filled";
              return (
                <article key={order.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                  <p className="text-sm font-semibold leading-snug">{order.market?.title ?? "Mercado"}</p>
                  <p className="mt-1 text-xs text-zinc-600">{order.option?.label ?? "Opcion"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-zinc-500">Direccion:</span> {labelOrderSide(order.side)}</p>
                    <p><span className="text-zinc-500">Precio:</span> {formatPct(order.limit_price)}</p>
                    <p><span className="text-zinc-500">Ejecutado:</span> {order.quantity_filled}/{order.quantity}</p>
                    <p><span className="text-zinc-500">Estado:</span> {labelOrderStatus(order.status)}</p>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{new Date(order.created_at).toLocaleString("es-DO")}</p>
                  {canCancel ? (
                    <form action={cancelOrderAction} className="mt-3">
                      <input type="hidden" name="order_id" value={order.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Mercado</th>
                  <th className="py-2 pr-3">Opcion</th>
                  <th className="py-2 pr-3">Direccion</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2 pr-3">Ejecutado</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Accion</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const canCancel = order.status === "open" || order.status === "partially_filled";
                  return (
                    <tr key={order.id} className="border-b border-zinc-50 align-top">
                      <td className="py-2 pr-3 font-medium">{order.market?.title ?? "Mercado"}</td>
                      <td className="py-2 pr-3">{order.option?.label ?? "Opcion"}</td>
                      <td className="py-2 pr-3">{labelOrderSide(order.side)}</td>
                      <td className="py-2 pr-3">{formatPct(order.limit_price)}</td>
                      <td className="py-2 pr-3">
                        {order.quantity_filled}/{order.quantity}
                      </td>
                      <td className="py-2 pr-3">{labelOrderStatus(order.status)}</td>
                      <td className="py-2 pr-3 text-xs text-zinc-500">
                        {new Date(order.created_at).toLocaleString("es-DO")}
                      </td>
                      <td className="py-2 pr-3">
                        {canCancel ? (
                          <form action={cancelOrderAction}>
                            <input type="hidden" name="order_id" value={order.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100"
                            >
                              Cancelar
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section id="notificaciones" className="order-10 mt-8 rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <h2 className="text-lg font-medium text-white">Notificaciones</h2>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={`/dashboard?notifications=all&notificationType=${notificationTypeFilter}#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationsFilter === "all" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                Todas
              </Link>
              <Link
                href={`/dashboard?notifications=unread&notificationType=${notificationTypeFilter}#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationsFilter === "unread" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                No leidas
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={`/dashboard?notifications=${notificationsFilter}&notificationType=all#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationTypeFilter === "all" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                Todo tipo
              </Link>
              <Link
                href={`/dashboard?notifications=${notificationsFilter}&notificationType=trading#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationTypeFilter === "trading" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                Predicciones
              </Link>
              <Link
                href={`/dashboard?notifications=${notificationsFilter}&notificationType=markets#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationTypeFilter === "markets" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                Mercados
              </Link>
              <Link
                href={`/dashboard?notifications=${notificationsFilter}&notificationType=withdrawals#notificaciones`}
                className={`rounded-full px-2 py-0.5 ${notificationTypeFilter === "withdrawals" ? "bg-gradient-to-r from-[#ff6a41] to-[#7f30de] text-white" : "bg-white/10 text-white/80"}`}
              >
                Retiros
              </Link>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/85">
              <span>Sin leer</span>
              <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold leading-4 text-white">
                {unreadBadge}
              </span>
            </span>
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="redirect_to" value={notificationsContextUrl} />
              <button
                type="submit"
                disabled={unreadNotifications === 0}
                className="rounded-md border border-white/25 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Marcar todas
              </button>
            </form>
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="mt-4 text-sm text-white/70">Aun no tienes notificaciones.</p>
        ) : (
          <div className="mt-4">
            <div className="space-y-2 md:hidden">
              {notifications.map((n) => (
                <article key={n.id} className={`rounded-lg border p-2.5 ${n.read_at ? "border-white/15 bg-white/[0.05]" : "border-white/25 bg-white/[0.1]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{labelNotificationEvent(n.event_type)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        n.status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : n.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {labelNotificationStatus(n.status)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-snug text-white/85">{buildNotificationSummary(n.event_type, n.payload ?? {})}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-xs text-white/65">
                    <span>{n.read_at ? "Leida" : "No leida"}</span>
                    <span>{new Date(n.created_at).toLocaleString("es-DO")}</span>
                  </div>
                  {!n.read_at ? (
                    <form action={markNotificationReadAction} className="mt-2">
                      <input type="hidden" name="notification_id" value={n.id} />
                      <input type="hidden" name="redirect_to" value={notificationsContextUrl} />
                      <button
                        type="submit"
                        className="rounded-md border border-white/25 bg-white/5 px-2.5 py-0.5 text-xs text-white transition hover:bg-white/15"
                      >
                        Marcar leida
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/60">
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Detalle</th>
                  <th className="py-2 pr-3">Lectura</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Accion</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} className={`border-b border-white/10 ${n.read_at ? "opacity-85" : "bg-white/[0.06]"}`}>
                    <td className="py-2 pr-3">
                      {labelNotificationEvent(n.event_type)}
                    </td>
                    <td className="py-2 pr-3 text-white/85">
                      {buildNotificationSummary(n.event_type, n.payload ?? {})}
                    </td>
                    <td className="py-2 pr-3 text-xs text-white/70">
                      {n.read_at ? "Leida" : "No leida"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          n.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : n.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {labelNotificationStatus(n.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-white/65">
                      {new Date(n.created_at).toLocaleString("es-DO")}
                    </td>
                    <td className="py-2 pr-3">
                      {!n.read_at ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notification_id" value={n.id} />
                          <input type="hidden" name="redirect_to" value={notificationsContextUrl} />
                          <button
                            type="submit"
                            className="rounded-md border border-white/25 bg-white/5 px-2.5 py-1 text-xs text-white transition hover:bg-white/15"
                          >
                            Marcar leida
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-white/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/70">
              <p>
                Pagina {safeNotificationsPage} de {notificationsTotalPages}
              </p>
              <div className="flex gap-2">
                {notificationsHasPrev ? (
                  <Link
                    href={`/dashboard?notifications=${notificationsFilter}&notificationType=${notificationTypeFilter}&notificationsPage=${safeNotificationsPage - 1}#notificaciones`}
                    className="rounded-md border border-white/25 bg-white/5 px-2.5 py-1 text-white transition hover:bg-white/15"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="rounded-md border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/40">Anterior</span>
                )}
                {notificationsHasNext ? (
                  <Link
                    href={`/dashboard?notifications=${notificationsFilter}&notificationType=${notificationTypeFilter}&notificationsPage=${safeNotificationsPage + 1}#notificaciones`}
                    className="rounded-md border border-white/25 bg-white/5 px-2.5 py-1 text-white transition hover:bg-white/15"
                  >
                    Siguiente
                  </Link>
                ) : (
                  <span className="rounded-md border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/40">Siguiente</span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-medium">Movimientos de cuenta</h2>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Aun no tienes movimientos registrados.</p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {movements.map((m) => (
              <article key={m.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{labelMovementType(m.movement_type)}</p>
                  <p
                    className={`text-sm font-semibold ${
                      m.movement_type === "withdrawal_requested"
                        ? "text-amber-500"
                        : m.amount >= 0
                          ? "text-emerald-700"
                          : "text-red-600"
                    }`}
                  >
                    {m.amount >= 0 ? "+" : ""}
                    {formatMoney(m.amount)}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-500">
                  <p>Balance despues: {formatMoney(m.balance_after ?? 0)}</p>
                  <p>Referencia: {m.order_id ? `Prediccion ${m.order_id.slice(0, 8)}...` : m.market_id ? `Mercado ${m.market_id.slice(0, 8)}...` : "—"}</p>
                  <p>{new Date(m.created_at).toLocaleString("es-DO")}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Monto</th>
                  <th className="py-2 pr-3">Balance despues</th>
                  <th className="py-2 pr-3">Referencia</th>
                  <th className="py-2 pr-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-50 align-top">
                    <td className="py-2 pr-3">{labelMovementType(m.movement_type)}</td>
                    <td
                      className={`py-2 pr-3 font-medium ${
                        m.movement_type === "withdrawal_requested"
                          ? "text-amber-500"
                          : m.amount >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                      }`}
                    >
                      {m.amount >= 0 ? "+" : ""}
                      {formatMoney(m.amount)}
                    </td>
                    <td className="py-2 pr-3">{formatMoney(m.balance_after ?? 0)}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {m.order_id ? `Prediccion ${m.order_id.slice(0, 8)}...` : m.market_id ? `Mercado ${m.market_id.slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {new Date(m.created_at).toLocaleString("es-DO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-medium">Mercados resueltos</h2>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            Payout total acumulado: <span className="font-semibold text-emerald-700">{formatMoney(totalResolutionPayout)}</span>
          </p>
          <p className="text-xs text-zinc-500">
            Total filtrado: <span className="font-semibold text-zinc-700">{formatMoney(filteredResolutionPayout)}</span>
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/dashboard?resolvedStatus=all`}
            className={`rounded-full px-2.5 py-1 ${resolvedStatusFilter === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            Todos
          </Link>
          <Link
            href={`/dashboard?resolvedStatus=won`}
            className={`rounded-full px-2.5 py-1 ${resolvedStatusFilter === "won" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            Ganados
          </Link>
          <Link
            href={`/dashboard?resolvedStatus=lost`}
            className={`rounded-full px-2.5 py-1 ${resolvedStatusFilter === "lost" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            Perdidos
          </Link>
          <Link
          href={`/dashboard?resolvedStatus=lost`}
          className={`rounded-full px-2.5 py-1 ${resolvedStatusFilter === "lost" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Perdidos
        </Link>
      </div>

        {filteredResolvedMarkets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Aun no tienes mercados resueltos en tu historial.</p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {filteredResolvedMarkets.map((market) => (
              <article key={market.marketId} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                <p className="text-sm font-semibold leading-snug">{market.marketTitle}</p>
                <p className="mt-1 text-xs text-zinc-600">Resultado: {market.winner}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      market.payout > 0 ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {market.resolutionStatus === "won"
                      ? "Ganaste"
                      : market.resolutionStatus === "lost"
                          ? "Perdiste"
                          : market.payout > 0
                            ? "Ganaste"
                            : "Sin payout"}
                  </span>
                  <p className={`text-sm font-semibold ${market.payout > 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                    {market.payout > 0 ? "+" : ""}
                    {formatMoney(market.payout)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-zinc-500">{new Date(market.resolvedAt).toLocaleString("es-DO")}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Mercado</th>
                  <th className="py-2 pr-3">Resultado</th>
                  <th className="py-2 pr-3">Estado personal</th>
                  <th className="py-2 pr-3">Payout</th>
                  <th className="py-2 pr-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredResolvedMarkets.map((market) => (
                  <tr key={market.marketId} className="border-b border-zinc-50">
                    <td className="py-2 pr-3 font-medium">{market.marketTitle}</td>
                    <td className="py-2 pr-3">{market.winner}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          market.payout > 0 ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {market.resolutionStatus === "won"
                          ? "Ganaste"
                          : market.resolutionStatus === "lost"
                              ? "Perdiste"
                              : market.payout > 0
                                ? "Ganaste"
                                : "Sin payout"}
                      </span>
                    </td>
                    <td className={`py-2 pr-3 font-medium ${market.payout > 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                      {market.payout > 0 ? "+" : ""}
                      {formatMoney(market.payout)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {new Date(market.resolvedAt).toLocaleString("es-DO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-medium">Posiciones abiertas</h2>

        {positions.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">No tienes posiciones abiertas aun.</p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {positions.map((p) => (
              <article key={p.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                <p className="text-sm font-semibold leading-snug">{p.market?.title ?? "Mercado"}</p>
                <p className="mt-1 text-xs text-zinc-600">{p.option?.label ?? "Opcion"}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p><span className="text-zinc-500">Cantidad:</span> {p.quantity.toFixed(2)}</p>
                  <p><span className="text-zinc-500">Precio prom:</span> {formatPct(p.avg_entry_price)}</p>
                </div>
                <p className={`mt-2 text-sm font-semibold ${p.realized_pnl >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatMoney(p.realized_pnl)}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Mercado</th>
                  <th className="py-2 pr-3">Opcion</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Precio promedio</th>
                  <th className="py-2 pr-3">PnL realizado</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-50">
                    <td className="py-2 pr-3 font-medium">{p.market?.title ?? "Mercado"}</td>
                    <td className="py-2 pr-3">{p.option?.label ?? "Opcion"}</td>
                    <td className="py-2 pr-3">{p.quantity.toFixed(2)}</td>
                    <td className="py-2 pr-3">{formatPct(p.avg_entry_price)}</td>
                    <td className={`py-2 pr-3 ${p.realized_pnl >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {formatMoney(p.realized_pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-medium">Historial de operaciones</h2>

        {trades.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Aun no tienes operaciones ejecutadas.</p>
        ) : (
          <>
          <div className="mt-4 space-y-3 md:hidden">
            {trades.map((t) => {
              const role = t.taker_user_id === user.id ? "taker" : "maker";
              return (
                <article key={t.id} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                  <p className="text-sm font-semibold leading-snug">{t.market?.title ?? "Mercado"}</p>
                  <p className="mt-1 text-xs text-zinc-600">{t.option?.label ?? "Opcion"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-zinc-500">Rol:</span> {labelTradeRole(role)}</p>
                    <p><span className="text-zinc-500">Operacion:</span> {labelOrderSide(t.side)}</p>
                    <p><span className="text-zinc-500">Precio:</span> {formatPct(t.price)}</p>
                    <p><span className="text-zinc-500">Cantidad:</span> {t.quantity.toFixed(2)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">{formatMoney(t.notional ?? 0)}</span>
                    <span className="text-xs text-zinc-500">{new Date(t.created_at).toLocaleString("es-DO")}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Mercado</th>
                  <th className="py-2 pr-3">Opcion</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Operacion</th>
                  <th className="py-2 pr-3">Precio</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Notional</th>
                  <th className="py-2 pr-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const role = t.taker_user_id === user.id ? "taker" : "maker";
                  return (
                    <tr key={t.id} className="border-b border-zinc-50">
                      <td className="py-2 pr-3 font-medium">{t.market?.title ?? "Mercado"}</td>
                      <td className="py-2 pr-3">{t.option?.label ?? "Opcion"}</td>
                      <td className="py-2 pr-3">{labelTradeRole(role)}</td>
                      <td className="py-2 pr-3">{labelOrderSide(t.side)}</td>
                      <td className="py-2 pr-3">{formatPct(t.price)}</td>
                      <td className="py-2 pr-3">{t.quantity.toFixed(2)}</td>
                      <td className="py-2 pr-3">{formatMoney(t.notional ?? 0)}</td>
                      <td className="py-2 pr-3 text-xs text-zinc-500">
                        {new Date(t.created_at).toLocaleString("es-DO")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <Link href="/" className="order-11 mt-6 w-fit text-sm underline">
        Volver al inicio
      </Link>
      </div>
    </main>
  );
}
