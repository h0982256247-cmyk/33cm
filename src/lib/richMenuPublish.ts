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
        let errorMessage = '發布失敗';

        if (error instanceof Error) {
            // EdgeFunctionError 會有 message
            errorMessage = error.message;

            // 如果是配置錯誤，提供管理員提示
            if (error.message.includes('SERVICE_ROLE_KEY') || error.message.includes('配置錯誤')) {
                errorMessage += '\n\n請聯繫系統管理員設定 Edge Function secrets。';
            }
        }

        throw new Error(errorMessage);
    }
}
