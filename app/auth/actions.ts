"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/auth/validation";
import { opsLogger } from "@/lib/ops/logger";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getPublicAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${preview}`;

  return null;
}

export async function loginAction(formData: FormData) {
  const rawIdentifier = getString(formData, "identifier").trim();
  const parsed = loginSchema.safeParse({
    identifier: rawIdentifier,
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    opsLogger.warn("auth.login.invalid_input", {
      identifier: rawIdentifier,
    });
    redirect("/auth/login?error=Credenciales+invalidas");
  }

  const normalizedIdentifier = parsed.data.identifier.toLowerCase();
  let resolvedEmail = normalizedIdentifier;

  if (!normalizedIdentifier.includes("@")) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: profileByUsername } = await createAdminClient()
      .from("profiles")
      .select("email")
      .eq("username", normalizedIdentifier)
      .maybeSingle();

    if (!profileByUsername?.email) {
      opsLogger.warn("auth.login.username_not_found", {
        username: normalizedIdentifier,
      });
      redirect("/auth/login?error=No+se+pudo+iniciar+sesion");
    }

    resolvedEmail = String(profileByUsername.email).toLowerCase();
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password: parsed.data.password,
  });

  if (error) {
    opsLogger.warn("auth.login.failed", {
      identifier: parsed.data.identifier,
      email: resolvedEmail,
      reason: error.message,
    });
    redirect("/auth/login?error=No+se+pudo+iniciar+sesion");
  }

  opsLogger.info("auth.login.success", {
    identifier: parsed.data.identifier,
    email: resolvedEmail,
  });

  const userId = signInData.user?.id;
  if (userId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: roleData } = await createAdminClient()
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role === "admin") {
      redirect("/admin");
    }
  }

  redirect("/");
}

export async function registerAction(formData: FormData) {
  const rawEmail = getString(formData, "email").trim().toLowerCase();
  const parsed = registerSchema.safeParse({
    email: rawEmail,
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    opsLogger.warn("auth.register.invalid_input", {
      email: rawEmail,
    });
    redirect("/auth/register?error=Datos+invalidos");
  }

  const supabase = await createClient();
  const appUrl = getPublicAppUrl();
  const { data: signUpData, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: appUrl
      ? {
          emailRedirectTo: `${appUrl}/auth/login?success=Correo+confirmado.+Ya+puedes+iniciar+sesion`,
        }
      : undefined,
  });

  if (error) {
    opsLogger.warn("auth.register.failed", {
      email: parsed.data.email,
      reason: error.message,
    });
    redirect("/auth/register?error=No+se+pudo+crear+la+cuenta");
  }

  // Crear registro KYC pendiente para el nuevo usuario
  if (signUpData.user) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    await createAdminClient().rpc("upsert_kyc_verification", {
      p_user_id: signUpData.user.id,
      p_stripe_session_id: null,
      p_status: "pending",
    });
  }

  opsLogger.info("auth.register.created", {
    email: parsed.data.email,
    emailRedirectConfigured: Boolean(appUrl),
  });

  redirect("/auth/login?success=Cuenta+creada.+Revisa+tu+correo+para+confirmar+el+acceso");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
