/**
 * 環境變數驗證
 * 使用 Zod 在應用啟動時驗證所有必要的環境變數
 * 如果環境變數缺失或格式錯誤，應用會立即失敗並顯示清晰的錯誤訊息
 */

import { z } from 'zod';

// 定義環境變數的 schema
const envSchema = z.object({
  // Supabase 配置（必填）
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL 必須是有效的 URL')
    .refine(
      (url) => url.includes('supabase.co'),
      'VITE_SUPABASE_URL 必須是 Supabase URL'
    ),

  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY 不能為空')
    .startsWith('eyJ', 'VITE_SUPABASE_ANON_KEY 格式錯誤（應該以 eyJ 開頭）'),

  // LINE LIFF 配置（選填）
  VITE_LIFF_ID: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d+-\w+$/.test(val),
      'VITE_LIFF_ID 格式錯誤（應該類似 1234567890-abcdefgh）'
    ),

  // 應用程式 URL（必填）
  VITE_APP_URL: z
    .string()
    .url('VITE_APP_URL 必須是有效的 URL')
    .refine(
      (url) => url.startsWith('https://') || import.meta.env.DEV,
      'VITE_APP_URL 在生產環境必須使用 HTTPS'
    ),
});

// 定義環境變數類型
export type Env = z.infer<typeof envSchema>;

/**
 * 驗證並取得環境變數
 * @throws {ZodError} 如果環境變數驗證失敗
 */
function validateEnv(): Env {
  try {
    return envSchema.parse({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      VITE_LIFF_ID: import.meta.env.VITE_LIFF_ID,
      VITE_APP_URL: import.meta.env.VITE_APP_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 格式化錯誤訊息
      const errorMessages = error.errors.map((err) => {
        return `❌ ${err.path.join('.')}: ${err.message}`;
      });

      const errorMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 環境變數配置錯誤
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${errorMessages.join('\n')}

📝 請檢查您的 .env 文件，確保包含以下變數：

VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
VITE_APP_URL=https://your-app.com
VITE_LIFF_ID=1234567890-abcdefgh  # 選填

💡 提示：
- 複製 .env.example 為 .env
- 從 Supabase Dashboard > Settings > API 取得 URL 和 Anon Key
- 從 LINE Developers Console 取得 LIFF ID（如果使用 LIFF）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();

      console.error(errorMessage);
      throw new Error('環境變數配置錯誤，請檢查 Console');
    }
    throw error;
  }
}

// 驗證並導出環境變數
export const env = validateEnv();

// 在開發環境中顯示配置資訊
if (import.meta.env.DEV) {
  console.log('✅ 環境變數驗證通過');
  console.log('📋 當前配置:', {
    supabaseUrl: env.VITE_SUPABASE_URL,
    hasAnonKey: !!env.VITE_SUPABASE_ANON_KEY,
    liffId: env.VITE_LIFF_ID || '（未設定）',
    appUrl: env.VITE_APP_URL,
    mode: import.meta.env.MODE,
  });
}
