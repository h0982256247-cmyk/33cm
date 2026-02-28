import { supabase } from "./supabase";

/**
 * 透過 LINE OA 廣播 Flex Message
 * 使用 PostgreSQL RPC 呼叫 LINE Messaging API（避免 Edge Function JWT 驗證問題）
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

    console.log('[Broadcast] 🚀 開始廣播流程（使用 RPC）');
    console.log('[Broadcast] 📝 訊息數量:', flexMessages.length);

    // 構建 LINE messages 格式
    const messages = flexMessages.map((flex) => ({
      type: "flex",
      altText,
      contents: flex,
    }));

    // 呼叫 PostgreSQL RPC
    const { data, error } = await supabase.rpc('rm_broadcast_message', {
      p_flex_messages: messages,
      p_alt_text: altText
    });

    if (error) {
      console.error('[Broadcast] ❌ RPC 調用失敗:', error);
      throw new Error(error.message || '廣播失敗');
    }

    // 檢查 RPC 返回的結果
    if (!data || !data.success) {
      const errorCode = data?.error?.code || 'UNKNOWN_ERROR';
      const errorMessage = data?.error?.message || '廣播失敗';
      console.error('[Broadcast] ❌ 廣播失敗');
      console.error('[Broadcast] 錯誤代碼:', errorCode);
      console.error('[Broadcast] 錯誤訊息:', errorMessage);

      // 提供友好的錯誤訊息
      let friendlyMessage = errorMessage;
      if (errorCode === 'TOKEN_NOT_FOUND') {
        friendlyMessage = 'LINE Token 未設定，請先綁定 LINE Channel';
      } else if (errorCode === 'LINE_API_ERROR') {
        friendlyMessage = 'LINE API 調用失敗，請檢查 Token 是否有效';
      }

      return { success: false, error: friendlyMessage };
    }

    console.log('[Broadcast] ✅ 廣播成功！');
    console.log('[Broadcast] 📊 結果:', data.data);

    return { success: true };

  } catch (error: unknown) {
    console.error('[Broadcast] ❌ 廣播失敗');

    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('[Broadcast] 錯誤訊息:', errorMessage);

    return {
      success: false,
      error: `廣播失敗：${errorMessage}`
    };
  }
}
