import { supabase } from "./supabase";

/**
 * 透過 LINE OA 廣播 Flex Message
 * 使用 Supabase Edge Function 呼叫 LINE Messaging API
 * @param flexMessages Flex Message 內容陣列
 * @param altText 替代文字
 * @returns 廣播結果
 */
export async function broadcastFlexMessage(
  flexMessages: object[],
  altText: string = "您收到新訊息"
): Promise<{ success: boolean; error?: string }> {
  try {
    // LINE 官方限制：Broadcast 一次最多 5 則訊息
    if (flexMessages.length > 5) {
      return {
        success: false,
        error: "LINE 官方限制：一次最多只能廣播 5 則訊息"
      };
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Broadcast] 🚀 開始廣播流程');
    console.log('[Broadcast] 📝 請求參數:', {
      messageCount: flexMessages.length,
      altText,
      messages: flexMessages
    });

    // 檢查用戶登入狀態
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[Broadcast] 👤 用戶登入狀態:', {
      isLoggedIn: !!session,
      userId: session?.user?.id || 'NULL',
      email: session?.user?.email || 'NULL'
    });

    if (!session) {
      console.error('[Broadcast] ❌ 用戶未登入');
      return {
        success: false,
        error: "請先登入後再試"
      };
    }

    console.log('[Broadcast] 📡 正在呼叫 Edge Function...');

    // 呼叫 Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('broadcast', {
      body: {
        flexMessages,
        altText
      }
    });

    console.log('[Broadcast] 📥 Edge Function 回應:', {
      hasData: !!data,
      hasError: !!error,
      data: data,
      error: error
    });

    if (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('[Broadcast] ❌❌❌ Edge Function 錯誤詳情 ❌❌❌');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('📋 錯誤名稱:', error.name);
      console.error('📝 錯誤訊息:', error.message);
      console.error('🔍 完整錯誤物件:', error);
      console.error('📦 錯誤 JSON:', JSON.stringify(error, null, 2));

      // 嘗試從錯誤物件中提取更多資訊
      const errorObj = error as any;
      if (errorObj.context) {
        console.error('🎯 錯誤 Context:', errorObj.context);
      }
      if (errorObj.details) {
        console.error('📌 錯誤 Details:', errorObj.details);
      }
      if (errorObj.status) {
        console.error('🔢 HTTP Status Code:', errorObj.status);
      }

      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      let errorMessage = error.message || "呼叫 Edge Function 失敗";
      let troubleshooting = "";

      // 根據錯誤類型提供更友善的提示和排查步驟
      if (error.message?.includes('401')) {
        errorMessage = "❌ 401 認證失敗";
        troubleshooting = `
📍 白話文解釋：
   Edge Function 找不到你的 LINE Channel Token

🔧 可能原因：
   1. 你還沒有在 Supabase SQL Editor 執行 secure_token_access.sql
   2. 資料庫中的 token 記錄的 user_id 與你當前登入的帳號不符
   3. Edge Function 使用 service role 查詢時發生錯誤

✅ 解決步驟：
   1. 到 Supabase Dashboard → SQL Editor
   2. 執行 /supabase/secure_token_access.sql
   3. 執行 /supabase/debug_token_issue.sql 檢查資料
   4. 如果 user_id 不匹配，請刪除舊記錄後重新綁定 Token
   5. 重新整理頁面並再次嘗試廣播
        `;
      } else if (error.message?.includes('404')) {
        errorMessage = "❌ 404 Edge Function 不存在";
        troubleshooting = `
📍 白話文解釋：
   找不到 'broadcast' Edge Function

🔧 可能原因：
   Edge Function 尚未部署到 Supabase

✅ 解決步驟：
   1. 執行: supabase functions deploy broadcast
   2. 確認部署成功後再試
        `;
      } else if (error.message?.includes('timeout')) {
        errorMessage = "❌ 連線逾時";
        troubleshooting = `
📍 白話文解釋：
   Edge Function 執行時間過長，超過等待時間

🔧 可能原因：
   1. 網路連線不穩定
   2. LINE API 回應緩慢
   3. Supabase 服務繁忙

✅ 解決步驟：
   1. 檢查網路連線
   2. 稍後再試
        `;
      } else if (error.message?.includes('non-2xx')) {
        errorMessage = "❌ Edge Function 執行失敗";
        troubleshooting = `
📍 白話文解釋：
   Edge Function 執行過程中發生錯誤

🔧 可能原因：
   1. LINE Token 無效或過期
   2. Edge Function 內部邏輯錯誤
   3. LINE API 回傳錯誤

✅ 解決步驟：
   1. 檢查 Console 完整日誌
   2. 到 Supabase Dashboard → Edge Functions → Logs 查看後端日誌
   3. 確認 LINE Channel Access Token 是否有效
   4. 執行診斷 SQL: /supabase/debug_token_issue.sql
        `;
      }

      console.error('💡 排查建議:');
      console.error(troubleshooting);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        success: false,
        error: `${errorMessage}\n${troubleshooting}`
      };
    }

    if (!data || !data.success) {
      console.error('[Broadcast] ❌ 廣播失敗:', data?.error || '未知錯誤');
      console.error('[Broadcast] ❌ 完整回應:', data);
      return {
        success: false,
        error: data?.error || "廣播失敗"
      };
    }

    console.log('[Broadcast] ✅ 廣播成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return { success: true };

  } catch (error: any) {
    console.error('[Broadcast] ⚠️ 例外錯誤:');
    console.error('  - 錯誤類型:', error.constructor?.name || typeof error);
    console.error('  - 錯誤訊息:', error.message);
    console.error('  - 堆疊追蹤:', error.stack);
    console.error('  - 完整錯誤:', error);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return {
      success: false,
      error: error.message || "發生錯誤"
    };
  }
}
