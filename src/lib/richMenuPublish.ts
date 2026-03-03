import { RichMenuPublishResponse } from '@/lib/edgeFunction';
import { RichMenu } from '@/lib/richmenuTypes';
import { buildLineRichMenuPayload } from '@/lib/lineRichMenuBuilder';
import { supabase } from '@/lib/supabase';

/**
 * 發布所有 Rich Menus
 * 使用 Supabase Edge Function 避免 CORS 問題
 */
export async function publishRichMenus(
    menus: RichMenu[],
    cleanOld: boolean = true
): Promise<{ aliasId: string; richMenuId: string }[]> {
    console.log('═══════════════════════════════════════════');
    console.log('[richMenuPublish] 🚀 開始發布 Rich Menu');
    console.log('[richMenuPublish] 📅 時間:', new Date().toISOString());
    console.log('[richMenuPublish] 📊 選單數量:', menus.length);
    console.log('[richMenuPublish] 🧹 清理舊選單:', cleanOld);
    console.log('═══════════════════════════════════════════');

    // 輸出每個選單的詳細資訊
    menus.forEach((menu, index) => {
        console.log(`[richMenuPublish] 📋 選單 ${index + 1}/${menus.length}:`, {
            id: menu.id,
            name: menu.name,
            isMain: menu.isMain,
            hotspots: menu.hotspots.length,
            hasImage: !!menu.imageData,
            imageSize: menu.imageData ? menu.imageData.length : 0,
        });
    });

    // ✅ 使用 JWT 認證（SDK 自動附加）
    // 準備請求數據
    console.log('[richMenuPublish] 📦 準備請求數據...');
    const requestData = {
        menus: menus.map((menu, index) => {
            const menuData = buildLineRichMenuPayload(menu, menus);
            const aliasId = menu.id.replace(/-/g, '');

            console.log(`[richMenuPublish] 🔧 處理選單 ${index + 1}: ${menu.name}`, {
                aliasId,
                isMain: menu.isMain,
                menuDataSize: JSON.stringify(menuData).length,
                imageSize: menu.imageData?.length || 0,
            });

            return {
                menuData,
                imageBase64: menu.imageData,
                aliasId,
                isMain: menu.isMain
            };
        }),
        cleanOldMenus: cleanOld
    };

    console.log('[richMenuPublish] 📊 請求數據總大小:', JSON.stringify(requestData).length, 'bytes');

    try {
        console.log('[richMenuPublish] 📤 調用 Edge Function...');
        console.log('[richMenuPublish] 🎯 Function: richmenu-publish');
        console.log('[richMenuPublish] 🔑 使用 JWT 認證（SDK 自動附加）');

        const startTime = Date.now();

        // ✅ SDK 會自動附加 Authorization: Bearer <JWT>
        // Edge Function 設定 verify_jwt = true 會自動驗證
        const { data, error } = await supabase.functions.invoke<{
            success: boolean;
            data?: RichMenuPublishResponse;
            error?: { code: string; message: string; details?: unknown };
        }>('richmenu-publish', {
            body: requestData
        });

        const duration = Date.now() - startTime;
        console.log('[richMenuPublish] ⏱️ 請求耗時:', duration, 'ms');

        // 處理 Supabase client 層面的錯誤（網路、連線等）
        if (error) {
            console.error('[richMenuPublish] ❌ Edge Function 調用錯誤:', error);
            console.error('[richMenuPublish] 🔍 Error object:', error);
            console.error('[richMenuPublish] 🔍 Error Context:', (error as any).context);

            // Supabase SDK 的 HTTP status 在 context.status 中
            const httpStatus = (error as any).context?.status || (error as any).status || 500;
            console.error('[richMenuPublish] 🔍 HTTP Status:', httpStatus);

            const enhancedError = new Error(`Edge Function 調用失敗: ${error.message}`) as any;
            enhancedError.httpStatus = httpStatus;
            enhancedError.code = 'INVOCATION_ERROR';
            enhancedError.details = { originalError: error, httpStatus };
            throw enhancedError;
        }

        // 處理業務邏輯錯誤（從 Edge Function 返回的錯誤）
        if (!data || !data.success) {
            console.error('[richMenuPublish] ❌ 業務邏輯錯誤:', data?.error);

            const businessError = new Error(data?.error?.message || '發布失敗') as any;
            businessError.code = data?.error?.code || 'UNKNOWN_ERROR';
            businessError.details = data?.error?.details;
            // 從響應體推測 HTTP status（雖然 Supabase SDK 可能不暴露）
            businessError.httpStatus = 500;
            throw businessError;
        }

        if (!data.data) {
            throw new Error('Edge Function 未返回數據');
        }

        const result = data.data;

        console.log('═══════════════════════════════════════════');
        console.log('[richMenuPublish] ✅ 發布成功！');
        console.log('[richMenuPublish] ⏱️ 總耗時:', duration, 'ms');
        console.log('[richMenuPublish] 📊 發布結果:', result.results);
        console.log('[richMenuPublish] 📅 發布時間:', result.publishedAt);
        console.log('═══════════════════════════════════════════');

        return result.results;

    } catch (error: any) {
        console.log('═══════════════════════════════════════════');
        console.error('[richMenuPublish] ❌ 發布失敗');
        console.error('[richMenuPublish] 🔍 錯誤類型:', error?.constructor?.name);
        console.error('[richMenuPublish] 🔍 錯誤訊息:', error?.message);
        console.error('[richMenuPublish] 🔍 HTTP Status:', error?.httpStatus);
        console.error('[richMenuPublish] 🔍 錯誤代碼:', error?.code);
        console.error('[richMenuPublish] 🔍 錯誤詳情:', error?.details);
        console.error('[richMenuPublish] 🔍 完整錯誤:', error);
        console.log('═══════════════════════════════════════════');

        // 根據錯誤類型和 HTTP status 提供友好的錯誤訊息
        let errorMessage = '發布失敗';
        const httpStatus = error?.httpStatus || 500;

        if (error instanceof Error) {
            errorMessage = error.message;

            // 針對不同 HTTP status 和錯誤類型提供解決建議
            if (httpStatus === 401 || error.message.includes('Unauthorized') || error.message.includes('401') || error.message.includes('認證')) {
                errorMessage = `❌ 認證失敗 (HTTP ${httpStatus})\n\n` +
                              '可能原因：\n' +
                              '• 登入狀態已過期\n' +
                              '• Token 無效或已撤銷\n\n' +
                              '建議解決方案：\n' +
                              '1. 重新整理頁面 (Cmd/Ctrl + R)\n' +
                              '2. 重新登入\n' +
                              '3. 檢查網路連線';
            } else if (httpStatus === 400 || error.code === 'TOKEN_NOT_FOUND' || httpStatus === 404) {
                errorMessage = `❌ 請求錯誤 (HTTP ${httpStatus})\n\n` +
                              error.message + '\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查是否已綁定 LINE Channel\n' +
                              '2. 確認 LINE Access Token 是否有效\n' +
                              '3. 重新設定 LINE Channel 連接';
            } else if (httpStatus === 500 || httpStatus === 502 || error.message.includes('SERVICE_ROLE_KEY') || error.message.includes('配置錯誤')) {
                errorMessage = `❌ 伺服器錯誤 (HTTP ${httpStatus})\n\n` +
                              error.message + '\n\n' +
                              '請聯繫系統管理員處理。';
            } else if (error.code === 'INVOCATION_ERROR') {
                errorMessage = `❌ 網路連線錯誤 (HTTP ${httpStatus})\n\n` +
                              '無法連接到伺服器。\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查網路連線\n' +
                              '2. 稍後再試\n' +
                              '3. 如果問題持續，請聯繫技術支援';
            } else if (error.message.includes('LINE') || error.message.includes('Failed to create menu') || error.message.includes('Failed to upload image')) {
                errorMessage = `❌ LINE API 錯誤 (HTTP ${httpStatus})\n\n` +
                              error.message + '\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查 LINE Channel Access Token 是否有效\n' +
                              '2. 確認選單格式符合 LINE 官方規範\n' +
                              '3. 檢查圖片大小是否超過 1MB';
            }
        }

        // 保留錯誤對象的所有屬性（status, code, details）
        const enhancedError = new Error(errorMessage) as any;
        enhancedError.httpStatus = httpStatus;
        enhancedError.code = error?.code;
        enhancedError.details = error?.details;
        throw enhancedError;
    }
}
