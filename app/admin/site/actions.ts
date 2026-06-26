"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const comingSoonSettingsSchema = z.object({
  coming_soon_enabled: z.boolean(),
  coming_soon_target_at: z.string().trim().min(1, "Selecciona una fecha objetivo"),
  coming_soon_title: z.string().trim().min(3, "El titulo es demasiado corto").max(120),
  coming_soon_message: z.string().trim().min(10, "El mensaje es demasiado corto").max(600),
});

function toIsoFromLocalDateTime(raw: string) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function updateComingSoonSettingsAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const enabledRaw = formData.get("coming_soon_enabled") === "on";

  const parsed = comingSoonSettingsSchema.safeParse({
    coming_soon_enabled: enabledRaw,
    coming_soon_target_at: String(formData.get("coming_soon_target_at") ?? ""),
    coming_soon_title: String(formData.get("coming_soon_title") ?? ""),
    coming_soon_message: String(formData.get("coming_soon_message") ?? ""),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Parametros invalidos";
    redirect(`/admin/site?error=${encodeURIComponent(firstError)}`);
  }

  const targetIso = toIsoFromLocalDateTime(parsed.data.coming_soon_target_at);
  if (!targetIso) {
    redirect("/admin/site?error=Fecha+objetivo+invalida");
  }

  const payload = {
    id: 1,
    coming_soon_enabled: parsed.data.coming_soon_enabled,
    coming_soon_target_at: targetIso,
    coming_soon_title: parsed.data.coming_soon_title,
    coming_soon_message: parsed.data.coming_soon_message,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    redirect(`/admin/site?error=${encodeURIComponent(error.message || "No se pudo guardar la configuracion")}`);
  }

  redirect("/admin/site?success=Configuracion+guardada");
}
