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
      console.error('[Broadcast] ❌ Edge Function 錯誤:');
      console.error('  - 錯誤訊息:', error.message);
      console.error('  - 錯誤名稱:', error.name);
      console.error('  - 完整錯誤:', error);
      console.error('  - 錯誤 JSON:', JSON.stringify(error, null, 2));

      // 嘗試從錯誤物件中提取更多資訊
      const errorObj = error as any;
      if (errorObj.context) {
        console.error('  - 錯誤 Context:', errorObj.context);
      }
      if (errorObj.details) {
        console.error('  - 錯誤 Details:', errorObj.details);
      }

      let errorMessage = error.message || "呼叫 Edge Function 失敗";

      // 根據錯誤類型提供更友善的提示
      if (error.message?.includes('401')) {
        errorMessage = "❌ 認證失敗：找不到 LINE Channel Token，請先綁定 Token";
      } else if (error.message?.includes('404')) {
        errorMessage = "❌ Edge Function 不存在，請檢查部署狀態";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "❌ 連線逾時，請稍後再試";
      } else if (error.message?.includes('non-2xx')) {
        errorMessage = "❌ Edge Function 執行失敗，請查看 Console 日誌";
      }

      return {
        success: false,
        error: errorMessage
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
