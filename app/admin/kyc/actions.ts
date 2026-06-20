"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const reviewSchema = z.object({
  user_id: z.string().uuid(),
  decision: z.enum(["verified", "rejected"]),
  rejection_reason: z.string().trim().max(500).optional(),
});

export async function reviewKycAction(formData: FormData) {
  await requireAdmin();
  const adminClient = createAdminClient();

  const parsed = reviewSchema.safeParse({
    user_id: formData.get("user_id"),
    decision: formData.get("decision"),
    rejection_reason: formData.get("rejection_reason") || undefined,
  });

  if (!parsed.success) {
    redirect("/admin/kyc?error=Datos+invalidos");
  }

  const { user_id, decision, rejection_reason } = parsed.data;

  const { error } = await adminClient.rpc("upsert_kyc_verification", {
    p_user_id: user_id,
    p_stripe_session_id: null,
    p_status: decision,
    p_rejection_reason: decision === "rejected" ? (rejection_reason ?? "Rechazado por administrador") : null,
    p_last_error: null,
  });

  if (error) {
    redirect(`/admin/kyc?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin/kyc?success=${encodeURIComponent(decision === "verified" ? "Usuario verificado correctamente" : "Usuario rechazado")}`);
}
