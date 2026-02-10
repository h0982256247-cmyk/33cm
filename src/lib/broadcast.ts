import { supabase } from "./supabase";

/**
 * 透過 LINE OA 廣播 Flex Message
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

    // Session Guard: 確保有效的 auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return { success: false, error: "登入狀態已過期，請重新整理頁面並重新登入" };
    }

    // 檢查 token 是否即將過期（30秒內）
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    if (expiresAt - now < 30000) {
      // Token 即將過期，嘗試刷新
      console.log('[Broadcast] Token expiring soon, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !newSession) {
        return { success: false, error: "無法刷新登入狀態，請重新登入" };
      }
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke("broadcast", {
      body: { flexMessages, altText },
    });

    if (error) {
      console.error("Broadcast error:", error);
      // 特別處理認證錯誤
      if (error.message?.includes('session') || error.message?.includes('Auth') || error.message?.includes('認證')) {
        return { success: false, error: "認證失敗，請重新整理頁面並重新登入" };
      }
      return { success: false, error: error.message || "廣播失敗" };
    }

    if (!data?.success) {
      const errorMsg = data?.error || "廣播失敗";
      if (errorMsg.includes('session') || errorMsg.includes('Auth') || errorMsg.includes('認證')) {
        return { success: false, error: "認證失敗，請重新整理頁面並重新登入" };
      }
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Broadcast exception:", error);
    return { success: false, error: error.message || "發生錯誤" };
  }
}
