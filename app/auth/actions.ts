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
  const rawEmail = getString(formData, "email").trim().toLowerCase();
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    opsLogger.warn("auth.login.invalid_input", {
      email: rawEmail,
    });
    redirect("/auth/login?error=Credenciales+invalidas");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    opsLogger.warn("auth.login.failed", {
      email: parsed.data.email,
      reason: error.message,
    });
    redirect("/auth/login?error=No+se+pudo+iniciar+sesion");
  }

  opsLogger.info("auth.login.success", {
    email: parsed.data.email,
  });

  redirect("/dashboard");
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
  const { error } = await supabase.auth.signUp({
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
