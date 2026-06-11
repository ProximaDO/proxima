import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "user";

export async function getCurrentSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function getCurrentUserRole(userId: string): Promise<AppRole> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "admin" ? "admin" : "user";
}

export async function requireAuth() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  const role = await getCurrentUserRole(user.id);

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}
