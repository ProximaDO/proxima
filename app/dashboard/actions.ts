"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireNonAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const topupSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
});

const withdrawalSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  destination: z.string().trim().max(280).optional(),
});

function dashboardRedirectTarget(formData: FormData) {
  const raw = formData.get("redirect_to");
  if (typeof raw !== "string") return "/dashboard";

  // Guardrail: only allow internal dashboard redirects.
  if (!raw.startsWith("/dashboard")) return "/dashboard";
  return raw;
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function topUpWalletAction(formData: FormData) {
  await requireNonAdmin();
  const supabase = await createClient();

  const parsed = topupSchema.safeParse({
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    redirect("/dashboard?error=Monto+invalido+para+recarga");
  }

  const { error } = await supabase.rpc("credit_user_wallet", {
    p_amount: parsed.data.amount,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message || "No+se+pudo+recargar")}`);
  }

  redirect("/dashboard?success=Cuenta+recargada");
}

export async function submitKycDocumentAction(formData: FormData) {
  const user = await requireNonAdmin();
  const supabase = await createClient();

  const fileEntry = formData.get("identity_document");
  if (!(fileEntry instanceof File)) {
    redirect("/dashboard/verificacion?error=Debes+adjuntar+un+documento");
  }

  if (fileEntry.size <= 0) {
    redirect("/dashboard/verificacion?error=El+archivo+esta+vacio");
  }

  const maxSize = 10 * 1024 * 1024;
  if (fileEntry.size > maxSize) {
    redirect("/dashboard/verificacion?error=El+archivo+supera+el+limite+de+10MB");
  }

  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  const mimeType = fileEntry.type || "application/octet-stream";
  if (!allowed.has(mimeType)) {
    redirect("/dashboard/verificacion?error=Formato+no+permitido.+Usa+JPG,+PNG,+WEBP+o+PDF");
  }

  const originalName = sanitizeFilename(fileEntry.name || "documento");
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "bin";
  const objectPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const fileBytes = await fileEntry.arrayBuffer();

  const { error: uploadError } = await supabase
    .storage
    .from("kyc-documents")
    .upload(objectPath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    redirect(`/dashboard/verificacion?error=${encodeURIComponent(uploadError.message || "No+se+pudo+subir+el+documento")}`);
  }

  const { error: rpcError } = await supabase.rpc("submit_kyc_document", {
    p_document_path: objectPath,
  });

  if (rpcError) {
    redirect(`/dashboard/verificacion?error=${encodeURIComponent(rpcError.message || "No+se+pudo+registrar+la+solicitud")}`);
  }

  redirect("/dashboard/verificacion?success=Documento+cargado+y+solicitud+enviada+para+revision");
}

export async function requestWithdrawalAction(formData: FormData) {
  const session = await requireNonAdmin();
  const supabase = await createClient();

  const parsed = withdrawalSchema.safeParse({
    amount: formData.get("amount"),
    destination: formData.get("destination") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard?error=Parametros+invalidos+para+retiro");
  }

  // Guard 1: KYC verificado
  const { data: kycData } = await supabase
    .from("kyc_verifications")
    .select("status")
    .eq("user_id", session.id)
    .maybeSingle();

  if (!kycData || kycData.status !== "verified") {
    redirect(
      `/dashboard?error=${encodeURIComponent("Debes verificar tu identidad antes de solicitar retiros. Ve a Configuración → Verificación de identidad.")}`,
    );
  }

  // Guard 2: Cuenta bancaria primaria activa registrada
  const { data: bankAccount } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_last4")
    .eq("user_id", session.id)
    .eq("is_primary", true)
    .eq("is_active", true)
    .maybeSingle();

  if (!bankAccount) {
    redirect(
      `/dashboard?error=${encodeURIComponent("Debes registrar una cuenta bancaria antes de solicitar retiros. Ve a Configuración → Cuentas bancarias.")}`,
    );
  }

  const destination = {
    channel: "bank_transfer",
    bank_account_id: bankAccount.id,
    bank_name: bankAccount.bank_name,
    account_last4: bankAccount.account_last4,
  };

  const { error } = await supabase.rpc("request_withdrawal", {
    p_amount: parsed.data.amount,
    p_destination: destination,
  });

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error.message || "No+se+pudo+solicitar+retiro")}`);
  }

  redirect("/dashboard?success=Solicitud+de+retiro+registrada.+Sera+procesada+en+los+proximos+dias+habiles.");
}

export async function markNotificationReadAction(formData: FormData) {
  await requireNonAdmin();
  const supabase = await createClient();
  const redirectTo = dashboardRedirectTarget(formData);

  const rawId = formData.get("notification_id");
  const parsed = z.uuid().safeParse(rawId);

  if (!parsed.success) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=Notificacion+invalida`);
  }

  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: parsed.data,
    p_read: true,
  });

  if (error) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message || "No+se+pudo+actualizar")}`);
  }

  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}success=Notificacion+marcada+como+leida`);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  await requireNonAdmin();
  const supabase = await createClient();
  const redirectTo = dashboardRedirectTarget(formData);

  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message || "No+se+pudo+actualizar")}`);
  }

  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}success=Notificaciones+marcadas+como+leidas`);
}
