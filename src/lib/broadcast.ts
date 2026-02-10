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
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: "未登入" };
    }

    // Call Edge Function
    const { data, error } = await supabase.functions.invoke("broadcast", {
      body: { flexMessages, altText },
    });

    if (error) {
      console.error("Broadcast error:", error);
      return { success: false, error: error.message || "廣播失敗" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Broadcast exception:", error);
    return { success: false, error: error.message || "發生錯誤" };
  }
}
