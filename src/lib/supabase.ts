import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url || "", anon || "", {
  auth: {
    persistSession: false,        // ❌ 不持久化 session（每次都要重新登入）
    autoRefreshToken: false,      // ❌ 不自動刷新（因為不保存 session）
    detectSessionInUrl: true,     // ✅ 仍然從 URL 檢測 session（magic link 需要）
  },
});
