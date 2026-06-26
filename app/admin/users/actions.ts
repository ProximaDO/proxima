"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const updateProfileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40).optional(),
});

const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

const updateBalanceSchema = z.object({
  user_id: z.string().uuid(),
  balance_available: z.coerce.number().min(0).max(5_000_000),
});

const updateKycSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["pending", "submitted", "verified", "rejected", "requires_input"]),
  legal_full_name: z.string().trim().min(2).max(120),
  id_number: z.string().trim().min(5).max(50),
  phone: z.string().trim().min(7).max(30),
  address_line: z.string().trim().min(8).max(220),
  rejection_reason: z.string().trim().max(500).optional(),
});

const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});

function redirectWithError(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/admin/users?success=${encodeURIComponent(message)}`);
}

export async function updateAdminUserProfileAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const parsed = updateProfileSchema.safeParse({
    user_id: formData.get("user_id"),
    full_name: formData.get("full_name"),
    username: formData.get("username") || undefined,
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Perfil invalido");
  }

  const { user_id, full_name, username } = parsed.data;

  const { error } = await admin
    .from("profiles")
    .update({ full_name, username: username || null, updated_at: new Date().toISOString() })
    .eq("id", user_id);

  if (error) {
    redirectWithError(error.message || "No se pudo actualizar el perfil");
  }

  redirectWithSuccess("Perfil actualizado");
}

export async function updateAdminUserRoleAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const admin = createAdminClient();

  const parsed = updateRoleSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Rol invalido");
  }

  if (parsed.data.user_id === currentAdmin.id && parsed.data.role !== "admin") {
    redirectWithError("No puedes quitarte el rol admin a ti mismo");
  }

  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: parsed.data.user_id, role: parsed.data.role }, { onConflict: "user_id" });

  if (error) {
    redirectWithError(error.message || "No se pudo actualizar el rol");
  }

  redirectWithSuccess("Rol actualizado");
}

export async function setAdminUserBalanceAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const admin = createAdminClient();

  const parsed = updateBalanceSchema.safeParse({
    user_id: formData.get("user_id"),
    balance_available: formData.get("balance_available"),
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Balance invalido");
  }

  const { user_id, balance_available } = parsed.data;

  const { data: existing } = await admin
    .from("wallets")
    .select("id, balance_available")
    .eq("user_id", user_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (!existing?.id) {
    const { data: inserted, error: insertError } = await admin
      .from("wallets")
      .insert({ user_id, balance_available, balance_locked: 0, total_withdrawn: 0, updated_at: nowIso })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted?.id) {
      redirectWithError(insertError?.message || "No se pudo crear la wallet");
    }

    if (balance_available > 0) {
      const { error: movementError } = await admin
        .from("wallet_movements")
        .insert({
          wallet_id: inserted.id,
          user_id,
          movement_type: "admin_adjustment",
          amount: balance_available,
          balance_after: balance_available,
          metadata: {
            source: "admin_dashboard_set_balance",
            admin_id: currentAdmin.id,
          },
        });

      if (movementError) {
        redirectWithError(movementError.message || "Balance actualizado, pero no se pudo registrar movimiento");
      }
    }

    redirectWithSuccess("Wallet creada y balance actualizado");
  }

  const previousBalance = Number(existing.balance_available ?? 0);
  const delta = Number(balance_available - previousBalance);

  const { error: updateError } = await admin
    .from("wallets")
    .update({ balance_available, updated_at: nowIso })
    .eq("id", existing.id);

  if (updateError) {
    redirectWithError(updateError.message || "No se pudo actualizar balance");
  }

  if (delta !== 0) {
    const { error: movementError } = await admin
      .from("wallet_movements")
      .insert({
        wallet_id: existing.id,
        user_id,
        movement_type: "admin_adjustment",
        amount: delta,
        balance_after: balance_available,
        metadata: {
          source: "admin_dashboard_set_balance",
          admin_id: currentAdmin.id,
          previous_balance: previousBalance,
          target_balance: balance_available,
        },
      });

    if (movementError) {
      redirectWithError(movementError.message || "Balance actualizado, pero no se pudo registrar movimiento");
    }
  }

  redirectWithSuccess("Balance actualizado");
}

export async function updateAdminUserKycStatusAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const parsed = updateKycSchema.safeParse({
    user_id: formData.get("user_id"),
    status: formData.get("status"),
    legal_full_name: formData.get("legal_full_name"),
    id_number: formData.get("id_number"),
    phone: formData.get("phone"),
    address_line: formData.get("address_line"),
    rejection_reason: formData.get("rejection_reason") || undefined,
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "Estado KYC invalido");
  }

  const { user_id, status, legal_full_name, id_number, phone, address_line, rejection_reason } = parsed.data;

  const { data: existingKyc } = await admin
    .from("kyc_verifications")
    .select("id_document_path")
    .eq("user_id", user_id)
    .maybeSingle();

  if (status === "verified" && !existingKyc?.id_document_path) {
    redirectWithError("No se puede verificar sin documento de identidad cargado");
  }

  const { error } = await admin.rpc("upsert_kyc_verification", {
    p_user_id: user_id,
    p_status: status,
    p_rejection_reason: status === "rejected" ? (rejection_reason ?? "Rechazado por administrador") : null,
    p_last_error: null,
    p_stripe_session_id: null,
  });

  if (error) {
    redirectWithError(error.message || "No se pudo actualizar KYC");
  }

  const { error: identityError } = await admin
    .from("kyc_verifications")
    .update({
      legal_full_name,
      id_number,
      phone,
      address_line,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user_id);

  if (identityError) {
    redirectWithError(identityError.message || "KYC actualizado, pero no se pudo guardar la identidad");
  }

  redirectWithSuccess("Estado KYC actualizado");
}

export async function deleteAdminUserAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const admin = createAdminClient();

  const parsed = deleteUserSchema.safeParse({
    user_id: formData.get("user_id"),
  });

  if (!parsed.success) {
    redirectWithError("Usuario invalido");
  }

  if (parsed.data.user_id === currentAdmin.id) {
    redirectWithError("No puedes eliminar tu propia cuenta");
  }

  const { error } = await admin.auth.admin.deleteUser(parsed.data.user_id);

  if (error) {
    redirectWithError(error.message || "No se pudo eliminar el usuario");
  }

  redirectWithSuccess("Usuario eliminado");
}
