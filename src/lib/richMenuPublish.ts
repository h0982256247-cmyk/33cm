import { supabase } from '@/lib/supabase';
import { RichMenu } from '@/lib/richmenuTypes';
import { buildLineRichMenuPayload } from '@/lib/lineRichMenuBuilder';

/**
 * 發布所有 Rich Menus
 * 使用 Supabase Edge Function 避免 CORS 問題
 */
export async function publishRichMenus(
    menus: RichMenu[],
    cleanOld: boolean = true
): Promise<{ aliasId: string; richMenuId: string }[]> {
    try {
        console.log('[richMenuPublish] Publishing', menus.length, 'menus via Edge Function...');

        // 1. 獲取當前用戶的 session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            throw new Error('請先登入以發布選單');
        }

        // 2. 準備請求數據
        const requestData = {
            menus: menus.map(menu => ({
                menuData: buildLineRichMenuPayload(menu, menus),
                imageBase64: menu.imageData,
                aliasId: menu.id.replace(/-/g, ''),
                isMain: menu.isMain
            })),
            cleanOldMenus: cleanOld
        };

        // 3. 調用 Edge Function
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/richmenu-publish`;

        console.log('[richMenuPublish] Calling Edge Function:', edgeFunctionUrl);

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '發布失敗');
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error?.message || '發布失敗');
        }

        console.log('[richMenuPublish] ✅ All menus published successfully');
        return result.data.results;

    } catch (error: any) {
        console.error('[richMenuPublish] ❌ Publish failed:', error);
        throw error;
    }
}
