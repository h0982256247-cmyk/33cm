import { supabase } from "./supabase";
import { validateToken } from "./edgeFunction";

export interface LineChannel {
    id: string;
    name: string;
}

/**
 * 取得當前用戶的 LINE Channel 基本資訊
 * 注意：不再回傳 accessToken，token 只在後端存取
 * 使用 RPC get_channel_status() 取得非敏感資訊
 */
export async function getChannel(): Promise<LineChannel | null> {
    const { data, error } = await supabase.rpc("get_channel_status");

    if (error || !data) {
        console.warn("[channel] getChannel error:", error);
        return null;
    }

    // 關鍵修復：處理數組返回值
    const result = Array.isArray(data) ? data[0] : data;

    console.log("[channel] getChannel result:", {
        hasChannel: result?.has_channel,
        name: result?.name,
        updatedAt: result?.updated_at,
        rawData: data
    });

    // get_channel_status 回傳 { has_channel, name, updated_at }
    if (!result?.has_channel) {
        return null;
    }

    return {
        id: "", // RPC 不回傳 id，前端也不需要
        name: result.name,
    };
}

/**
 * 檢查用戶是否已綁定 LINE Channel
 * 使用 RPC get_channel_status() 取得非敏感資訊
 */
export async function hasChannel(): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc("get_channel_status");

        if (error) {
            console.error("[channel] hasChannel error:", error);
            console.error("[channel] Error details:", {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            return false;
        }

        // 關鍵修復：RPC 返回的是數組 [{has_channel, name, updated_at}]
        const result = Array.isArray(data) ? data[0] : data;
        const hasToken = result?.has_channel === true;

        console.log("[channel] hasChannel result:", {
            hasToken,
            channelName: result?.name || null,
            updatedAt: result?.updated_at || null,
            rawData: data,
            isArray: Array.isArray(data)
        });

        return hasToken;
    } catch (err) {
        console.error("[channel] hasChannel exception:", err);
        return false;
    }
}

/**
 * 新增或更新 LINE Channel（使用 RPC）
 */
export async function upsertChannel(name: string, accessToken: string): Promise<string | null> {
    console.log("[channel] upsertChannel: Saving channel...", { name });

    const { data, error } = await supabase.rpc("rm_channel_upsert", {
        p_name: name,
        p_access_token: accessToken,
    });

    if (error) {
        console.error("[channel] upsertChannel error:", error);
        console.error("[channel] Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        throw new Error(error.message);
    }

    console.log("[channel] upsertChannel: ✅ Channel saved successfully", { channelId: data });

    // 驗證保存是否成功
    const hasToken = await hasChannel();
    console.log("[channel] upsertChannel: Token verification after save:", { hasToken });

    return data as string;
}

/**
 * 驗證 LINE Channel Access Token 是否有效
 * 透過 Supabase Edge Function 呼叫 LINE API 的 /v2/bot/info 端點驗證
 */
export async function validateAccessToken(accessToken: string): Promise<{
    valid: boolean;
    botName?: string;
    error?: string;
}> {
    try {
        console.log("[channel] validateAccessToken: 開始驗證...");

        // 使用統一的 Edge Function 介面
        const result = await validateToken(accessToken);

        console.log("[channel] validateAccessToken: 驗證結果:", {
            valid: result.valid,
            botName: result.botName || null
        });

        return {
            valid: result.valid,
            botName: result.botName,
            error: result.error,
        };
    } catch (err: any) {
        console.error("[channel] validateAccessToken: 驗證失敗:", err);

        // 提供友好的錯誤訊息
        let errorMessage = "驗證失敗";
        if (err.message?.includes("INVALID_TOKEN")) {
            errorMessage = "Token 格式錯誤或無效";
        } else if (err.message?.includes("Network")) {
            errorMessage = "網路連線失敗";
        } else if (err.message) {
            errorMessage = err.message;
        }

        return {
            valid: false,
            error: errorMessage,
        };
    }
}
