import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url || "", anon || "", {
  auth: {
    persistSession: true,         // ✅ 持久化 session（刷新頁面後仍保持登入）
    autoRefreshToken: true,       // ✅ 自動刷新過期的 token
    detectSessionInUrl: true,     // ✅ 仍然從 URL 檢測 session（magic link 需要）
  },
});
