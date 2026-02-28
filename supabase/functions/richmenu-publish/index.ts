import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_API = 'https://api.line.me/v2/bot';

interface PublishMenuRequest {
  menuData: any;
  imageBase64: string | null;
  aliasId: string;
  isMain: boolean;
}

serve(async (req) => {
  console.log('[richmenu-publish] Received request:', req.method);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[richmenu-publish] CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. 驗證用戶身份
    const authHeader = req.headers.get('Authorization')
    console.log('[richmenu-publish] Auth header present:', !!authHeader);

    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // 驗證 JWT 並獲取用戶
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    console.log('[richmenu-publish] User authenticated:', user.id)

    // 2. 獲取請求數據
    const { menus, cleanOldMenus } = await req.json()

    // 3. 從資料庫獲取 LINE Access Token
    const { data: channelData, error: channelError } = await supabase
      .from('rm_line_channels')
      .select('access_token_encrypted')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (channelError || !channelData) {
      throw new Error('LINE Token not found')
    }

    const lineToken = channelData.access_token_encrypted

    // 4. 清理舊選單（如果需要）
    if (cleanOldMenus) {
      console.log('[richmenu-publish] Cleaning old menus...')

      const listResponse = await fetch(`${LINE_API}/richmenu/list`, {
        headers: {
          'Authorization': `Bearer ${lineToken}`
        }
      })

      if (listResponse.ok) {
        const listData = await listResponse.json()
        const existingMenus = listData.richmenus || []

        for (const menu of existingMenus) {
          await fetch(`${LINE_API}/richmenu/${menu.richMenuId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${lineToken}`
            }
          })
        }
      }
    }

    // 5. 發布每個選單
    const results = []

    for (const menuRequest of menus) {
      const { menuData, imageBase64, aliasId, isMain } = menuRequest as PublishMenuRequest

      // 5a. 創建 Rich Menu
      console.log('[richmenu-publish] Creating menu:', menuData.name)
      const createResponse = await fetch(`${LINE_API}/richmenu`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(menuData)
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        throw new Error(`Failed to create menu: ${errorText}`)
      }

      const createData = await createResponse.json()
      const richMenuId = createData.richMenuId

      // 5b. 上傳圖片
      if (imageBase64) {
        console.log('[richmenu-publish] Uploading image...')

        // 移除 data URL 前綴
        const base64Data = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64

        // 解碼 base64 為 binary
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const uploadResponse = await fetch(`${LINE_API}/richmenu/${richMenuId}/content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'image/png'
          },
          body: bytes
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          throw new Error(`Failed to upload image: ${errorText}`)
        }
      }

      // 5c. 設置 Alias
      if (aliasId) {
        console.log('[richmenu-publish] Setting alias:', aliasId)

        await fetch(`${LINE_API}/richmenu/alias`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            richMenuAliasId: aliasId,
            richMenuId: richMenuId
          })
        })
        // 不處理 alias 錯誤（非致命）
      }

      // 5d. 如果是主選單，設置為默認
      if (isMain) {
        console.log('[richmenu-publish] Setting as default menu')

        await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          }
        })
        // 不處理錯誤（非致命）
      }

      results.push({ aliasId, richMenuId })
    }

    console.log('[richmenu-publish] ✅ All menus published successfully')

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results,
          publishedAt: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('[richmenu-publish] Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'PUBLISH_ERROR',
          message: error.message || 'Failed to publish Rich Menu'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
