import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../tipos";

/** Cliente com a chave secreta: ignora RLS. Só no servidor, sempre depois de checar quem pede. */
export const supabaseAdmin = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
