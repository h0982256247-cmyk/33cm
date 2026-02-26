import { supabase } from "./supabase";

/**
 * 透過 LINE OA 廣播 Flex Message
 * 使用後端 API 代理 LINE Messaging API 呼叫
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

    // 取得認證 Token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return {
        success: false,
        error: "登入狀態已過期，請重新整理頁面並重新登入"
      };
    }

    console.log('[Broadcast] Calling backend API...');

    // 呼叫後端 API（只需要第一個 flexMessage，因為是單一訊息廣播）
    const response = await fetch("/api/line/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        flexContents: flexMessages[0], // 後端 API 一次處理一個 flex message
        altText
      }),
    });

    console.log('[Broadcast] Backend API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Broadcast] Backend API error:', errorData);

      return {
        success: false,
        error: errorData.error || `廣播失敗 (HTTP ${response.status})`
      };
    }

    const data = await response.json();
    console.log('[Broadcast] Backend API response data:', data);

    if (!data.success) {
      return {
        success: false,
        error: data.error || "廣播失敗"
      };
    }

    console.log('[Broadcast] ✅ Broadcast successful');
    return { success: true };

  } catch (error: any) {
    console.error("[Broadcast] Exception:", error);
    return {
      success: false,
      error: error.message || "發生錯誤"
    };
  }
}
