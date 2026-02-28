import { invokeEdgeFunction, RichMenuPublishResponse } from '@/lib/edgeFunction';
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
    console.log('[richMenuPublish] Publishing', menus.length, 'menus via Edge Function...');

    // 準備請求數據
    const requestData = {
        menus: menus.map(menu => ({
            menuData: buildLineRichMenuPayload(menu, menus),
            imageBase64: menu.imageData,
            aliasId: menu.id.replace(/-/g, ''),
            isMain: menu.isMain
        })),
        cleanOldMenus: cleanOld
    };

    try {
        // 使用統一的 Edge Function 調用模式
        // Supabase SDK 會自動處理 JWT token 和 apikey header
        const result = await invokeEdgeFunction<RichMenuPublishResponse>(
            'richmenu-publish',
            requestData
        );

        console.log('[richMenuPublish] ✅ All menus published successfully');
        return result.results;

    } catch (error: any) {
        console.error('[richMenuPublish] ❌ Publish failed:', error);

        // 提供更詳細的錯誤訊息
        if (error.message) {
            throw new Error(error.message);
        }
        throw new Error('發布失敗，請檢查網路連線和 LINE Token 設定');
    }
}
