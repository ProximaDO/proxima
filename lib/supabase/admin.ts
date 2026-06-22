import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getSupabaseAdminEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const adminEnv = getSupabaseAdminEnv();

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    adminEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
