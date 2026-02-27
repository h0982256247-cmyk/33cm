import { broadcast, EdgeFunctionError, getErrorMessage, getErrorCode } from "./edgeFunction";

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

    console.log('[Broadcast] 🚀 開始廣播流程');
    console.log('[Broadcast] 📝 訊息數量:', flexMessages.length);

    // 呼叫統一的 Edge Function 介面
    const result = await broadcast(flexMessages, altText);

    console.log('[Broadcast] ✅ 廣播成功！');
    console.log('[Broadcast] 📊 結果:', {
      messageCount: result.messageCount,
      sentAt: result.sentAt
    });

    return { success: true };

  } catch (error: unknown) {
    console.error('[Broadcast] ❌ 廣播失敗');

    // 使用統一的錯誤處理
    const errorCode = getErrorCode(error);
    const errorMessage = getErrorMessage(error);

    console.error('[Broadcast] 錯誤代碼:', errorCode);
    console.error('[Broadcast] 錯誤訊息:', errorMessage);

    // 根據錯誤代碼提供友好的中文提示
    let friendlyMessage = errorMessage;
    let troubleshooting = "";

    if (error instanceof EdgeFunctionError) {
      switch (error.code) {
        case "UNAUTHORIZED":
          friendlyMessage = "請先登入";
          troubleshooting = "請重新整理頁面並登入";
          break;

        case "TOKEN_NOT_FOUND":
          friendlyMessage = "LINE Token 未設定";
          troubleshooting = "請先到設定頁面綁定 LINE Channel Token";
          break;

        case "INVALID_LINE_TOKEN":
          friendlyMessage = "LINE Token 無效或已過期";
          troubleshooting = "請到 LINE Developers Console 確認 Token 是否有效";
          break;

        case "TOO_MANY_MESSAGES":
          friendlyMessage = "訊息數量超過限制";
          troubleshooting = "LINE 官方限制一次最多 5 則訊息";
          break;

        case "RATE_LIMIT_EXCEEDED":
          friendlyMessage = "發送頻率過高";
          troubleshooting = "請稍後再試（約 1 分鐘後）";
          break;

        case "LINE_API_ERROR":
          friendlyMessage = "LINE API 呼叫失敗";
          troubleshooting = "請檢查 LINE Channel 設定是否正確";
          break;

        default:
          troubleshooting = "請查看瀏覽器 Console 了解詳細錯誤";
      }

      console.error('[Broadcast] 💡 建議:', troubleshooting);
    }

    const fullMessage = troubleshooting
      ? `${friendlyMessage}\n\n💡 ${troubleshooting}`
      : friendlyMessage;

    return {
      success: false,
      error: fullMessage
    };
  }
}
