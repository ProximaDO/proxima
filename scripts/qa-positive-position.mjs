import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    userEmail: "",
    userId: "",
    marketId: "",
    minValue: 0,
    limit: 20,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--user-email") out.userEmail = String(args[i + 1] ?? "").trim();
    if (arg === "--user-id") out.userId = String(args[i + 1] ?? "").trim();
    if (arg === "--market-id") out.marketId = String(args[i + 1] ?? "").trim();
    if (arg === "--min-value") out.minValue = Number(args[i + 1] ?? 0);
    if (arg === "--limit") out.limit = Number(args[i + 1] ?? 20);
  }

  return out;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function money(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(value);
}

function printUsage() {
  console.log("Uso:");
  console.log("  node scripts/qa-positive-position.mjs --user-email correo@dominio.com [--market-id uuid] [--min-value 1]");
  console.log("  node scripts/qa-positive-position.mjs --user-id uuid [--market-id uuid] [--min-value 1]");
}

async function main() {
  loadEnv();
  const params = parseArgs();

  if (!params.userEmail && !params.userId) {
    printUsage();
    fail("Debes indicar --user-email o --user-id");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let userId = params.userId;
  let userEmail = params.userEmail;

  if (!userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", params.userEmail)
      .maybeSingle();

    if (profileError) fail(`No se pudo leer profile: ${profileError.message}`);
    if (!profile?.id) fail("No se encontro usuario con ese email");

    userId = profile.id;
    userEmail = profile.email ?? params.userEmail;
  }

  let positionQuery = supabase
    .from("positions")
    .select("id, market_id, option_id, quantity, avg_entry_price, realized_pnl, updated_at")
    .eq("user_id", userId)
    .gt("quantity", 0)
    .order("updated_at", { ascending: false })
    .limit(params.limit);

  if (params.marketId) {
    positionQuery = positionQuery.eq("market_id", params.marketId);
  }

  const { data: positions, error: positionsError } = await positionQuery;
  if (positionsError) fail(`No se pudieron leer posiciones: ${positionsError.message}`);

  const rows = (positions ?? []).map((p) => {
    const quantity = Number(p.quantity ?? 0);
    const avgPrice = Number(p.avg_entry_price ?? 0);
    const value = quantity * avgPrice;

    return {
      id: p.id,
      market_id: p.market_id,
      option_id: p.option_id,
      quantity,
      avg_entry_price: avgPrice,
      position_value: value,
      realized_pnl: Number(p.realized_pnl ?? 0),
      updated_at: p.updated_at,
    };
  });

  const positive = rows.filter((r) => r.position_value > params.minValue);

  console.log("\\nQA: posicion positiva");
  console.log(`Usuario: ${userEmail || "(sin email)"}`);
  console.log(`User ID: ${userId}`);
  console.log(`Filtro market_id: ${params.marketId || "(todos)"}`);
  console.log(`Umbral minimo: ${money(params.minValue)}\\n`);

  if (rows.length === 0) {
    fail("No hay posiciones abiertas (quantity > 0) para ese filtro");
  }

  console.table(
    rows.map((r) => ({
      id: r.id.slice(0, 8),
      market: r.market_id.slice(0, 8),
      option: r.option_id.slice(0, 8),
      qty: r.quantity,
      avg: r.avg_entry_price,
      value: Number(r.position_value.toFixed(6)),
      pnl: Number(r.realized_pnl.toFixed(6)),
      updated_at: r.updated_at,
    })),
  );

  if (positive.length === 0) {
    fail("Hay posiciones abiertas, pero ninguna supera el umbral minimo solicitado");
  }

  const totalValue = positive.reduce((acc, row) => acc + row.position_value, 0);
  console.log(`\\nOK: ${positive.length} posicion(es) con valor positivo. Total: ${money(totalValue)}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Error inesperado");
});