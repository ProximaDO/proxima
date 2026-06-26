import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { labelMarketStatus } from "@/lib/ui/labels-es-do";
import { changeMarketStatusAction, resolveMarketAction } from "@/app/admin/markets/actions";

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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    participantQ?: string;
    participantSort?: string;
    participantPage?: string;
  }>;
}

export default async function MarketDetailPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { error, success, participantQ: participantQRaw, participantSort: participantSortRaw, participantPage: participantPageRaw } = await searchParams;
  const supabase = await createClient();

  const { data: market } = await supabase
    .from("markets")
    .select("id, title, description, status, category, liquidity_b, fee_bps, closes_at, resolved_at, resolution_option_id")
    .eq("id", id)
    .maybeSingle();

  if (!market) notFound();

  type MarketOption = { id: string; label: string; sort_order: number };
  const [{ data: optionsData }, { data: resolutionOptionData }] = await Promise.all([
    supabase
      .from("market_options")
      .select("id, label, sort_order")
      .eq("market_id", id)
      .order("sort_order", { ascending: true }),
    market.resolution_option_id
      ? supabase
          .from("market_options")
          .select("label")
          .eq("id", market.resolution_option_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const options = (optionsData ?? []) as MarketOption[];

  const { data: ordersData } = await supabase
    .from("limit_orders")
    .select("id, user_id, option_id, side, status, quantity, quantity_filled, total_cost, created_at")
    .eq("market_id", id)
    .order("created_at", { ascending: false })
    .limit(5000);

  type MarketOrder = {
    id: string;
    user_id: string;
    option_id: string;
    side: string;
    status: string;
    quantity: number;
    quantity_filled: number;
    total_cost: number;
    created_at: string;
  };

  const marketOrders = (ordersData ?? []) as MarketOrder[];
  const participantUserIds = Array.from(new Set(marketOrders.map((row) => row.user_id)));

  const { data: profilesData } = participantUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, username")
        .in("id", participantUserIds)
    : { data: [] as Array<{ id: string; email: string | null; full_name: string | null; username: string | null }> };

  const profileById = new Map((profilesData ?? []).map((profile) => [profile.id, profile]));

  const participantAgg = new Map<
    string,
    {
      orders: number;
      buyOrders: number;
      invested: number;
      lastActivityAt: string;
    }
  >();

  const optionAgg = new Map<string, { predictions: number; totalReceived: number }>();

  for (const option of options) {
    optionAgg.set(option.id, { predictions: 0, totalReceived: 0 });
  }

  for (const order of marketOrders) {
    const current = participantAgg.get(order.user_id) ?? {
      orders: 0,
      buyOrders: 0,
      invested: 0,
      lastActivityAt: order.created_at,
    };

    current.orders += 1;
    if (order.side === "buy") {
      const cost = Number(order.total_cost ?? 0);

      current.buyOrders += 1;
      current.invested += cost;

      const optionStats = optionAgg.get(order.option_id) ?? { predictions: 0, totalReceived: 0 };
      optionStats.predictions += 1;
      optionStats.totalReceived += cost;
      optionAgg.set(order.option_id, optionStats);
    }

    if (new Date(order.created_at).getTime() > new Date(current.lastActivityAt).getTime()) {
      current.lastActivityAt = order.created_at;
    }

    participantAgg.set(order.user_id, current);
  }

  const participantBaseRows = Array.from(participantAgg.entries())
    .map(([userId, stats]) => {
      const profile = profileById.get(userId);
      const displayName = profile?.full_name ?? profile?.username ?? profile?.email ?? `Usuario ${userId.slice(0, 8)}...`;

      return {
        userId,
        displayName,
        email: profile?.email ?? null,
        ...stats,
      };
    });

  const participantQ = (participantQRaw ?? "").trim();
  const participantQNormalized = participantQ.toLowerCase();
  const participantSort =
    participantSortRaw === "invested_asc" ||
    participantSortRaw === "predictions_desc" ||
    participantSortRaw === "activity_desc"
      ? participantSortRaw
      : "invested_desc";

  const filteredParticipantRows = participantQNormalized
    ? participantBaseRows.filter((row) => {
        const haystack = [row.displayName, row.email ?? "", row.userId].join(" ").toLowerCase();
        return haystack.includes(participantQNormalized);
      })
    : participantBaseRows;

  const participantRows = [...filteredParticipantRows].sort((a, b) => {
    if (participantSort === "invested_asc") {
      if (a.invested !== b.invested) return a.invested - b.invested;
      return b.buyOrders - a.buyOrders;
    }

    if (participantSort === "predictions_desc") {
      if (b.buyOrders !== a.buyOrders) return b.buyOrders - a.buyOrders;
      return b.invested - a.invested;
    }

    if (participantSort === "activity_desc") {
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    }

    if (b.invested !== a.invested) return b.invested - a.invested;
    return b.buyOrders - a.buyOrders;
  });

  const participantPageSize = 10;
  const totalParticipantPages = Math.max(1, Math.ceil(participantRows.length / participantPageSize));
  const requestedPage = Number(participantPageRaw ?? "1");
  const currentParticipantPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(totalParticipantPages, Math.floor(requestedPage)) : 1;
  const participantStart = (currentParticipantPage - 1) * participantPageSize;
  const visibleParticipantRows = participantRows.slice(participantStart, participantStart + participantPageSize);

  const buildParticipantHref = (next: { page?: number; sort?: string; q?: string }) => {
    const params = new URLSearchParams();
    const nextQ = next.q ?? participantQ;
    const nextSort = next.sort ?? participantSort;
    const nextPage = next.page ?? currentParticipantPage;

    if (nextQ.trim()) params.set("participantQ", nextQ.trim());
    if (nextSort !== "invested_desc") params.set("participantSort", nextSort);
    if (nextPage > 1) params.set("participantPage", String(nextPage));

    const query = params.toString();
    return query ? `/admin/markets/${id}?${query}` : `/admin/markets/${id}`;
  };

  const totalPredictions = marketOrders.filter((row) => row.side === "buy").length;
  const totalInvestment = participantRows.reduce((acc, row) => acc + row.invested, 0);
  const participantsCount = participantRows.length;
  const avgTicket = totalPredictions > 0 ? totalInvestment / totalPredictions : 0;
  const avgInvestmentPerParticipant = participantsCount > 0 ? totalInvestment / participantsCount : 0;

  const optionRows = options.map((option) => {
    const stats = optionAgg.get(option.id) ?? { predictions: 0, totalReceived: 0 };
    return {
      id: option.id,
      label: option.label,
      predictions: stats.predictions,
      totalReceived: stats.totalReceived,
    };
  });

  const totalOptionInvestment = optionRows.reduce((acc, row) => acc + row.totalReceived, 0);
  const optionPalette = ["#66b4ff", "#7f30de", "#ff9c3f", "#4ade80", "#f87171", "#22d3ee", "#c084fc", "#facc15"];
  const optionPieRows = optionRows.map((row, index) => ({
    ...row,
    color: optionPalette[index % optionPalette.length],
    share: totalOptionInvestment > 0 ? row.totalReceived / totalOptionInvestment : 0,
  }));

  let optionAngleStart = 0;
  const optionPieStops = optionPieRows.map((row) => {
    const optionAngleEnd = optionAngleStart + row.share * 360;
    const stop = `${row.color} ${optionAngleStart.toFixed(2)}deg ${optionAngleEnd.toFixed(2)}deg`;
    optionAngleStart = optionAngleEnd;
    return stop;
  });

  const optionPieGradient =
    optionPieStops.length > 0
      ? `conic-gradient(${optionPieStops.join(", ")})`
      : "conic-gradient(#ffffff22 0deg 360deg)";

  return (
    <main className="admin-fade-in mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="text-sm text-white/60 hover:text-white"
        >
          ← Mercados
        </Link>
        <span className="text-white/30">/</span>
        <span className="truncate text-sm text-white/70">{market.title}</span>
      </div>

      <header className="admin-card flex items-start justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-snug">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-sm text-white/65">{market.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            market.status === "open"
              ? "bg-emerald-400/20 text-emerald-300"
              : market.status === "closed"
                ? "bg-amber-300/20 text-amber-200"
                : market.status === "resolved"
                  ? "bg-blue-400/20 text-blue-300"
                  : "bg-white/15 text-white/65"
          }`}
        >
          {labelMarketStatus(market.status)}
        </span>
      </header>

      {error && (
        <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
          {decodeURIComponent(success)}
        </div>
      )}

      <dl className="admin-card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-white/50">Categoria</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.category ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Liquidez b</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.liquidity_b}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Comision</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">{market.fee_bps} bps</dd>
        </div>
        <div>
          <dt className="text-xs text-white/50">Cierra</dt>
          <dd className="mt-0.5 text-sm font-medium text-white">
            {market.closes_at
              ? new Date(market.closes_at).toLocaleDateString("es-DO")
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="admin-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">Participantes</p>
          <p className="mt-2 text-3xl font-extrabold text-[#83c9ff]">{participantsCount}</p>
          <p className="mt-1 text-xs text-white/55">Usuarios con predicciones en este mercado</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">Predicciones</p>
          <p className="mt-2 text-3xl font-extrabold text-white">{formatCompact(totalPredictions)}</p>
          <p className="mt-1 text-xs text-white/55">Ordenes tipo buy registradas</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">Inversion total recibida</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-300">{formatMoney(totalInvestment)}</p>
          <p className="mt-1 text-xs text-white/55">Capital comprometido por usuarios</p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">Ticket promedio</p>
          <p className="mt-2 text-3xl font-extrabold text-white">{formatMoney(avgTicket)}</p>
          <p className="mt-1 text-xs text-white/55">Capital por participante: {formatMoney(avgInvestmentPerParticipant)}</p>
        </div>
      </section>

      <section className="admin-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white/80">Participantes del mercado</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/users" className="admin-btn-muted">
              Ver usuarios
            </Link>
          </div>
        </div>

        <form method="get" action={`/admin/markets/${id}`} className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
          <input
            type="text"
            name="participantQ"
            defaultValue={participantQ}
            placeholder="Buscar por nombre, correo o ID"
            className="admin-input"
          />
          <select
            name="participantSort"
            defaultValue={participantSort}
            className="admin-input bg-[#1a2a66] text-white [color-scheme:dark]"
          >
            <option value="invested_desc">Mayor inversion</option>
            <option value="invested_asc">Menor inversion</option>
            <option value="predictions_desc">Mas predicciones</option>
            <option value="activity_desc">Actividad mas reciente</option>
          </select>
          <button type="submit" className="admin-btn-muted">
            Aplicar
          </button>
        </form>

        {participantRows.length > 0 && (
          <p className="mt-3 text-xs text-white/55">
            Mostrando {visibleParticipantRows.length} de {participantRows.length} participantes
            {participantQ ? ` para "${participantQ}"` : ""}.
          </p>
        )}

        {participantRows.length === 0 ? (
          <p className="mt-4 text-sm text-white/60">Este mercado aun no tiene predicciones registradas.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-white/45">
                  <th className="px-3 py-3">Usuario</th>
                  <th className="px-3 py-3">Predicciones</th>
                  <th className="px-3 py-3">Invertido</th>
                  <th className="px-3 py-3">Ticket prom.</th>
                  <th className="px-3 py-3">Ult. actividad</th>
                </tr>
              </thead>
              <tbody>
                {visibleParticipantRows.map((row) => (
                  <tr key={row.userId} className="border-b border-white/8 last:border-b-0">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/users?user=${row.userId}`}
                        className="font-semibold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white/70"
                      >
                        {row.displayName}
                      </Link>
                      <p className="text-xs text-white/60">{row.email ?? row.userId}</p>
                    </td>
                    <td className="px-3 py-3 text-white/85">{row.buyOrders}</td>
                    <td className="px-3 py-3 font-semibold text-white">{formatMoney(row.invested)}</td>
                    <td className="px-3 py-3 text-white/85">{formatMoney(row.buyOrders > 0 ? row.invested / row.buyOrders : 0)}</td>
                    <td className="px-3 py-3 text-white/70">{new Date(row.lastActivityAt).toLocaleString("es-DO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {participantRows.length > participantPageSize && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-white/60">
              Pagina {currentParticipantPage} de {totalParticipantPages}
            </p>
            <div className="flex items-center gap-2">
              {currentParticipantPage > 1 ? (
                <Link href={buildParticipantHref({ page: currentParticipantPage - 1 })} className="admin-btn-muted">
                  Anterior
                </Link>
              ) : (
                <span className="admin-btn-muted pointer-events-none opacity-50">Anterior</span>
              )}

              {currentParticipantPage < totalParticipantPages ? (
                <Link href={buildParticipantHref({ page: currentParticipantPage + 1 })} className="admin-btn-muted">
                  Siguiente
                </Link>
              ) : (
                <span className="admin-btn-muted pointer-events-none opacity-50">Siguiente</span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="admin-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-white/80">Distribucion por opcion</h2>
          <p className="text-xs text-white/55">Predicciones y monto recibido (DOP)</p>
        </div>

        {totalOptionInvestment <= 0 ? (
          <p className="mt-4 text-sm text-white/60">Aun no hay predicciones con monto para graficar por opcion.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[170px_1fr] md:items-center">
            <div className="mx-auto h-40 w-40 rounded-full p-3" style={{ background: optionPieGradient }}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b1f63] text-center">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Total recibido</p>
                <p className="mt-1 text-base font-extrabold text-white">{formatMoney(totalOptionInvestment)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {optionPieRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="truncate font-semibold text-white">{row.label}</span>
                    </div>
                    <span>{(row.share * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${Math.max(6, row.share * 100)}%`, backgroundColor: row.color }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
                    <span>{row.predictions} predicciones</span>
                    <span>{formatMoney(row.totalReceived)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="admin-card p-5">
        <h2 className="text-sm font-medium text-white/80">Opciones</h2>
        <ul className="mt-3 space-y-2">
          {optionRows.map((opt) => (
            <li
              key={opt.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#66b4ff]" />
                <span className="truncate">{opt.label}</span>
              </div>
              <div className="text-right text-xs text-white/75">
                <p>{opt.predictions} predicciones</p>
                <p className="font-semibold text-white">{formatMoney(opt.totalReceived)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {market.status === "resolved" && (
        <section className="admin-card border-blue-400/25 bg-blue-500/10 p-5">
          <h2 className="text-sm font-medium text-blue-200">Resultado oficial</h2>
          <p className="mt-2 text-sm text-blue-100">
            Opcion ganadora: <span className="font-semibold">{resolutionOptionData?.label ?? "No disponible"}</span>
          </p>
          <p className="mt-1 text-xs text-blue-200/70">
            Resuelto el {market.resolved_at ? new Date(market.resolved_at).toLocaleString("es-DO") : "—"}
          </p>
        </section>
      )}

      {market.status === "closed" && (
        <section className="admin-card p-5">
          <h2 className="text-sm font-medium text-white/80">Resolver mercado</h2>
          <p className="mt-1 text-xs text-white/55">
            Esta accion cancela ordenes abiertas, liquida posiciones y marca el mercado como resuelto.
          </p>

          <form action={resolveMarketAction} className="mt-4 space-y-3">
            <input type="hidden" name="market_id" value={market.id} />

            <div className="space-y-1">
              <label htmlFor="winning_option_id" className="text-xs text-white/60">
                Opcion ganadora
              </label>
              <select
                id="winning_option_id"
                name="winning_option_id"
                required
                className="admin-input"
              >
                <option value="">
                  Selecciona una opcion
                </option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="resolution_note" className="text-xs text-white/60">
                Nota de resolucion (opcional)
              </label>
              <textarea
                id="resolution_note"
                name="resolution_note"
                rows={3}
                className="admin-input"
                placeholder="Fuente o criterio usado para resolver el mercado"
              />
            </div>

            <button
              type="submit"
              className="admin-btn-primary"
            >
              Resolver y liquidar
            </button>
          </form>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/markets/${id}/edit`}
          className="admin-btn-muted"
        >
          Editar
        </Link>

        {market.status === "draft" && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "open");
            }}
          >
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Abrir mercado
            </button>
          </form>
        )}

        {market.status === "open" && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "closed");
            }}
          >
            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Cerrar mercado
            </button>
          </form>
        )}

        {(market.status === "closed" || market.status === "draft") && (
          <form
            action={async () => {
              "use server";
              await changeMarketStatusAction(id, "archived");
            }}
          >
            <button
              type="submit"
              className="admin-btn-muted"
            >
              Archivar
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
