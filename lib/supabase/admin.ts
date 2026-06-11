import { createClient } from "@supabase/supabase-js";
import { getNotificationEnv, getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const notificationEnv = getNotificationEnv();

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    notificationEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
