import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { ComingSoonLanding } from "@/app/coming-soon-landing";
import {
  placeBuyOrderAction,
} from "@/app/markets/actions";
import { OrderFieldsClient } from "@/app/order-fields-client";
import { fetchBcrdDailyHistory } from "@/lib/fx/bcrd";
import {
  DAILY_MARKET_CLOSE_MINUTES,
  DAILY_MARKET_RESOLUTION_MINUTES,
  getRdNowParts,
} from "@/lib/fx/daily-market";
import { computeHybridProbabilities } from "@/lib/markets/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MarketRow = {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  fx_reference_source: string | null;
  category: string | null;
  is_daily_fx: boolean;
  liquidity_b: number;
  status: "open" | "closed" | "resolved" | "archived" | "draft";
  closes_at: string | null;
};

type MarketCategory = "all" | "politica" | "economia" | "social" | "deportes";

interface Props {
  searchParams: Promise<{
    category?: string;
    market?: string;
    error?: string;
    success?: string;
  }>;
}

type SelectedMarketRow = {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  category: string | null;
  is_daily_fx: boolean;
  status: "open" | "closed" | "resolved" | "archived" | "draft";
  closes_at: string | null;
  liquidity_b: number | null;
};

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
  created_at: string;
};

type OrderRow = {
  option_id: string;
  side: "buy" | "sell";
  status: string;
  limit_price: number;
  quantity: number;
  quantity_filled: number;
};

