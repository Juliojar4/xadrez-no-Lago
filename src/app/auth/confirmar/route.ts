import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Destino dos links de e-mail dos responsáveis (convite e link de entrada). */
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (token_hash && (type === "invite" || type === "email")) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) redirect("/responsavel");
  }
  redirect("/responsavel/entrar?erro=link");
}
