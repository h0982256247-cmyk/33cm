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

    // ✅ 移除前端 session 檢查，Edge Function 會自動驗證 JWT
    // SDK 會在 functions.invoke() 時自動附加最新的 Authorization header

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
        console.log('[richMenuPublish] 🔑 使用直接調用模式（與成功的 Broadcast 一致）');

        const startTime = Date.now();

        // 🚨 關鍵修復：直接調用 supabase.functions.invoke()
        // 與成功的 Broadcast Function 保持一致，完全繞過 edgeFunction.ts
        // 讓 Supabase SDK 自動處理認證

        // 🔧 診斷：獲取 session 並準備 headers
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        console.log('[richMenuPublish] 🔍 Session 檢查:', {
            hasSession: !!session,
            hasAccessToken: !!session?.access_token,
            tokenLength: session?.access_token?.length,
            expiresAt: session?.expires_at,
            expiresIn: session?.expires_at
                ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000)
                : null,
            sessionError: sessionError?.message
        });

        if (sessionError || !session?.access_token) {
            throw new Error(sessionError?.message || '無法取得登入 Token，請重新登入');
        }

        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        console.log('[richMenuPublish] 🔍 準備 Headers:', {
            hasAnonKey: !!anonKey,
            anonKeyLength: anonKey?.length
        });

        if (!anonKey) {
            throw new Error('環境變數 VITE_SUPABASE_ANON_KEY 未設定');
        }

        // 🚨 關鍵修復：手動附加 Authorization 和 apikey headers
        // 因為 SDK 在某些情況下不會自動附加
        const { data, error } = await supabase.functions.invoke<{
            success: boolean;
            data?: RichMenuPublishResponse;
            error?: { code: string; message: string; details?: unknown };
        }>('richmenu-publish', {
            body: requestData,
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: anonKey,
            }
        });

        const duration = Date.now() - startTime;
        console.log('[richMenuPublish] ⏱️ 請求耗時:', duration, 'ms');

        // 處理 Supabase client 層面的錯誤
        if (error) {
            console.error('[richMenuPublish] ❌ Edge Function 調用錯誤:', error);
            throw new Error(`Edge Function 調用失敗: ${error.message}`);
        }

        // 處理業務邏輯錯誤
        if (!data || !data.success) {
            console.error('[richMenuPublish] ❌ 業務邏輯錯誤:', data?.error);
            throw new Error(data?.error?.message || '發布失敗');
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
        console.error('[richMenuPublish] 🔍 錯誤代碼:', error?.code);
        console.error('[richMenuPublish] 🔍 錯誤詳情:', error?.details);
        console.error('[richMenuPublish] 🔍 完整錯誤:', error);
        console.log('═══════════════════════════════════════════');

        // 根據錯誤類型提供友好的錯誤訊息
        let errorMessage = '發布失敗';

        if (error instanceof Error) {
            errorMessage = error.message;

            // 針對不同錯誤類型提供解決建議
            if (error.message.includes('Unauthorized') || error.message.includes('401')) {
                errorMessage = '❌ 認證失敗\n\n' +
                              '可能原因：\n' +
                              '• 登入狀態已過期\n' +
                              '• Token 無效或已撤銷\n\n' +
                              '建議解決方案：\n' +
                              '1. 重新整理頁面 (Cmd/Ctrl + R)\n' +
                              '2. 重新登入\n' +
                              '3. 檢查網路連線';
            } else if (error.message.includes('SERVICE_ROLE_KEY') || error.message.includes('配置錯誤')) {
                errorMessage = '❌ 伺服器配置錯誤\n\n' +
                              error.message + '\n\n' +
                              '請聯繫系統管理員處理。';
            } else if (error.message.includes('INVOCATION_ERROR')) {
                errorMessage = '❌ 網路連線錯誤\n\n' +
                              '無法連接到伺服器。\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查網路連線\n' +
                              '2. 稍後再試\n' +
                              '3. 如果問題持續，請聯繫技術支援';
            } else if (error.message.includes('LINE')) {
                errorMessage = '❌ LINE API 錯誤\n\n' +
                              error.message + '\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查 LINE Channel Access Token 是否有效\n' +
                              '2. 確認選單格式符合 LINE 官方規範\n' +
                              '3. 檢查圖片大小是否超過 1MB';
            }
        }

        throw new Error(errorMessage);
    }
}
