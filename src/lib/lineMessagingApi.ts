import { supabase } from "./supabase";

export interface BroadcastResult {
    success: boolean;
    error?: string;
}

/**
 * 廣播 Flex Message 給所有好友
 * 透過 Supabase Edge Function 呼叫 LINE Messaging API
 */
export async function broadcastFlexMessage(
    flexContents: any,
    altText: string
): Promise<BroadcastResult> {
    try {
        const { data, error } = await supabase.functions.invoke('broadcast', {
            body: {
                flexMessages: [flexContents],
                altText
            }
        });

        if (error) {
            return {
                success: false,
                error: error.message || "呼叫 Edge Function 失敗",
            };
        }

        if (!data || !data.success) {
            return {
                success: false,
                error: data?.error || "廣播失敗",
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
 * 透過 Supabase Edge Function 呼叫 LINE Messaging API
 */
export async function getFollowerCount(): Promise<{
    success: boolean;
    count?: number;
    error?: string;
}> {
    try {
        const { data, error } = await supabase.functions.invoke('get-followers', {
            method: 'GET'
        });

        if (error) {
            return {
                success: false,
                error: error.message || "呼叫 Edge Function 失敗",
            };
        }

        if (!data || !data.success) {
            return {
                success: false,
                error: data?.error || "取得好友數量失敗",
            };
        }

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
 * 發布 Rich Menu（透過 Supabase Edge Function）
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
        const { data, error } = await supabase.functions.invoke('publish-richmenu', {
            body: {
                menus,
                cleanOldMenus: true
            }
        });

        if (error) {
            return {
                success: false,
                error: error.message || "呼叫 Edge Function 失敗",
            };
        }

        if (!data || !data.success) {
            return {
                success: false,
                error: data?.error || "發布 Rich Menu 失敗",
            };
        }

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
