import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// 🔍 診斷日誌：驗證環境變數是否正確載入
console.log('[Supabase Client Init] 🔧 初始化 Supabase Client...');
console.log('[Supabase Client Init] 📍 URL:', url);
console.log('[Supabase Client Init] 🔑 Anon Key (前 50 字元):', anon?.substring(0, 50));
console.log('[Supabase Client Init] 📏 Anon Key 長度:', anon?.length);

if (!url || !anon) {
  console.error('[Supabase Client Init] ❌ 環境變數缺失！');
  console.error('[Supabase Client Init] 🔍 VITE_SUPABASE_URL:', url);
  console.error('[Supabase Client Init] 🔍 VITE_SUPABASE_ANON_KEY 存在:', !!anon);
  throw new Error('Supabase 環境變數未設定！請檢查 .env 文件');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,         // ✅ 持久化 session
    autoRefreshToken: true,       // ✅ 自動刷新過期的 token
    detectSessionInUrl: true,     // ✅ 從 URL 檢測 session（magic link 需要）
    // 🚨 修復：使用預設的 localStorage（而非自定義 sessionStorage）
    // 原因：自定義 storage 會干擾 SDK 的 header 自動附加機制
    // localStorage 是 Supabase SDK 的預設和推薦配置
  },
});
