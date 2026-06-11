import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MarketRow = {
  id: string;
  title: string;
  category: string | null;
  status: "open" | "closed" | "resolved" | "archived" | "draft";
  closes_at: string | null;
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

function marketCountByCategory(markets: MarketRow[], category: string) {
  return markets.filter((m) => (m.category ?? "").toLowerCase() === category.toLowerCase()).length;
}

export default async function Home() {
  const supabase = await createClient();

  const [marketsResult, profilesCountResult, tradesResult] = await Promise.all([
    supabase
      .from("markets")
      .select("id, title, category, status, closes_at")
      .in("status", ["open", "closed", "resolved"])
      .order("created_at", { ascending: false })
      .limit(24),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("trades")
      .select("notional")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const markets = (marketsResult.data ?? []) as MarketRow[];
  const openMarkets = markets.filter((m) => m.status === "open");
  const featured = openMarkets.slice(0, 6);
  const tickerItems = (featured.length > 0 ? featured : markets.slice(0, 8)).map((market) => ({
    id: market.id,
    title: market.title,
    category: tickerLabel(market.category),
  }));

  const traderCount = profilesCountResult.count ?? 0;
  const recentVolume = (tradesResult.data ?? []).reduce((sum, row) => sum + Number(row.notional ?? 0), 0);

  const categories = [
    { label: "Todos", total: openMarkets.length },
    { label: "Politica", total: marketCountByCategory(openMarkets, "Politica") },
    { label: "Economia", total: marketCountByCategory(openMarkets, "Economia") },
    { label: "Social", total: marketCountByCategory(openMarkets, "Social") },
    { label: "Deportes", total: marketCountByCategory(openMarkets, "Deportes") },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040b2f] text-white">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-40" />
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-[#0d3a8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#ff623f]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7a31de]/25 blur-3xl" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07123b]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima"
              width={130}
              height={34}
              className="h-auto w-auto"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </Link>

          <nav className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm lg:flex">
            <Link href="/markets" className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white">
              Mercados
            </Link>
            <a href="#como-funciona" className="rounded-xl px-4 py-2 text-white/70 transition hover:text-white">
              Como funciona
            </a>
            <a href="#activos" className="rounded-xl px-4 py-2 text-white/70 transition hover:text-white">
              Activos
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-full border border-[#f7a93b]/70 px-4 py-2 text-sm font-bold text-[#f7a93b] transition hover:bg-[#f7a93b]/10"
            >
              RD$ 12,500
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full bg-gradient-to-r from-[#ff613f] to-[#7f30de] px-5 py-2 text-sm font-bold text-white shadow-[0_10px_26px_rgba(133,40,223,0.35)] transition hover:scale-[1.02]"
            >
              Depositar
            </Link>
          </div>
        </div>

        <div className="brand-marquee border-t border-white/10 bg-[#09154a]/80 py-2">
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

      <section className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
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
              Apuesta con datos, no con suerte.
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
                href="/markets"
                className="rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#842ddf] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_rgba(143,39,226,0.35)] transition hover:scale-[1.02]"
              >
                Explorar mercados
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white/85 transition hover:border-white/40 hover:text-white"
              >
                Crear cuenta
              </Link>
            </div>
          </div>

          <div className="brand-float rounded-3xl border border-white/10 bg-[#101f5b]/65 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#ff6941] to-[#6f31e5] px-4 py-3">
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold">Politica</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg">×</span>
            </div>

            <h2 className="mt-5 text-xl font-bold">¿Quien sera el candidato del PRM en 2028?</h2>

            <div className="mt-4 space-y-2.5">
              {["Raquel Pena", "Jose Paliza", "Orlando J. Mera", "Otro"].map((option, idx) => {
                const pcts = [45, 28, 17, 10];
                return (
                  <div key={option} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white/95">{option}</p>
                      <p className="font-extrabold text-[#ff6c3f]">{pcts[idx]}%</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff6a41] to-[#6241e6]"
                        style={{ width: `${pcts[idx]}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">Monto a apostar (RD$)</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold">500</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["+100", "+500", "+1,000", "+5,000"].map((quick) => (
                  <span key={quick} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/65">
                    {quick}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#6f31e5] px-5 py-3 text-base font-extrabold text-white shadow-[0_8px_24px_rgba(122,39,224,0.4)]"
            >
              Confirmar apuesta
            </button>
          </div>
        </div>
      </section>

      <section id="activos" className="mx-auto w-full max-w-7xl border-t border-white/10 px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((category, idx) => (
              <span
                key={category.label}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                  idx === 0
                    ? "border-[#ff6a41]/70 bg-gradient-to-r from-[#ff6a41]/90 to-[#7f30de]/90 text-white"
                    : "border-white/15 bg-white/5 text-white/70"
                }`}
              >
                {category.label} <span className="text-white/50">{category.total}</span>
              </span>
            ))}
          </div>
          <Link href="/markets" className="text-sm font-semibold text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
            Ver todos los mercados
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {(featured.length > 0 ? featured : markets.slice(0, 6)).map((market) => (
              <article key={market.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-white/95">{market.title}</h3>
                  <span className="rounded-full border border-white/15 bg-[#0f2059] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#65bfff]">
                    {tickerLabel(market.category)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/50">
                  <span>{market.closes_at ? `Cierra ${new Date(market.closes_at).toLocaleDateString("es-DO")}` : "Sin fecha de cierre"}</span>
                  <span>4 opciones</span>
                  <span>Liquidez activa</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-full w-[46%] rounded-full bg-gradient-to-r from-[#4ea1ff] to-[#7f30de]" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/60">Top opcion 46%</span>
                  <Link
                    href={`/markets/${market.id}`}
                    className="rounded-lg border border-[#ff6a41]/50 bg-[#ff6a41]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#ff8b66]"
                  >
                    Apostar
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-4" id="como-funciona">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Como funciona</p>
              <ol className="mt-3 space-y-3 text-sm text-white/75">
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ff6a41] text-xs font-extrabold text-white">1</span>
                  Deposita fondos en tu wallet.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#8a2fe0] text-xs font-extrabold text-white">2</span>
                  Elige mercado y analiza probabilidades.
                </li>
                <li>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2f6de0] text-xs font-extrabold text-white">3</span>
                  Confirma apuesta y cobra cuando aciertes.
                </li>
              </ol>
            </article>

            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2c70] to-[#0d1b52] p-5">
              <div className="flex items-center gap-3">
                <Image
                  src="/branding/isotipo.png"
                  alt="Isotipo Proxima"
                  width={42}
                  height={42}
                  className="h-auto w-auto"
                  style={{ width: "auto", height: "auto" }}
                />
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold">Proxima</p>
              </div>
              <p className="mt-3 text-sm text-white/70">
                Transparencia en reglas, gestion de riesgo operativa y resolucion auditada para tus predicciones.
              </p>
              <Link
                href="/auth/register"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em]"
              >
                Empieza ahora
              </Link>
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}
