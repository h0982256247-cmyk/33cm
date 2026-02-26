import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url || "", anon || "", {
  auth: {
    persistSession: true,        // 持久化 session 到 localStorage
    autoRefreshToken: true,       // 自動刷新 token
    detectSessionInUrl: true,     // 從 URL 檢測 session（用於 OAuth）
  },
});
