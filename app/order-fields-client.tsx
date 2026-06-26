"use client";

import { useState } from "react";

interface OrderFieldsClientProps {
  disabled?: boolean;
  submitLabel?: string;
  buttonClassName?: string;
  fixedLimitPrice?: number;
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
  fixedLimitPrice,
}: OrderFieldsClientProps) {
  const [qtyStr, setQtyStr] = useState("");

  const qty = parseFloat(qtyStr) || 0;

  const fixedPrice = Number.isFinite(fixedLimitPrice) ? Math.min(1, Math.max(0, Number(fixedLimitPrice))) : 0;
  const cost = fixedPrice * qty;
  const payout = qty;
  const gain = payout - cost;
  const hasValues = fixedPrice > 0 && qty > 0;

  return (
    <>
      {/* Campo oculto con el valor decimal que espera el backend */}
      <input
        type="hidden"
        name="limit_price"
        value={hasValues ? fixedPrice.toFixed(6) : ""}
      />

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
          onChange={(e) => setQtyStr(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#8d45e6]"
        />
      </label>

      <div className="rounded-lg border border-[#83c9ff]/25 bg-[#83c9ff]/6 px-3 py-2 text-xs text-white/75">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">Vas a pagar ahora</p>
        <p className="mt-1 text-xl font-extrabold text-[#83c9ff]">
          {hasValues ? formatMoney(cost) : <span className="text-base font-semibold text-white/50">Completa los campos</span>}
        </p>
        {hasValues && (
          <p className="mt-1 text-[11px] text-white/60">
            {qty} contratos × precio fijo {fixedPrice.toFixed(4)} = {formatMoney(cost)}
          </p>
        )}

        <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/70">
          <p>
            Precio fijo por contrato:{" "}
            <span className="font-semibold text-white/90">
              {fixedPrice > 0 ? fixedPrice.toFixed(4) : "—"}
            </span>
          </p>
          <p className="mt-0.5">
            Retorno bruto al acertar:{" "}
            <span className="font-semibold text-emerald-300">
              {hasValues ? formatMoney(payout) : "—"}
            </span>
          </p>
          <p className="mt-0.5">
            Ganancia potencial aprox.:{" "}
            <span className="font-semibold text-[#ffb37a]">
              {hasValues ? formatMoney(gain) : "—"}
            </span>
          </p>
        </div>
      </div>

      <button type="submit" disabled={disabled} className={buttonClassName}>
        {hasValues ? `${submitLabel} · ${formatMoney(cost)}` : submitLabel}
      </button>
    </>
  );
}
