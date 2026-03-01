import { RichMenu } from '@/lib/richmenuTypes';
import { buildLineRichMenuPayload } from '@/lib/lineRichMenuBuilder';
import { supabase } from '@/lib/supabase';

/**
 * 使用 PostgreSQL RPC 發布 Rich Menus
 * 避免 Edge Function 的 Authorization header 問題
 * 與成功的 Broadcast 使用相同的 RPC 模式
 */
export async function publishRichMenusViaRPC(
    menus: RichMenu[],
    cleanOld: boolean = true
): Promise<{ aliasId: string; richMenuId: string }[]> {
    console.log('═══════════════════════════════════════════');
    console.log('[richMenuPublishRPC] 🚀 開始發布 Rich Menu (RPC 模式)');
    console.log('[richMenuPublishRPC] 📅 時間:', new Date().toISOString());
    console.log('[richMenuPublishRPC] 📊 選單數量:', menus.length);
    console.log('[richMenuPublishRPC] 🧹 清理舊選單:', cleanOld);
    console.log('[richMenuPublishRPC] 🔑 使用 RPC 調用（與成功的 Broadcast 一致）');
    console.log('═══════════════════════════════════════════');

    // 輸出每個選單的詳細資訊
    menus.forEach((menu, index) => {
        console.log(`[richMenuPublishRPC] 📋 選單 ${index + 1}/${menus.length}:`, {
            id: menu.id,
            name: menu.name,
            isMain: menu.isMain,
            hotspots: menu.hotspots.length,
            hasImage: !!menu.imageData,
            imageSize: menu.imageData ? menu.imageData.length : 0,
        });
    });

    // 準備請求數據 (轉換為 RPC 需要的格式)
    console.log('[richMenuPublishRPC] 📦 準備 RPC 請求數據...');
    const menusJson = menus.map((menu, index) => {
        const menuData = buildLineRichMenuPayload(menu, menus);
        const aliasId = menu.id.replace(/-/g, '');

        console.log(`[richMenuPublishRPC] 🔧 處理選單 ${index + 1}: ${menu.name}`, {
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
    });

    console.log('[richMenuPublishRPC] 📊 請求數據總大小:', JSON.stringify(menusJson).length, 'bytes');

    try {
        console.log('[richMenuPublishRPC] 📤 調用 PostgreSQL RPC...');
        console.log('[richMenuPublishRPC] 🎯 Function: rm_publish_richmenu');

        const startTime = Date.now();

        // 🚨 關鍵修復：使用 RPC 而不是 Edge Function
        // RPC 會自動附加 Authorization header（與 Broadcast 相同）
        const { data, error } = await supabase.rpc('rm_publish_richmenu', {
            p_menus: menusJson,
            p_clean_old_menus: cleanOld
        });

        const duration = Date.now() - startTime;
        console.log('[richMenuPublishRPC] ⏱️ 請求耗時:', duration, 'ms');

        // 處理 RPC 調用錯誤
        if (error) {
            console.error('[richMenuPublishRPC] ❌ RPC 調用錯誤:', error);
            throw new Error(`RPC 調用失敗: ${error.message}`);
        }

        // 檢查 RPC 返回的業務邏輯錯誤
        if (!data || !data.success) {
            console.error('[richMenuPublishRPC] ❌ 業務邏輯錯誤:', data?.error);
            const errorMessage = data?.error?.message || '發布失敗';
            const errorDetails = data?.error?.details;

            if (errorDetails) {
                console.error('[richMenuPublishRPC] 🔍 錯誤詳情:', errorDetails);
            }

            throw new Error(errorMessage);
        }

        if (!data.data || !data.data.results) {
            throw new Error('RPC 未返回有效數據');
        }

        const results = data.data.results;
        const publishedAt = data.data.publishedAt;

        console.log('═══════════════════════════════════════════');
        console.log('[richMenuPublishRPC] ✅ 發布成功！');
        console.log('[richMenuPublishRPC] ⏱️ 總耗時:', duration, 'ms');
        console.log('[richMenuPublishRPC] 📊 發布結果:', results);
        console.log('[richMenuPublishRPC] 📅 發布時間:', publishedAt);
        console.log('═══════════════════════════════════════════');

        return results;

    } catch (error: any) {
        console.log('═══════════════════════════════════════════');
        console.error('[richMenuPublishRPC] ❌ 發布失敗');
        console.error('[richMenuPublishRPC] 🔍 錯誤類型:', error?.constructor?.name);
        console.error('[richMenuPublishRPC] 🔍 錯誤訊息:', error?.message);
        console.error('[richMenuPublishRPC] 🔍 完整錯誤:', error);
        console.log('═══════════════════════════════════════════');

        // 根據錯誤類型提供友好的錯誤訊息
        let errorMessage = '發布失敗';

        if (error instanceof Error) {
            errorMessage = error.message;

            // 針對不同錯誤類型提供解決建議
            if (error.message.includes('TOKEN_NOT_FOUND')) {
                errorMessage = '❌ LINE Token 未設定\n\n' +
                              '請先在設定頁面綁定 LINE Channel Access Token。';
            } else if (error.message.includes('IMAGE_UPLOAD_FAILED')) {
                errorMessage = '❌ 圖片上傳失敗\n\n' +
                              '可能原因：\n' +
                              '• 圖片檔案過大（超過 1MB）\n' +
                              '• 圖片格式不正確\n\n' +
                              '建議解決方案：\n' +
                              '1. 壓縮圖片後重試\n' +
                              '2. 確認圖片為 PNG 格式';
            } else if (error.message.includes('LINE_API_ERROR')) {
                errorMessage = '❌ LINE API 錯誤\n\n' +
                              error.message + '\n\n' +
                              '建議解決方案：\n' +
                              '1. 檢查 LINE Channel Access Token 是否有效\n' +
                              '2. 確認選單格式符合 LINE 官方規範';
            } else if (error.message.includes('RPC')) {
                errorMessage = '❌ 資料庫調用錯誤\n\n' +
                              error.message + '\n\n' +
                              '建議解決方案：\n' +
                              '1. 重新整理頁面\n' +
                              '2. 重新登入\n' +
                              '3. 如果問題持續，請聯繫技術支援';
            }
        }

        throw new Error(errorMessage);
    }
}