type PositionRow = {
  option_id: string;
  quantity: number;
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

function tickerLabel(category: string | null) {
  if (!category) return "Mercado";
  return category;
}

function safeDecode(raw: string | undefined) {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function marketCountByCategory(markets: MarketRow[], category: string) {
  return markets.filter((m) => (m.category ?? "").toLowerCase() === category.toLowerCase()).length;
}

function subtractDaysIso(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildLinePath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.0001, max - min);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function parseDailyFxLocalDate(rawSource: string | null) {
  if (!rawSource) return null;

  try {
    const parsed = JSON.parse(rawSource) as { local_date?: unknown };
    const value = typeof parsed.local_date === "string" ? parsed.local_date : "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function keepSingleDailyFxMarket(markets: MarketRow[]) {
  let seenDailyFx = false;

  return markets.filter((market) => {
    if (!market.is_daily_fx) return true;
    if (seenDailyFx) return false;

    seenDailyFx = true;
    return true;
  });
}

function isMarketOpenForPredictions(
  market: Pick<MarketRow, "status" | "is_daily_fx">,
  rdMinutesOfDay: number,
) {
  if (market.status !== "open") return false;
  if (market.is_daily_fx && rdMinutesOfDay >= DAILY_MARKET_CLOSE_MINUTES) return false;
  return true;
}

export default async function Home({ searchParams }: Props) {
  const {
    category: categoryRaw,
    market: marketRaw,
    error: errorRaw,
    success: successRaw,
  } = await searchParams;
  const selectedCategory: MarketCategory =
    categoryRaw === "politica" ||
    categoryRaw === "economia" ||
    categoryRaw === "social" ||
    categoryRaw === "deportes"
      ? categoryRaw
      : "all";
  const selectedMarketId = typeof marketRaw === "string" && marketRaw.length > 0 ? marketRaw : null;
  const rdNow = getRdNowParts();
  const fxHistoryFrom = subtractDaysIso(rdNow.isoDate, 16);

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: comingSoonSettings } = await supabase
    .from("site_settings")
    .select("coming_soon_enabled, coming_soon_target_at, coming_soon_title, coming_soon_message")
    .eq("id", 1)
    .maybeSingle();

  if (comingSoonSettings?.coming_soon_enabled) {
    const targetAt =
      comingSoonSettings.coming_soon_target_at ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return (
      <ComingSoonLanding
        targetAt={targetAt}
        title={comingSoonSettings.coming_soon_title || "Proximamente"}
        message={comingSoonSettings.coming_soon_message || "Estamos preparando una experiencia increible para Proxima."}
      />
    );
  }

  const [marketsResult, profilesCountResult, tradesResult, fxHistoryRaw, headerWalletResult] = await Promise.all([
    supabase
      .from("markets")
      .select("id, title, description, slug, fx_reference_source, category, is_daily_fx, liquidity_b, status, closes_at")
      .in("status", ["open", "closed", "resolved"])
      .order("created_at", { ascending: false })
      .limit(24),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("trades")
      .select("notional")
      .order("created_at", { ascending: false })
      .limit(250),
    fetchBcrdDailyHistory(fxHistoryFrom, rdNow.isoDate).catch(() => [] as FxHistoryRow[]),
    session?.user
      ? supabase
          .from("wallets")
          .select("balance_available")
          .eq("user_id", session.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const markets = keepSingleDailyFxMarket((marketsResult.data ?? []) as MarketRow[]);
  const openMarkets = markets.filter((market) =>
    isMarketOpenForPredictions(market, rdNow.minutesOfDay),
  );
  const todayDailyFxMarket = markets.find((market) => market.is_daily_fx);
  const filteredOpenMarkets =
    selectedCategory === "all"
      ? openMarkets
      : openMarkets.filter(
          (market) => (market.category ?? "").toLowerCase() === selectedCategory,
        );
  const shouldIncludeTodayDailyFxInList =
    Boolean(todayDailyFxMarket) &&
    !filteredOpenMarkets.some((market) => market.id === todayDailyFxMarket?.id) &&
    (selectedCategory === "all" ||
      (todayDailyFxMarket?.category ?? "").toLowerCase() === selectedCategory);
  const displayMarkets = shouldIncludeTodayDailyFxInList && todayDailyFxMarket
    ? [...filteredOpenMarkets, todayDailyFxMarket]
    : filteredOpenMarkets;
  const featured = filteredOpenMarkets.slice(0, 6);
  const listingMarkets = featured.length > 0 ? featured : displayMarkets;
  const tickerItems = (featured.length > 0 ? featured : markets.slice(0, 8)).map((market) => ({
    id: market.id,
    title: market.title,
    category: tickerLabel(market.category),
  }));

  const traderCount = profilesCountResult.count ?? 0;
  const recentVolume = (tradesResult.data ?? []).reduce((sum, row) => sum + Number(row.notional ?? 0), 0);
  const headerWalletBalance = Number(headerWalletResult.data?.balance_available ?? 0);

  const categories: Array<{ slug: MarketCategory; label: string; total: number }> = [
    { slug: "all", label: "Todos", total: openMarkets.length },
    { slug: "politica", label: "Politica", total: marketCountByCategory(openMarkets, "Politica") },
    { slug: "economia", label: "Economia", total: marketCountByCategory(openMarkets, "Economia") },
    { slug: "social", label: "Social", total: marketCountByCategory(openMarkets, "Social") },
    { slug: "deportes", label: "Deportes", total: marketCountByCategory(openMarkets, "Deportes") },
  ];

  const fxHistory = (fxHistoryRaw ?? []).slice(-8);
  const fxHistoryValues = fxHistory.map((item) => item.selling);
  const fxHistoryPath = buildLinePath(fxHistoryValues, 360, 92);
  const lastFxPoint = fxHistory.at(-1) ?? null;

  const dailyFxMarket =
    markets.find((market) => market.is_daily_fx && market.status === "open") ??
    markets.find((market) => market.is_daily_fx) ??
    null;
  const dailyFxLocalDate = parseDailyFxLocalDate(dailyFxMarket?.fx_reference_source ?? null);

  const isTodayDailyFxMarket = dailyFxLocalDate === rdNow.isoDate;

  let dailyFxOptions: OptionRow[] = [];
  let dailyFxProbabilities = new Map<string, number>();

  if (dailyFxMarket?.id) {
    const [dailyOptionsResult, dailyTradesResult, dailyOrdersResult, dailyPositionsResult] = await Promise.all([
      supabase
        .from("market_options")
        .select("id, label, sort_order")
        .eq("market_id", dailyFxMarket.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("trades")
        .select("id, option_id, side, price, quantity, created_at")
        .eq("market_id", dailyFxMarket.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("limit_orders")
        .select("option_id, side, status, limit_price, quantity, quantity_filled")
        .eq("market_id", dailyFxMarket.id)
        .in("status", ["open", "partially_filled"])
        .limit(200),
      supabase
        .from("positions")
        .select("option_id, quantity")
        .eq("market_id", dailyFxMarket.id),
    ]);

    dailyFxOptions = (dailyOptionsResult.data ?? []) as OptionRow[];
    const dailyFxTrades = (dailyTradesResult.data ?? []) as TradeRow[];
    const dailyFxOrders = (dailyOrdersResult.data ?? []) as OrderRow[];
    const dailyFxPositions = (dailyPositionsResult.data ?? []) as PositionRow[];

    const lastTradePriceByOption = new Map<string, number>();
    for (const trade of dailyFxTrades) {
      if (!lastTradePriceByOption.has(trade.option_id)) {
        lastTradePriceByOption.set(trade.option_id, Number(trade.price ?? 0));
      }
    }

    const positionQtyByOption = new Map<string, number>();
    for (const position of dailyFxPositions) {
      positionQtyByOption.set(
        position.option_id,
        (positionQtyByOption.get(position.option_id) ?? 0) + Number(position.quantity ?? 0),
      );
    }

    const bestBidByOption = new Map<string, number>();
    const bestAskByOption = new Map<string, number>();
    for (const order of dailyFxOrders) {
      const remainingQty = Math.max(0, Number(order.quantity ?? 0) - Number(order.quantity_filled ?? 0));
      if (remainingQty <= 0) continue;
      const price = Number(order.limit_price ?? 0);
      if (order.side === "buy") {
        const prev = bestBidByOption.get(order.option_id);
        if (prev === undefined || price > prev) bestBidByOption.set(order.option_id, price);
      } else {
        const prev = bestAskByOption.get(order.option_id);
        if (prev === undefined || price < prev) bestAskByOption.set(order.option_id, price);
      }
    }

    dailyFxProbabilities = computeHybridProbabilities({
      optionIds: dailyFxOptions.map((option) => option.id),
      liquidityB: Number(dailyFxMarket.liquidity_b ?? 100),
      positionQtyByOption,
      lastTradePriceByOption,
      bestBidByOption,
      bestAskByOption,
    });
  }

  const isFxDailyOpen =
    Boolean(dailyFxMarket) &&
    isTodayDailyFxMarket &&
    dailyFxMarket?.status === "open" &&
    rdNow.minutesOfDay < DAILY_MARKET_CLOSE_MINUTES;

  const dailyFxStatusText = !dailyFxMarket || !isTodayDailyFxMarket
    ? "Mercado diario en preparacion. Vuelve en unos minutos."
    : isFxDailyOpen
      ? "Abierto para predicciones hasta las 4:30 PM (hora RD)."
      : rdNow.minutesOfDay < DAILY_MARKET_RESOLUTION_MINUTES
        ? "Mercado cerrado. Liquidacion al publicarse el cierre oficial (5:30 PM)."
        : "Mercado liquidado. Nuevo mercado diario disponible desde las 12:00 AM.";

  const currentCategory = selectedCategory === "all" ? "all" : selectedCategory;
  const activeCategoryHref = `/?category=${currentCategory}#activos`;
  const marketOverlayHref = (marketId: string) => `/?category=${currentCategory}&market=${marketId}#activos`;

  let selectedMarket: SelectedMarketRow | null = null;
  let selectedMarketOptions: OptionRow[] = [];
  let selectedMarketTrades: TradeRow[] = [];
  let selectedMarketProbabilities = new Map<string, number>();
  let walletBalance = headerWalletBalance;

  if (selectedMarketId) {
    const [marketDetailResult, optionsResult, marketTradesResult, marketOrdersResult, positionsResult] =
      await Promise.all([
        supabase
          .from("markets")
          .select("id, title, description, slug, category, is_daily_fx, status, closes_at, liquidity_b")
          .eq("id", selectedMarketId)
          .maybeSingle(),
        supabase
          .from("market_options")
          .select("id, label, sort_order")
          .eq("market_id", selectedMarketId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("trades")
          .select("id, option_id, side, price, quantity, created_at")
          .eq("market_id", selectedMarketId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("limit_orders")
          .select("option_id, side, status, limit_price, quantity, quantity_filled")
          .eq("market_id", selectedMarketId)
          .in("status", ["open", "partially_filled"])
          .limit(200),
        supabase
          .from("positions")
          .select("option_id, quantity")
          .eq("market_id", selectedMarketId),
      ]);

    if (marketDetailResult.data) {
      selectedMarket = marketDetailResult.data as SelectedMarketRow;
      selectedMarketOptions = (optionsResult.data ?? []) as OptionRow[];
      selectedMarketTrades = (marketTradesResult.data ?? []) as TradeRow[];
      const selectedMarketOrders = (marketOrdersResult.data ?? []) as OrderRow[];
      const selectedMarketPositions = (positionsResult.data ?? []) as PositionRow[];

      const lastTradePriceByOption = new Map<string, number>();
      for (const trade of selectedMarketTrades) {
        if (!lastTradePriceByOption.has(trade.option_id)) {
          lastTradePriceByOption.set(trade.option_id, Number(trade.price ?? 0));
        }
      }

      const positionQtyByOption = new Map<string, number>();
      for (const position of selectedMarketPositions) {
        positionQtyByOption.set(
          position.option_id,
          (positionQtyByOption.get(position.option_id) ?? 0) + Number(position.quantity ?? 0),
        );
      }

      const bestBidByOption = new Map<string, number>();
      const bestAskByOption = new Map<string, number>();
      for (const order of selectedMarketOrders) {
        const remainingQty = Math.max(0, Number(order.quantity ?? 0) - Number(order.quantity_filled ?? 0));
        if (remainingQty <= 0) continue;
        const price = Number(order.limit_price ?? 0);
        if (order.side === "buy") {
          const prev = bestBidByOption.get(order.option_id);
          if (prev === undefined || price > prev) bestBidByOption.set(order.option_id, price);
        } else {
          const prev = bestAskByOption.get(order.option_id);
          if (prev === undefined || price < prev) bestAskByOption.set(order.option_id, price);
        }
      }

      selectedMarketProbabilities = computeHybridProbabilities({
        optionIds: selectedMarketOptions.map((option) => option.id),
        liquidityB: Number(selectedMarket.liquidity_b ?? 100),
        positionQtyByOption,
        lastTradePriceByOption,
        bestBidByOption,
        bestAskByOption,
      });

    }
  }

  const errorMessage = safeDecode(errorRaw);
  const successMessage = safeDecode(successRaw);
  const hasPredictionOptions = selectedMarketOptions.length > 0;
  const selectedMarketOpenForPredictions = selectedMarket
    ? isMarketOpenForPredictions(selectedMarket, rdNow.minutesOfDay)
    : false;

  return (
    <main className="relative min-h-screen bg-[#040b2f] text-white">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-40" />
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-[#0d3a8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#ff623f]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7a31de]/25 blur-3xl" />

      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#07123b] sm:sticky sm:bg-[#07123b]/85 sm:backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <Link href="/" className="inline-flex items-center gap-3">
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

            {session?.user ? (
              <>
                <span className="hidden rounded-full border border-[#f7a93b]/70 px-4 py-2 text-sm font-bold text-[#f7a93b] sm:inline-flex">
                  {formatMoney(headerWalletBalance)}
                </span>
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
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#f7a93b]/70 text-[#f7a93b] transition hover:bg-[#f7a93b]/10 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
                >
                  <span aria-hidden="true">👤</span>
                  <span className="hidden sm:inline">Entrar</span>
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-gradient-to-r from-[#ff613f] to-[#7f30de] px-3 py-2 text-xs font-bold text-white shadow-[0_10px_26px_rgba(133,40,223,0.35)] transition hover:scale-[1.02] sm:px-5 sm:text-sm"
                >
                  Depositar
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="brand-marquee border-t border-white/10 bg-[#09154a] py-2 sm:bg-[#09154a]/80">
          <div className="brand-marquee-track gap-6 px-4 text-xs text-white/70 sm:px-6">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <span key={`${item.id}-${idx}`} className="inline-flex items-center gap-2">
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {item.category}
                </span>
                <span className="text-white/80">{item.title}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="relative mx-auto mt-24 w-full max-w-7xl px-4 pb-10 pt-14 sm:mt-0 sm:px-6 lg:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6a41]/40 bg-[#ff6a41]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#ff8d6e]">
              Republica Dominicana · mercado de predicciones
            </div>

            <h1 className="mt-7 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">
              Predice.
              <span className="mt-1 block bg-gradient-to-r from-[#ff6c3f] via-[#f24a68] to-[#5a2fe4] bg-clip-text text-transparent">
                Gana inteligente.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              El primer mercado de predicciones enfocado en politica, economia y realidad dominicana.
              Predice con datos, no con suerte.
            </p>

            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-[#ff6f56]">{formatMoney(recentVolume)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45">Volumen reciente</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-[#ce4dd0]">{traderCount.toLocaleString("es-DO")}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45">Predictores</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-[#58b6ff]">{openMarkets.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/45">Mercados activos</p>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/#activos"
                className="rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#842ddf] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_rgba(143,39,226,0.35)] transition hover:scale-[1.02]"
              >
                Explorar mercados
              </Link>
              {session?.user ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white/85 transition hover:border-white/40 hover:text-white"
                >
                  Ir al dashboard
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white/85 transition hover:border-white/40 hover:text-white"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>

          <div className="order-1 brand-float rounded-3xl border border-white/10 bg-[#101f5b]/65 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.35)] backdrop-blur lg:order-2">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#ff6941] to-[#6f31e5] px-4 py-3">
              <p className="font-[family-name:var(--font-display)] text-xl font-extrabold sm:text-2xl">Mercado Diario USD/Venta</p>
              <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                BCRD
              </span>
            </div>

            <h2 className="mt-4 text-lg font-bold text-white/95">
              {dailyFxMarket?.title ?? "USD/Venta cierre del dia: ¿Sube o baja?"}
            </h2>

            <p
              className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                isFxDailyOpen
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-300/30 bg-amber-400/10 text-amber-100"
              }`}
            >
              {dailyFxStatusText}
            </p>

            <div className="mt-4 space-y-2.5">
              {(dailyFxOptions.length > 0
                ? dailyFxOptions
                : [
                    { id: "up", label: "Sube", sort_order: 0 },
                    { id: "down", label: "Baja", sort_order: 1 },
                  ]
              ).map((option) => {
                const fallback = option.label.toLowerCase().includes("sub") ? 54 : 46;
                const pct = Math.max(
                  1,
                  Number(((dailyFxProbabilities.get(option.id) ?? fallback / 100) * 100).toFixed(1)),
                );
                return (
                  <div key={option.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white/95">{option.label}</p>
                      <p className="font-extrabold text-[#ff6c3f]">{pct.toFixed(1)}%</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff6a41] to-[#6241e6]"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Cierre USD/Venta (BCRD)</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold">
                {lastFxPoint ? lastFxPoint.selling.toFixed(4) : "--"}
              </p>
              <p className="text-xs text-white/55">
                {lastFxPoint ? `Fecha: ${lastFxPoint.label}` : "Sin datos historicos disponibles"}
              </p>

              <div className="mt-3 rounded-lg border border-white/10 bg-[#0c1b52]/80 px-3 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-white/45">
                  <span>Ultimos 8 dias</span>
                  <span>USD venta</span>
                </div>
                <svg viewBox="0 0 360 110" className="mt-1 h-24 w-full" role="img" aria-label="Historico cierre USD venta ultimos 8 dias">
                  <path d="M0 96 H360" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  {fxHistoryPath ? (
                    <path d={fxHistoryPath} fill="none" stroke="#f7a93b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                </svg>
              </div>
            </div>

            {dailyFxMarket ? (
              <Link
                href={isFxDailyOpen ? marketOverlayHref(dailyFxMarket.id) : "#"}
                className={`mt-5 block w-full rounded-xl px-5 py-3 text-center text-base font-extrabold text-white shadow-[0_8px_24px_rgba(122,39,224,0.4)] ${
                  isFxDailyOpen
                    ? "bg-gradient-to-r from-[#ff6a41] to-[#6f31e5]"
                    : "cursor-not-allowed bg-white/15 text-white/55"
                }`}
                aria-disabled={!isFxDailyOpen}
              >
                {isFxDailyOpen ? "Predecir sube o baja" : "Mercado temporalmente cerrado"}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="mt-5 w-full cursor-not-allowed rounded-xl bg-white/15 px-5 py-3 text-base font-extrabold text-white/55"
              >
                Mercado diario en preparacion
              </button>
            )}
          </div>
        </div>
      </section>

      <section id="activos" className="mx-auto w-full max-w-7xl border-t border-white/10 px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((category) => (
              <Link
                href={`/?category=${category.slug}#activos`}
                key={category.slug}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  selectedCategory === category.slug
                    ? "border-[#ff6a41]/70 bg-gradient-to-r from-[#ff6a41]/90 to-[#7f30de]/90 text-white"
                    : "border-white/15 bg-white/5 text-white/70"
                }`}
              >
                <span>{category.label}</span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none ${
                    selectedCategory === category.slug
                      ? "bg-white/25 text-white"
                      : "bg-white/12 text-white/85"
                  }`}
                >
                  {category.total}
                </span>
              </Link>
            ))}
          </div>
          {selectedCategory !== "all" ? (
            <Link href="/?category=all#activos" className="text-sm font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
              Ver todos los mercados
            </Link>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {listingMarkets.length > 0 ? listingMarkets.map((market) => (
              <article key={market.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]">
                {(() => {
                  const canPredict = isMarketOpenForPredictions(market, rdNow.minutesOfDay);
                  return (
                    <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-white/95">{market.title}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-[#0f2059] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#65bfff]">
                      {tickerLabel(market.category)}
                    </span>
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                      Liquidez {formatMoney(Number(market.liquidity_b ?? 0))}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/50">
                  <span>{market.closes_at ? `Cierra ${new Date(market.closes_at).toLocaleDateString("es-DO")}` : "Sin fecha de cierre"}</span>
                  <span>4 opciones</span>
                  <span>{canPredict ? "Abierto para predicciones" : "Mercado cerrado"}</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-full w-[46%] rounded-full bg-gradient-to-r from-[#4ea1ff] to-[#7f30de]" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/60">Top opcion 46%</span>
                  {canPredict ? (
                    <Link
                      href={marketOverlayHref(market.id)}
                      className="rounded-lg border border-[#ff6a41]/50 bg-[#ff6a41]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#ff8b66]"
                    >
                      Predecir
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/60">
                      Cerrado
                    </span>
                  )}
                </div>
                    </>
                  );
                })()}
              </article>
            )) : (
              <article className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-6 text-sm text-white/65">
                No hay mercados abiertos para la categoria seleccionada.
              </article>
            )}
          </div>

          <aside className="space-y-4" id="como-funciona">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Como funciona</p>
              <ol className="mt-3 space-y-3 text-sm text-white/75">
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ff6a41] text-xs font-extrabold text-white">1</span>
                  Deposita fondos en tu cuenta.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#8a2fe0] text-xs font-extrabold text-white">2</span>
                  Elige mercado y analiza probabilidades.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2f6de0] text-xs font-extrabold text-white">3</span>
                  Confirma tu prediccion y cobra cuando aciertes.
                </li>
              </ol>
            </article>

            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2c70] to-[#0d1b52] p-5">
              <div className="flex items-center">
                <Image
                  src="/branding/logo_blanco.png"
                  alt="Logo Proxima"
                  width={164}
                  height={42}
                  className="h-auto w-[140px]"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
              <p className="mt-3 text-sm text-white/70">
                Transparencia en reglas, gestion de riesgo operativa y resolucion auditada para tus predicciones.
              </p>
              {session?.user ? (
                <Link
                  href="/dashboard"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em]"
                >
                  Ver dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em]"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/auth/register"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
            </article>
          </aside>
        </div>
      </section>

      {selectedMarket ? (
        <div className="fixed inset-0 z-40 bg-[#02061f]/75 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0b1748]/95 shadow-[0_34px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#65bfff]">
                  {tickerLabel(selectedMarket.category)}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">{selectedMarket.title}</h2>
                <p className="mt-1 text-xs text-white/55">
                  Estado: {selectedMarketOpenForPredictions ? "open" : "closed"}
                  {selectedMarket.closes_at
                    ? ` · Cierra ${new Date(selectedMarket.closes_at).toLocaleDateString("es-DO")}`
                    : " · Sin fecha de cierre"}
                </p>
              </div>
              <Link
                href={activeCategoryHref}
                className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/80 hover:border-white/50 hover:text-white"
              >
                Cerrar
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {selectedMarket.description ? (
                <p className="text-sm leading-relaxed text-white/70">{selectedMarket.description}</p>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}
              {successMessage ? (
                <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {successMessage}
                </div>
              ) : null}
              {!selectedMarketOpenForPredictions ? (
                <div className="mt-4 rounded-xl border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Este mercado esta cerrado para predicciones en este momento.
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Probabilidades</p>
                  <div className="mt-3 space-y-3">
                    {selectedMarketOptions.length === 0 ? (
                      <p className="text-sm text-white/60">Este mercado aun no tiene opciones publicadas.</p>
                    ) : (
                      selectedMarketOptions.map((option) => {
                        const prob =
                          selectedMarketProbabilities.get(option.id) ??
                          (selectedMarketOptions.length > 0 ? 1 / selectedMarketOptions.length : 0);
                        return (
                          <div key={option.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-white/85">{option.label}</span>
                              <span className="font-bold text-[#ff8a66]">{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#ff6a41] to-[#6538e6]"
                                style={{ width: `${Math.max(4, prob * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Actividad reciente</p>
                  {selectedMarketTrades.length === 0 ? (
                    <p className="mt-3 text-sm text-white/60">Sin actividad registrada aun.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedMarketTrades.slice(0, 8).map((trade) => {
                        const option = selectedMarketOptions.find((item) => item.id === trade.option_id);
                        return (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white/85">{option?.label ?? "Opcion"}</p>
                              <p className="text-xs text-white/50">{new Date(trade.created_at).toLocaleString("es-DO")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#65bfff]">{(Number(trade.price ?? 0) * 100).toFixed(1)}%</p>
                              <p className="text-xs uppercase text-white/45">{trade.side}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {!hasPredictionOptions ? (
                  <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm text-white/70">Este mercado no tiene opciones configuradas para registrar predicciones.</p>
                  </article>
                ) : (
                  selectedMarketOptions.map((option, index) => {
                    const isPrimary = index % 2 === 0;
                    const optionProbability =
                      selectedMarketProbabilities.get(option.id) ??
                      (selectedMarketOptions.length > 0 ? 1 / selectedMarketOptions.length : 0);
                    const buttonClassName = isPrimary
                      ? "w-full rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-45"
                      : "w-full rounded-xl border border-[#65bfff]/55 bg-[#65bfff]/10 px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] text-[#83c9ff] disabled:cursor-not-allowed disabled:opacity-45";

                    return (
                      <article key={option.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Prediccion: {option.label}</p>
                        {session?.user ? (
                          <>
                            <p className="mt-2 text-xs text-white/60">Balance disponible: {formatMoney(walletBalance)}</p>
                            <form action={placeBuyOrderAction} className="mt-3 space-y-2.5">
                              <input type="hidden" name="market_id" value={selectedMarket.id} />
                              <input type="hidden" name="category" value={currentCategory} />
                              <input type="hidden" name="option_id" value={option.id} />
                              <p className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">Resultado fijo: {option.label}</p>
                              <OrderFieldsClient
                                disabled={!selectedMarketOpenForPredictions}
                                submitLabel="Confirmar prediccion"
                                buttonClassName={buttonClassName}
                                fixedLimitPrice={optionProbability}
                              />
                            </form>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-white/70">
                            Para predecir, inicia sesion. <Link href="/auth/login" className="underline">Entrar</Link>
                          </p>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
