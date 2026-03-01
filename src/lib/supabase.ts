import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(url || "", anon || "", {
  auth: {
    persistSession: true,         // ✅ 持久化 session（維持穩定的登入狀態）
    autoRefreshToken: true,       // ✅ 自動刷新過期的 token
    detectSessionInUrl: true,     // ✅ 從 URL 檢測 session（magic link 需要）
    storage: {
      // 使用 sessionStorage 代替 localStorage
      // 關閉瀏覽器後 session 會被清除
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key),
    },
  },
});
