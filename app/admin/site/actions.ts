"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { getNotificationEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const comingSoonSettingsSchema = z.object({
  coming_soon_enabled: z.boolean(),
  coming_soon_target_at: z.string().trim().min(1, "Selecciona una fecha objetivo"),
  coming_soon_title: z.string().trim().min(3, "El titulo es demasiado corto").max(120),
  coming_soon_message: z.string().trim().min(10, "El mensaje es demasiado corto").max(600),
});

const changeAdminPasswordSchema = z.object({
  new_password: z.string().min(8, "La nueva contrasena debe tener al menos 8 caracteres").max(72),
  confirm_password: z.string().min(8).max(72),
});

const createAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(40, "El nombre de usuario es demasiado largo")
    .regex(/^[a-z0-9._-]+$/, "Solo se permiten letras minusculas, numeros, punto, guion y guion bajo"),
  notification_email: z.string().trim().toLowerCase().email("Introduce un correo de notificacion valido"),
  full_name: z.string().trim().min(2, "El nombre es demasiado corto").max(120),
});

function toIsoFromLocalDateTime(raw: string) {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getAdminAccessUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return `${explicit}/auth/login`;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}/auth/login`;

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${preview}/auth/login`;

  return "https://proxima.do/auth/login";
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const length = 12;
  let password = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    password += alphabet[idx];
  }
  return password;
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

export async function changeAdminPasswordAction(formData: FormData) {
  const currentAdmin = await requireAdmin();
  const admin = createAdminClient();

  const parsed = changeAdminPasswordSchema.safeParse({
    new_password: String(formData.get("new_password") ?? ""),
    confirm_password: String(formData.get("confirm_password") ?? ""),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos invalidos";
    redirect(`/admin/site?error=${encodeURIComponent(firstError)}`);
  }

  if (parsed.data.new_password !== parsed.data.confirm_password) {
    redirect("/admin/site?error=Las+contrasenas+no+coinciden");
  }

  const { error } = await admin.auth.admin.updateUserById(currentAdmin.id, {
    password: parsed.data.new_password,
  });

  if (error) {
    redirect(`/admin/site?error=${encodeURIComponent(error.message || "No se pudo actualizar la contrasena")}`);
  }

  redirect("/admin/site?success=Contrasena+actualizada");
}

export async function createAdditionalAdminAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const parsed = createAdminSchema.safeParse({
    username: String(formData.get("username") ?? "").trim().toLowerCase(),
    notification_email: String(formData.get("notification_email") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos invalidos";
    redirect(`/admin/site?error=${encodeURIComponent(firstError)}`);
  }

  const { data: existingByUsername } = await admin
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (existingByUsername?.id) {
    redirect("/admin/site?error=Ese+nombre+de+usuario+ya+existe");
  }

  const temporaryPassword = generateTemporaryPassword();
  const adminAccessUrl = getAdminAccessUrl();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.notification_email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      username: parsed.data.username,
    },
  });

  if (createError || !created.user) {
    redirect(`/admin/site?error=${encodeURIComponent(createError?.message || "No se pudo crear el administrador")}`);
  }

  const newUserId = created.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        email: parsed.data.notification_email,
        full_name: parsed.data.full_name,
        username: parsed.data.username,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    redirect(`/admin/site?error=${encodeURIComponent(profileError.message || "Admin creado, pero fallo el perfil")}`);
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .upsert({ user_id: newUserId, role: "admin" }, { onConflict: "user_id" });

  if (roleError) {
    redirect(`/admin/site?error=${encodeURIComponent(roleError.message || "Admin creado, pero fallo el rol")}`);
  }

  const notificationPayload = {
    title: "Credenciales temporales de administrador",
    message: `Tu cuenta de administrador fue creada. Usa estas credenciales temporales y cambia tu contrasena al ingresar.`,
    username: parsed.data.username,
    temporary_password: temporaryPassword,
    admin_access_url: adminAccessUrl,
  };

  await admin
    .from("notification_events")
    .insert({
      user_id: newUserId,
      event_type: "admin_credentials",
      payload: notificationPayload,
      status: "sent",
      sent_at: new Date().toISOString(),
      read_at: null,
      scheduled_at: new Date().toISOString(),
      attempt_count: 0,
    });

  try {
    const env = getNotificationEnv();
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: parsed.data.notification_email,
      subject: "Acceso administrador Proxima",
      text: [
        "Tu cuenta de administrador fue creada.",
        `Usuario: ${parsed.data.username}`,
        `Contrasena temporal: ${temporaryPassword}`,
        `Acceso: ${adminAccessUrl}`,
        "Por seguridad, cambia la contrasena despues de iniciar sesion.",
      ].join("\n"),
      html: `<p>Tu cuenta de administrador fue creada.</p>
        <ul>
          <li><strong>Usuario:</strong> ${parsed.data.username}</li>
          <li><strong>Contrasena temporal:</strong> ${temporaryPassword}</li>
          <li><strong>Acceso:</strong> <a href="${adminAccessUrl}">${adminAccessUrl}</a></li>
        </ul>
        <p>Por seguridad, cambia la contrasena despues de iniciar sesion.</p>`,
    });
  } catch {
    // Si el servicio de email no esta configurado, la notificacion interna ya fue registrada.
  }

  redirect("/admin/site?success=Administrador+creado+y+notificado");
}
