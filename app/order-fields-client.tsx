"use client";

import { useEffect, useState } from "react";

interface OrderFieldsClientProps {
  disabled?: boolean;
  submitLabel?: string;
  buttonClassName?: string;
  marketId: string;
  optionId: string;
}

interface LmsrQuote {
  average_price: number;
  cost: number;
  fee: number;
  probability_after: number;
  total: number;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function OrderFieldsClient({
  disabled = false,
  submitLabel = "Confirmar prediccion",
  buttonClassName = "w-full rounded-xl bg-linear-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-45",
  marketId,
  optionId,
}: OrderFieldsClientProps) {
  const [qtyStr, setQtyStr] = useState("");
  const [quote, setQuote] = useState<LmsrQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [isQuoting, setIsQuoting] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());

  const qty = parseFloat(qtyStr) || 0;

  const payout = qty;
  const gain = quote ? payout - quote.total : 0;
  const hasValues = qty > 0;
  const canSubmit = !disabled && hasValues && quote !== null && !isQuoting;

  useEffect(() => {
    if (!hasValues) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsQuoting(true);
      setQuoteError("");

      try {
        const params = new URLSearchParams({
          marketId,
          optionId,
          quantity: String(qty),
        });
        const response = await fetch(`/api/markets/lmsr-quote?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { quote?: LmsrQuote; error?: string };

        if (!response.ok || !payload.quote) {
          throw new Error(payload.error || "No se pudo calcular la cotizacion");
        }

        setQuote(payload.quote);
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "No se pudo calcular la cotizacion");
      } finally {
        if (!controller.signal.aborted) setIsQuoting(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hasValues, marketId, optionId, qty]);

  return (
    <>
      <input type="hidden" name="request_id" value={requestId} />

      <label className="space-y-1">
        <span className="text-xs text-white/60">Cantidad de contratos</span>
        <input
          type="number"
          name="quantity"
          min="1"
          step="1"
          required
          placeholder="Ej: 10"
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          value={qtyStr}
          onChange={(event) => {
            setQtyStr(event.target.value);
            setQuote(null);
            setQuoteError("");
          }}
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#8d45e6]"
        />
      </label>

      <div className="rounded-lg border border-[#83c9ff]/25 bg-[#83c9ff]/6 px-3 py-2 text-xs text-white/75">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">Vas a pagar ahora</p>
        <p className="mt-1 text-xl font-extrabold text-[#83c9ff]">
          {isQuoting ? (
            <span className="text-base font-semibold text-white/50">Calculando...</span>
          ) : quote ? (
            formatMoney(quote.total)
          ) : (
            <span className="text-base font-semibold text-white/50">Completa los campos</span>
          )}
        </p>
        {quote && (
          <p className="mt-1 text-[11px] text-white/60">
            Costo LMSR {formatMoney(quote.cost)} + comision {formatMoney(quote.fee)}
          </p>
        )}
        {quoteError ? <p className="mt-1 text-[11px] text-red-300">{quoteError}</p> : null}

        <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/70">
          <p>
            Precio promedio LMSR:{" "}
            <span className="font-semibold text-white/90">
              {quote ? quote.average_price.toFixed(4) : "—"}
            </span>
          </p>
          <p className="mt-0.5">
            Probabilidad despues de comprar:{" "}
            <span className="font-semibold text-white/90">
              {quote ? `${(quote.probability_after * 100).toFixed(1)}%` : "—"}
            </span>
          </p>
          <p className="mt-0.5">
            Retorno bruto al acertar:{" "}
            <span className="font-semibold text-emerald-300">
              {quote ? formatMoney(payout) : "—"}
            </span>
          </p>
          <p className="mt-0.5">
            Ganancia potencial neta de compra:{" "}
            <span className="font-semibold text-[#ffb37a]">
              {quote ? formatMoney(gain) : "—"}
            </span>
          </p>
        </div>
      </div>

      <button type="submit" disabled={!canSubmit} className={buttonClassName}>
        {quote ? `${submitLabel} · ${formatMoney(quote.total)}` : submitLabel}
      </button>
    </>
  );
}
