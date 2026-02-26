import { supabase } from "@/lib/supabase";

export async function ensureLineToken() {
  const { data, error } = await supabase
    .from("rm_line_channels")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (error || !data || data.length === 0) {
    throw new Error("LINE_TOKEN_MISSING");
  }
}