import { getChannel } from "./channel";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface BroadcastResult {
    success: boolean;
    error?: string;
}

/**
 * 廣播 Flex Message 給所有好友
 * 使用 LINE Messaging API 的 /message/broadcast 端點
 */
export async function broadcastFlexMessage(
    accessToken: string,
    flexContents: any,
    altText: string
): Promise<BroadcastResult> {
    try {
        const messages = [
            {
                type: "flex",
                altText,
                contents: flexContents,
            },
        ];

        const response = await fetch(`${LINE_API_BASE}/message/broadcast`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        return { success: true };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "網路錯誤",
        };
    }
}

/**
 * 廣播 Flex Message（自動從資料庫取得 Token）
 */
export async function broadcastFlexMessageAuto(
    flexContents: any,
    altText: string
): Promise<BroadcastResult> {
    const channel = await getChannel();
    if (!channel) {
        return {
            success: false,
            error: "尚未設定 LINE Channel，請先到設定頁面綁定 Token",
        };
    }

    return broadcastFlexMessage(channel.accessToken, flexContents, altText);
}

/**
 * 取得好友數量（用於預估廣播影響範圍）
 */
export async function getFollowerCount(accessToken: string): Promise<{
    success: boolean;
    count?: number;
    error?: string;
}> {
    try {
        const response = await fetch(`${LINE_API_BASE}/insight/followers`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.message || `HTTP ${response.status}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            count: data.followers,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "網路錯誤",
        };
    }
}
