import { supabase } from "./supabase";

export interface LineChannel {
    id: string;
    name: string;
}

/**
 * 取得當前用戶的 LINE Channel 基本資訊
 * 注意：不再回傳 accessToken，token 只在後端存取
 */
export async function getChannel(): Promise<LineChannel | null> {
    const { data, error } = await supabase
        .from("rm_line_channels_safe")
        .select("id, name")
        .limit(1)
        .single();

    if (error || !data) {
        console.warn("[channel] getChannel error:", error);
        return null;
    }

    return {
        id: data.id,
        name: data.name,
    };
}

/**
 * 檢查用戶是否已綁定 LINE Channel
 */
export async function hasChannel(): Promise<boolean> {
    const { data, error } = await supabase
        .from("rm_line_channels_safe")
        .select("id")
        .limit(1);

    if (error) {
        console.warn("[channel] hasChannel error:", error);
        return false;
    }

    return Array.isArray(data) && data.length > 0;
}

/**
 * 新增或更新 LINE Channel（使用 RPC）
 */
export async function upsertChannel(name: string, accessToken: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("rm_channel_upsert", {
        p_name: name,
        p_access_token: accessToken,
    });

    if (error) {
        console.error("[channel] upsertChannel error:", error);
        throw new Error(error.message);
    }

    return data as string;
}

/**
 * 驗證 LINE Channel Access Token 是否有效
 * 透過呼叫 LINE API 的 /v2/bot/info 端點驗證
 */
export async function validateAccessToken(accessToken: string): Promise<{
    valid: boolean;
    botName?: string;
    error?: string;
}> {
    try {
        // Use local server proxy to avoid CORS issues
        const response = await fetch("/api/validate-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken }),
        });

        if (!response.ok) {
            return {
                valid: false,
                error: `Server Error: ${response.status}`,
            };
        }

        const data = await response.json();
        return {
            valid: data.valid,
            botName: data.botName,
            error: data.error,
        };
    } catch (err: any) {
        return {
            valid: false,
            error: err.message || "網路錯誤",
        };
    }
}
