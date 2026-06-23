"use client";

import { useState } from "react";

interface OrderFieldsClientProps {
  disabled?: boolean;
  submitLabel?: string;
  buttonClassName?: string;
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
}: OrderFieldsClientProps) {
  const [probStr, setProbStr] = useState("");
  const [qtyStr, setQtyStr] = useState("");

  const prob = parseFloat(probStr) || 0;
  const qty = parseFloat(qtyStr) || 0;

  const probDecimal = Math.min(1, Math.max(0, prob / 100));
  const cost = probDecimal * qty;
  const payout = qty;
  const gain = payout - cost;
  const hasValues = prob > 0 && qty > 0;

  return (
    <>
      {/* Campo oculto con el valor decimal que espera el backend */}
      <input
        type="hidden"
        name="limit_price"
        value={hasValues ? probDecimal.toFixed(6) : ""}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-white/60">Probabilidad (%)</span>
          <input
            type="number"
            min="0.1"
            max="99.9"
            step="0.1"
            required
            placeholder="Ej: 62.5"
            disabled={disabled}
            inputMode="decimal"
            autoComplete="off"
            value={probStr}
            onChange={(e) => setProbStr(e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#8d45e6]"
          />
        </label>

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
      </div>

      <div className="rounded-lg border border-[#83c9ff]/25 bg-[#83c9ff]/6 px-3 py-2 text-xs text-white/75">
        <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">Vas a pagar ahora</p>
        <p className="mt-1 text-xl font-extrabold text-[#83c9ff]">
          {hasValues ? formatMoney(cost) : <span className="text-base font-semibold text-white/50">Completa los campos</span>}
        </p>
        {hasValues && (
          <p className="mt-1 text-[11px] text-white/60">
            {prob.toFixed(1)}% × {qty} contratos = {formatMoney(cost)}
          </p>
        )}

        <div className="mt-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/70">
          <p>
            Precio por contrato:{" "}
            <span className="font-semibold text-white/90">
              {hasValues ? probDecimal.toFixed(4) : "—"}
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
