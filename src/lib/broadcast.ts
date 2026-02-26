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

    console.log('[Broadcast] Calling Supabase Edge Function...');

    // 呼叫 Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('broadcast', {
      body: {
        flexMessages,
        altText
      }
    });

    console.log('[Broadcast] Edge Function response:', { data, error });

    if (error) {
      console.error('[Broadcast] Edge Function error:', error);
      return {
        success: false,
        error: error.message || "呼叫 Edge Function 失敗"
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || "廣播失敗"
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
