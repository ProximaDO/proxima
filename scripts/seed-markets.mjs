import { createClient } from "@supabase/supabase-js";

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.MARKET_SEED_ADMIN_EMAIL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const samples = [
  {
    title: "¿Quien sera el candidato del PRM en 2028?",
    description: "Mercado de prueba basado en mockup del cliente para categoria politica.",
    category: "Politica",
    options: ["Raquel Pena", "Jose Paliza", "Orlando J. Mera", "Otro"],
  },
  {
    title: "¿Quien sera el candidato del PLD en 2028?",
    description: "Mercado de prueba para validar libro y probabilidades en categoria politica.",
    category: "Politica",
    options: ["Danilo Medina", "Fco. Javier Garcia", "Otro"],
  },
  {
    title: "¿Quien ganara las Elecciones Presidenciales 2028?",
    description: "Mercado de prueba principal para simulacion de participacion electoral.",
    category: "Politica",
    options: ["PRM", "PLD", "FP / Otro"],
  },
  {
    title: "¿En que rango cerrara el TC (USD/DOP) a fin de mes?",
    description: "Mercado de prueba para categoria economia, inspirado en el mockup.",
    category: "Economia",
    options: ["< 58", "58.00 - 59.49", "59.50 - 60.99", ">= 61"],
  },
  {
    title: "¿Subira el costo de la canasta basica el proximo trimestre?",
    description: "Mercado de prueba para categoria social.",
    category: "Social",
    options: ["Si", "No", "Se mantendra estable"],
  },
  {
    title: "¿Ganara Republica Dominicana su proximo partido oficial?",
    description: "Mercado de prueba para categoria deportes.",
    category: "Deportes",
    options: ["Gana RD", "Empate", "Pierde RD"],
  },
];

const opensAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const closesAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

async function getSeedUserId() {
  if (ADMIN_EMAIL) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", ADMIN_EMAIL)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;

    throw new Error(`No se encontro profile con email ${ADMIN_EMAIL}`);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error("No se encontro ningun usuario/perfil. Registra al menos una cuenta primero.");
  }

  return data.id;
}

async function upsertSampleMarket(seedUserId, sample) {
  const slug = slugify(sample.title);

  const { data: existing, error: existingError } = await supabase
    .from("markets")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) throw existingError;

  let marketId = existing?.id;

  if (!marketId) {
    const { data: inserted, error: insertError } = await supabase
      .from("markets")
      .insert({
        title: sample.title,
        slug,
        description: sample.description,
        category: sample.category,
        status: "open",
        opens_at: opensAt,
        closes_at: closesAt,
        liquidity_b: 100,
        fee_bps: 0,
        created_by: seedUserId,
      })
      .select("id")
      .single();

    if (insertError || !inserted) throw insertError || new Error("No se pudo insertar mercado");
    marketId = inserted.id;
    console.log(`+ Mercado creado: ${sample.title}`);
  } else {
    console.log(`= Mercado existente: ${sample.title}`);
  }

  const { data: existingOptions, error: optionsError } = await supabase
    .from("market_options")
    .select("id")
    .eq("market_id", marketId)
    .limit(1);

  if (optionsError) throw optionsError;

  if (!existingOptions || existingOptions.length === 0) {
    const optionRows = sample.options.map((label, idx) => ({
      market_id: marketId,
      label,
      sort_order: idx,
      is_active: true,
    }));

    const { error: insertOptionsError } = await supabase.from("market_options").insert(optionRows);
    if (insertOptionsError) throw insertOptionsError;

    console.log(`  + Opciones creadas (${sample.options.length})`);
  }
}

async function main() {
  const seedUserId = await getSeedUserId();
  console.log(`Usando usuario seed: ${seedUserId}`);

  for (const sample of samples) {
    await upsertSampleMarket(seedUserId, sample);
  }

  console.log("Seed de mercados finalizado");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
