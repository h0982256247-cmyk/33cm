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
    // supabase.functions.invoke() 會自動從 session 中添加 Authorization header
    // 不要手動傳 headers，否則可能覆蓋掉預設的 headers（apikey 等）
    const response = await supabase.functions.invoke("broadcast", {
      body: { flexMessages, altText },
    });

    // 🔍 詳細 Log - 顯示完整的 response
    // Status 可能在 error.context.status 或直接在 response 中
    const statusCode = (response.error as any)?.context?.status ?? (response as any).status;

    console.log('=== Broadcast Edge Function Response ===');
    console.log('Status:', statusCode);
    console.log('Error:', response.error);
    console.log('Data:', response.data);
    console.log('=====================================');

    if (response.error) {
      // 顯示更詳細的錯誤訊息
      const errorDetails = {
        錯誤訊息: response.error.message || response.error,
        完整錯誤: response.error,
        HTTP狀態: statusCode,
        回應資料: response.data
      };

      console.error('=== Broadcast 錯誤完整資訊 ===');
      console.error('HTTP 狀態:', statusCode);
      console.error('錯誤物件:', response.error);
      console.error('回應資料:', response.data);
      console.error('完整 response:', JSON.stringify(response, null, 2));
      console.error('=======================');

      // 特別處理認證錯誤
      if (response.error.message?.includes('session') || response.error.message?.includes('Auth') || response.error.message?.includes('認證')) {
        return {
          success: false,
          error: `認證失敗，請重新整理頁面並重新登入\n\n詳細錯誤:\n${JSON.stringify(errorDetails, null, 2)}`
        };
      }

      return {
        success: false,
        error: `廣播失敗\n\n錯誤訊息: ${response.error.message || JSON.stringify(response.error)}\n\nHTTP 狀態: ${statusCode}\n\n詳細資訊:\n${JSON.stringify(errorDetails, null, 2)}`
      };
    }

    if (!response.data?.success) {
      const errorMsg = response.data?.error || "廣播失敗";
      const errorDetails = {
        錯誤訊息: errorMsg,
        完整回應: response.data,
        HTTP狀態: statusCode,
        後端詳細錯誤: response.data?.errorDetails
      };

      console.error('=== Broadcast 失敗完整資訊 ===');
      console.error('HTTP 狀態:', statusCode);
      console.error('錯誤訊息:', errorMsg);
      console.error('完整回應:', response.data);
      console.error('後端錯誤詳情:', response.data?.errorDetails);
      console.error('=======================');

      if (errorMsg.includes('session') || errorMsg.includes('Auth') || errorMsg.includes('認證')) {
        return {
          success: false,
          error: `認證失敗，請重新整理頁面並重新登入\n\n詳細錯誤:\n${JSON.stringify(errorDetails, null, 2)}`
        };
      }

      return {
        success: false,
        error: `廣播失敗\n\n錯誤訊息: ${errorMsg}\n\nHTTP 狀態: ${statusCode}\n\n詳細資訊:\n${JSON.stringify(errorDetails, null, 2)}`
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Broadcast exception:", error);
    return { success: false, error: error.message || "發生錯誤" };
  }
}
