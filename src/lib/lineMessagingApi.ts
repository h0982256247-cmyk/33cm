import { supabase } from "./supabase";

export interface BroadcastResult {
    success: boolean;
    error?: string;
}

/**
 * 取得當前用戶的 Supabase Auth Token（用於後端驗證）
 */
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * 廣播 Flex Message 給所有好友
 * 透過後端 API 呼叫 LINE Messaging API
 */
export async function broadcastFlexMessage(
    flexContents: any,
    altText: string
): Promise<BroadcastResult> {
    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            return {
                success: false,
                error: "未登入或 Session 已過期",
            };
        }

        const response = await fetch("/api/line/broadcast", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ flexContents, altText }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
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
 * 取得好友數量（用於預估廣播影響範圍）
 * 透過後端 API 呼叫 LINE Messaging API
 */
export async function getFollowerCount(): Promise<{
    success: boolean;
    count?: number;
    error?: string;
}> {
    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            return {
                success: false,
                error: "未登入或 Session 已過期",
            };
        }

        const response = await fetch("/api/line/followers", {
            headers: {
                "Authorization": `Bearer ${authToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error || `HTTP ${response.status}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            count: data.count,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "網路錯誤",
        };
    }
}

/**
 * 發布 Rich Menu（透過後端 API）
 */
export async function publishRichMenus(menus: Array<{
    menuData: any;
    imageBase64: string | null;
    aliasId: string;
    isMain: boolean;
}>): Promise<{
    success: boolean;
    results?: Array<any>;
    error?: string;
}> {
    try {
        const authToken = await getAuthToken();
        if (!authToken) {
            return {
                success: false,
                error: "未登入或 Session 已過期",
            };
        }

        const response = await fetch("/api/line/richmenu/publish", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`,
            },
            body: JSON.stringify({ menus }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error || `HTTP ${response.status}`,
            };
        }

        const data = await response.json();
        return {
            success: true,
            results: data.results,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || "網路錯誤",
        };
    }
}
