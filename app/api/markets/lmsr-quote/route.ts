import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/ops/rate-limit";
import { getRequestIp } from "@/lib/ops/request";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const quoteSchema = z.object({
  marketId: z.uuid(),
  optionId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});

export async function GET(request: Request) {
  const rateLimit = consumeRateLimit(`lmsr-quote:${getRequestIp(request)}`, 120, 60_000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas cotizaciones. Intenta nuevamente en unos segundos." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      },
    );
  }

  const url = new URL(request.url);
  const parsed = quoteSchema.safeParse({
    marketId: url.searchParams.get("marketId"),
    optionId: url.searchParams.get("optionId"),
    quantity: url.searchParams.get("quantity"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de cotizacion invalidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_lmsr_buy", {
    p_market_id: parsed.data.marketId,
    p_option_id: parsed.data.optionId,
    p_quantity: parsed.data.quantity,
  });

  const quote = data?.[0];

  if (error || !quote) {
    return NextResponse.json(
      { error: error?.message || "No se pudo calcular la cotizacion" },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { quote },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
