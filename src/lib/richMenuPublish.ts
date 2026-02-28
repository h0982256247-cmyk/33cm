import { supabase } from '@/lib/supabase';
import { RichMenu } from '@/lib/richmenuTypes';
import { buildLineRichMenuPayload, base64ToBlob } from '@/lib/lineRichMenuBuilder';

const LINE_API = 'https://api.line.me/v2/bot';

/**
 * 取得 LINE Access Token from RPC
 */
async function getLineToken(): Promise<string> {
    const { data, error } = await supabase.rpc('rm_get_line_token');

    if (error) {
        throw new Error(`無法取得 LINE Token: ${error.message}`);
    }

    if (!data || !data.success) {
        const errorMessage = data?.error?.message || '取得 Token 失敗';
        throw new Error(errorMessage);
    }

    return data.data.accessToken;
}

/**
 * 發布單個 Rich Menu 到 LINE
 */
async function publishSingleMenu(
    menu: RichMenu,
    allMenus: RichMenu[],
    lineToken: string
): Promise<{ aliasId: string; richMenuId: string }> {
    // 1. 創建 Rich Menu
    const menuPayload = buildLineRichMenuPayload(menu, allMenus);

    console.log('[richMenuPublish] Creating menu:', menu.name);
    const createResponse = await fetch(`${LINE_API}/richmenu`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(menuPayload)
    });

    if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`建立 Rich Menu 失敗: ${createResponse.status} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const richMenuId = createData.richMenuId;
    console.log('[richMenuPublish] Created menu ID:', richMenuId);

    // 2. 上傳圖片
    if (menu.imageData) {
        console.log('[richMenuPublish] Uploading image for menu:', menu.name);

        const imageBlob = base64ToBlob(menu.imageData);

        const uploadResponse = await fetch(`${LINE_API}/richmenu/${richMenuId}/content`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lineToken}`,
                'Content-Type': 'image/png'
            },
            body: imageBlob
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`上傳圖片失敗: ${uploadResponse.status} - ${errorText}`);
        }

        console.log('[richMenuPublish] Image uploaded successfully');
    }

    // 3. 設置 Alias
    const aliasId = menu.id.replace(/-/g, '');

    console.log('[richMenuPublish] Setting alias:', aliasId);
    const aliasResponse = await fetch(`${LINE_API}/richmenu/alias`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            richMenuAliasId: aliasId,
            richMenuId: richMenuId
        })
    });

    // Alias 創建失敗不是致命錯誤
    if (!aliasResponse.ok) {
        console.warn('[richMenuPublish] Alias creation failed (non-fatal):', await aliasResponse.text());
    }

    // 4. 如果是主選單，設置為默認
    if (menu.isMain) {
        console.log('[richMenuPublish] Setting as default menu');
        const defaultResponse = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lineToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!defaultResponse.ok) {
            console.warn('[richMenuPublish] Set default failed (non-fatal):', await defaultResponse.text());
        }
    }

    return { aliasId, richMenuId };
}

/**
 * 清理舊的 Rich Menus
 */
async function cleanOldMenus(lineToken: string): Promise<void> {
    console.log('[richMenuPublish] Cleaning old menus...');

    // 列出現有選單
    const listResponse = await fetch(`${LINE_API}/richmenu/list`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${lineToken}`
        }
    });

    if (!listResponse.ok) {
        console.warn('[richMenuPublish] List menus failed, skipping cleanup');
        return;
    }

    const listData = await listResponse.json();
    const existingMenus = listData.richmenus || [];

    // 刪除每個現有選單
    for (const menu of existingMenus) {
        const menuId = menu.richMenuId;
        console.log('[richMenuPublish] Deleting menu:', menuId);

        await fetch(`${LINE_API}/richmenu/${menuId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${lineToken}`
            }
        });
    }

    console.log('[richMenuPublish] Cleanup complete');
}

/**
 * 發布所有 Rich Menus
 */
export async function publishRichMenus(
    menus: RichMenu[],
    cleanOld: boolean = true
): Promise<{ aliasId: string; richMenuId: string }[]> {
    try {
        // 1. 取得 LINE Token
        console.log('[richMenuPublish] Getting LINE token...');
        const lineToken = await getLineToken();

        // 2. 清理舊選單（如果需要）
        if (cleanOld) {
            await cleanOldMenus(lineToken);
        }

        // 3. 發布每個選單
        console.log('[richMenuPublish] Publishing', menus.length, 'menus...');
        const results = [];

        for (const menu of menus) {
            const result = await publishSingleMenu(menu, menus, lineToken);
            results.push(result);
        }

        console.log('[richMenuPublish] ✅ All menus published successfully');
        return results;

    } catch (error: any) {
        console.error('[richMenuPublish] ❌ Publish failed:', error);
        throw error;
    }
}
