import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  targetPath: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = targetPath;
  url.search = "";

  const redirectResponse = NextResponse.redirect(url);

  response.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    redirectResponse.cookies.set(name, value, options);
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/auth");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!user && (isDashboardRoute || isAdminRoute)) {
    return redirectWithCookies(request, response, "/auth/login");
  }

  if (!user) {
    return response;
  }

  let isAdmin = false;
  if (isAdminRoute || isAuthRoute) {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = roleData?.role === "admin";
  }

  if (isAdminRoute && !isAdmin) {
    return redirectWithCookies(request, response, "/dashboard");
  }

  if (isAuthRoute) {
    return redirectWithCookies(request, response, isAdmin ? "/admin" : "/dashboard");
  }

  return response;
}
