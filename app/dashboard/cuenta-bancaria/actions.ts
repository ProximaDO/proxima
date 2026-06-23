"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireNonAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptAccountNumber } from "@/lib/crypto/bank-account";

const addBankAccountSchema = z.object({
  bank_name: z.string().trim().min(1).max(100),
  account_holder_name: z.string().trim().min(2).max(120),
  account_number: z
    .string()
    .trim()
    .min(4)
    .max(30)
    .regex(/^\d+$/, "Solo se permiten dígitos"),
  account_type: z.enum(["checking", "savings"]),
});

export async function addBankAccountAction(formData: FormData) {
  const session = await requireNonAdmin();
  const supabase = await createClient();

  const parsed = addBankAccountSchema.safeParse({
    bank_name: formData.get("bank_name"),
    account_holder_name: formData.get("account_holder_name"),
    account_number: formData.get("account_number"),
    account_type: formData.get("account_type"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    redirect(`/dashboard/cuenta-bancaria?error=${encodeURIComponent(msg)}`);
  }

  const { bank_name, account_holder_name, account_number, account_type } = parsed.data;
  const last4 = account_number.slice(-4);
  const encrypted = encryptAccountNumber(account_number);

  // Contar cuentas activas para decidir si será la primera (y por tanto primaria)
  const { count } = await supabase
    .from("bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.id)
    .eq("is_active", true);

  const isPrimary = (count ?? 0) === 0;

  const { error } = await supabase.from("bank_accounts").insert({
    user_id: session.id,
    bank_name,
    account_holder_name,
    account_last4: last4,
    account_number_encrypted: encrypted,
    account_type,
    is_primary: isPrimary,
    is_active: true,
  });

  if (error) {
    redirect(`/dashboard/cuenta-bancaria?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/cuenta-bancaria?success=Cuenta+bancaria+guardada+exitosamente");
}

export async function setPrimaryBankAccountAction(formData: FormData) {
  const session = await requireNonAdmin();
  const supabase = await createClient();

  const accountId = z.uuid().safeParse(formData.get("account_id"));
  if (!accountId.success) {
    redirect("/dashboard/cuenta-bancaria?error=Cuenta+inválida");
  }

  // Quitar primaria de todas
  await supabase
    .from("bank_accounts")
    .update({ is_primary: false })
    .eq("user_id", session.id);

  // Marcar la seleccionada
  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_primary: true })
    .eq("id", accountId.data)
    .eq("user_id", session.id);

  if (error) {
    redirect(`/dashboard/cuenta-bancaria?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard/cuenta-bancaria?success=Cuenta+principal+actualizada");
}

export async function deleteBankAccountAction(formData: FormData) {
  const session = await requireNonAdmin();
  const supabase = await createClient();

  const accountId = z.uuid().safeParse(formData.get("account_id"));
  if (!accountId.success) {
    redirect("/dashboard/cuenta-bancaria?error=Cuenta+inválida");
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("deactivate_bank_account", {
    p_account_id: accountId.data,
  });

  if (error) {
    redirect(`/dashboard/cuenta-bancaria?error=${encodeURIComponent(error.message)}`);
  }

  // Si era la primaria, promover la siguiente cuenta activa
  const { data: remaining } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("user_id", session.id)
    .eq("is_active", true)
    .limit(1);

  if (remaining && remaining.length > 0) {
    await supabase
      .from("bank_accounts")
      .update({ is_primary: true })
      .eq("id", remaining[0].id);
  }

  redirect("/dashboard/cuenta-bancaria?success=Cuenta+bancaria+eliminada");
}
