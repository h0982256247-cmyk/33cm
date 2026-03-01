import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url || "", anon || "", {
  auth: {
    persistSession: false,        // ❌ 不持久化 session（關閉瀏覽器後需重新登入）
    autoRefreshToken: true,       // ✅ 自動刷新過期的 token
    detectSessionInUrl: true,     // ✅ 仍然從 URL 檢測 session（magic link 需要）
  },
});
